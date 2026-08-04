/**
 * ControllerFactory — creates dynamic NestJS controllers from ResourceSpec.
 *
 * This is the heart of the spec engine. Instead of generating .ts files,
 * we build controller classes at runtime that implement the full 7-stage
 * pipeline: auth → validation → beforeHook → db → afterHook → notifications → response.
 *
 * Each resource gets:
 *   GET    /<resource>          → findAll (paginated, row-level filtered)
 *   GET    /<resource>/:id      → findOne (row-level filtered)
 *   POST   /<resource>          → create (Zod validated, hooks, notifications)
 *   PATCH  /<resource>/:id      → update (Zod validated, hooks, notifications)
 *   DELETE /<resource>/:id      → softDelete (hooks, notifications)
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  HttpStatus,
  HttpCode,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
  Inject,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  Repository,
  FindManyOptions,
  FindOneOptions,
  EntitySchema,
} from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { z } from 'zod';
import type { Request, Response } from 'express';

import { Roles } from '@iam/roles/roles.decorator';
import { RoleEnum } from '@iam/roles/roles.enum';
import { RolesGuard } from '@iam/roles/roles.guard';

import type {
  ResourceSpec,
  PermissionRole,
  HookContext,
  AuthenticatedUser,
  FieldSpec,
} from './spec.types';
import { HookAbortError } from './spec.types';
import { ValidationFactory } from './validation-factory';
import { TraceBuilder } from './spec-trace';
import { HookExecutor, LoadedHook } from './hook-executor';
import { NotificationDispatcher } from './notification-dispatcher';
import { HookContextImpl } from './hook-context';
import { SpecEngineBootService } from './spec-engine-boot';
import { StateMachineValidator } from './spec-engine-state-machine';
import { SpecAuditLogger } from './spec-engine-audit';
import { ComputedFieldResolver } from './spec-engine-computed';
import { OutboundWebhookDispatcher } from './spec-engine-outbound-webhooks';
import { SpecScheduledActionManager } from './spec-engine-scheduled-actions';
import { RoleRegistry } from './role-registry';

// Role name → RoleEnum value map. Built-in roles resolve via RoleRegistry so
// custom roles (manager) declared in ExtensionSpec.roles are honored.
const BUILTIN_ROLE_MAP: Record<string, number | null> = {
  admin: RoleEnum.admin,
  user: RoleEnum.customer,
  public: null,
};

// Free function for role resolution (used inside dynamic controller class).
// Consults RoleRegistry so custom roles (e.g. 'manager') resolve to their DB
// role id instead of being dropped (BUG #8).
function resolveRolesArray(roles: PermissionRole[]): number[] {
  const out: number[] = [];
  for (const r of roles) {
    const id = RoleRegistry.resolveId(r);
    if (id !== null) out.push(id);
  }
  return out;
}

// Parse and validate a numeric ID from a route param.
// Returns NaN if invalid — callers should check with Number.isFinite().
function parseId(id: string): number {
  const num = Number(id);
  return Number.isFinite(num) ? num : NaN;
}

export interface MaterializedController {
  controllerClass: any;
  entitySchemaName: string;
}

export interface ControllerFactoryParams {
  spec: ResourceSpec;
  /** The EntitySchema instance (preferred over a name string so getRepositoryToken resolves correctly). */
  entitySchema: EntitySchema<any>;
  extensionDir: string;
  hookExecutor: HookExecutor;
  notificationDispatcher: NotificationDispatcher;
  isDev: boolean;
  allHooks: {
    beforeCreate?: LoadedHook;
    afterCreate?: LoadedHook;
    beforeUpdate?: LoadedHook;
    afterUpdate?: LoadedHook;
    beforeDelete?: LoadedHook;
    afterDelete?: LoadedHook;
    beforeQuery?: LoadedHook;
  };
  manyToManySchemas: EntitySchema<any>[];
}

export class ControllerFactory {
  /**
   * Build a dynamic controller class with the full 7-stage pipeline.
   */
  static create(params: ControllerFactoryParams): MaterializedController {
    const {
      spec,
      entitySchema,
      extensionDir,
      hookExecutor,
      notificationDispatcher,
      isDev,
      allHooks,
      manyToManySchemas,
    } = params;

    const resourceName = spec.name;
    const displayName = spec.displayName || resourceName;
    const routePath = this.pluralize(resourceName);
    const createSchema = ValidationFactory.createCreateSchema(spec);
    const updateSchema = ValidationFactory.createUpdateSchema(spec);
    // Derive the DI token from the EntitySchema (not a name string) so
    // getRepositoryToken() resolves via the EntitySchema branch. The string
    // branch returns "undefinedRepository" because strings have no `.name`.
    const entitySchemaName =
      (entitySchema.options as any).target?.name ??
      (entitySchema.options as any).name ??
      resourceName;
    const diToken = getRepositoryToken(entitySchema);

    const isTransactional = spec.transactional !== false;
    const manyToManyFields = spec.fields.filter(
      (f) => f.type === 'many-to-many',
    );
    const joinTableRepositories = new Map(
      manyToManySchemas.map((schema) => {
        const tableName = (schema.options as any).tableName as string;
        const entityName = (schema.options as any).name as string;
        return [tableName, getRepositoryToken(entityName as any)];
      }),
    );

    // Resolve roles
    const perms = spec.permissions || {};
    const listRoles = this.resolveRoles(perms.list || ['admin']);
    const readRoles = this.resolveRoles(perms.read || ['admin']);
    const createRoles = this.resolveRoles(perms.create || ['admin']);
    const updateRoles = this.resolveRoles(perms.update || ['admin']);
    const deleteRoles = this.resolveRoles(perms.delete || ['admin']);

    // Row-level filters
    const rowLevel = perms.rowLevel || {};

    // Field-level RBAC
    const fieldPerms = perms.fields || {};

    // App config for notifications — resolved lazily via boot service
    const getAppConfig = () => {
      const cs = SpecEngineBootService.getConfigService();
      return {
        url: cs.get('app.backendDomain', { infer: true }) || '',
        name: cs.get('app.name', { infer: true }) || '',
        notificationEmail:
          cs.get('app.notificationEmail', { infer: true }) || '',
      };
    };

    // Notifications
    const notifications = spec.notifications || [];

    @ApiTags(displayName)
    @ApiBearerAuth()
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Controller({ path: routePath, version: '1' })
    class SpecDynamicController {
      private readonly logger = new Logger(`SpecController:${displayName}`);

      constructor(
        @Inject(diToken) private readonly repository: Repository<any>,
      ) {}

      private dataSource: any = null;
      private transactionManager: any = null;

      private getDataSource(): any {
        if (!this.dataSource) {
          this.dataSource = SpecEngineBootService.getDataSource();
        }
        return this.dataSource;
      }

      private getRepositoryForOperation(): Repository<any> {
        return this.transactionManager
          ? this.transactionManager.getRepository(entitySchemaName as any)
          : this.repository;
      }

      private setTransactionManager(manager: any): void {
        this.transactionManager = manager;
      }

      private clearTransactionManager(): void {
        this.transactionManager = null;
      }

      // ─── Helper: many-to-many field handling ─────────────
      private extractManyToManyValues(
        data: Record<string, unknown>,
      ): Record<string, number[]> {
        const values: Record<string, number[]> = {};
        for (const f of manyToManyFields) {
          const v = data[f.name];
          if (Array.isArray(v) && v.every((x) => typeof x === 'number')) {
            values[f.name] = v as number[];
          }
        }
        return values;
      }

      private omitManyToManyFields(
        data: Record<string, unknown>,
      ): Record<string, unknown> {
        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(data)) {
          if (!manyToManyFields.some((f) => f.name === key)) {
            result[key] = value;
          }
        }
        return result;
      }

      private async syncManyToManyRelations(
        entity: Record<string, unknown>,
        values: Record<string, number[]>,
        operation: 'create' | 'update',
      ): Promise<void> {
        const entityId = Number(entity.id);
        if (!Number.isFinite(entityId)) return;

        for (const f of manyToManyFields) {
          const ids = values[f.name];
          if (!ids) continue;

          const joinSchema = manyToManySchemas.find(
            (s) => (s.options as any).tableName === this.getJoinTableName(f),
          );
          if (!joinSchema) {
            this.logger.warn(`Join table schema not found for ${f.name}`);
            continue;
          }

          const entityName = (joinSchema.options as any).name as string;
          const repo = this.transactionManager
            ? this.transactionManager.getRepository(entityName as any)
            : this.getJoinTableRepository(f);

          const fromCol = f.throughFields?.from ?? `${spec.name}Id`;
          const toCol =
            f.throughFields?.to ??
            `${this.fieldToRelationName(f.ref ?? f.name)}Id`;

          if (operation === 'update') {
            const existing = await repo.find({
              where: { [fromCol]: entityId },
            });
            const existingIds = new Set(
              existing.map((row: any) => Number(row[toCol])),
            );
            const desiredIds = new Set(ids);
            const toInsert = ids.filter((id) => !existingIds.has(id));
            const toDelete = existing
              .filter((row: any) => !desiredIds.has(Number(row[toCol])))
              .map((row: any) => row[toCol]);

            for (const id of toInsert) {
              await repo.save({ [fromCol]: entityId, [toCol]: id });
            }
            for (const id of toDelete) {
              await repo.delete({ [fromCol]: entityId, [toCol]: id });
            }
          } else {
            for (const id of ids) {
              await repo.save({ [fromCol]: entityId, [toCol]: id });
            }
          }
        }
      }

      private getJoinTableName(field: FieldSpec): string {
        return field.joinTable ?? `ext_${spec.table}_${field.name}`;
      }

      private getJoinTableRepository(field: FieldSpec): Repository<any> {
        const token = joinTableRepositories.get(this.getJoinTableName(field));
        if (!token) {
          throw new Error(
            `Join table repository not registered for ${field.name}`,
          );
        }
        return SpecEngineBootService.getModuleRef().get(token, {
          strict: false,
        });
      }

      private fieldToRelationName(fieldName: string): string {
        if (fieldName.endsWith('Id')) {
          return fieldName.slice(0, -2);
        }
        return fieldName;
      }

      // ─── Helper: build HookContext ──────────────────────
      private buildContext(
        user: AuthenticatedUser | null,
        operation: string,
        trace: TraceBuilder,
      ): HookContext {
        const ctx = new HookContextImpl(
          SpecEngineBootService.getModuleRef(),
          SpecEngineBootService.getConfigService(),
          user,
          resourceName,
          operation,
          trace,
          this.dataSource,
        ) as unknown as HookContext;
        return ctx;
      }

      // ─── Helper: filter data by write permissions ──────
      private applyFieldWritePerms(
        data: Record<string, unknown>,
        user: AuthenticatedUser | null,
      ): Record<string, unknown> {
        if (!user || Object.keys(fieldPerms).length === 0) return data;
        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(data)) {
          const fieldRule = fieldPerms[key];
          if (fieldRule?.write) {
            const allowedRoles = resolveRolesArray(fieldRule.write);
            if (!allowedRoles.includes(user.role?.id)) continue; // strip field
          }
          result[key] = value;
        }
        return result;
      }

      // ─── Helper: sanitize hook output — only allow spec fields ──
      private sanitizeHookOutput(
        data: Record<string, unknown>,
      ): Record<string, unknown> {
        const allowedFields = new Set(spec.fields.map((f) => f.name));
        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(data)) {
          if (allowedFields.has(key)) {
            result[key] = value;
          }
        }
        return result;
      }

      // ─── Helper: apply row-level filter ─────────────────
      private applyRowLevelFilter(
        user: AuthenticatedUser | null,
        where: Record<string, unknown>,
      ): Record<string, unknown> {
        if (!user) return where;
        const roleName = this.roleIdToName(user.role?.id);
        if (roleName === '__denied__') {
          // Unknown role — deny all rows
          return { ...where, id: -1 };
        }
        const rule = rowLevel[roleName];
        if (!rule) return where;

        // Simple filter: 'assigneeId == ${user.id}'
        const match = rule.filter.match(/^(\w+)\s*==\s*\$\{user\.(\w+)\}$/);
        if (match) {
          const [, field, userField] = match;
          const value = (user as any)[userField];
          if (value === undefined) {
            // Fail closed: if user field doesn't resolve, return impossible WHERE
            return { ...where, id: -1 };
          }
          return { ...where, [field]: value };
        }
        // Fail closed: unrecognized filter pattern → deny all rows
        this.logger.warn(
          `Row-level filter "${rule.filter}" could not be parsed — denying all rows`,
        );
        return { ...where, id: -1 };
      }

      // ─── Helper: strip fields user can't read ───────────
      private applyFieldReadPerms(
        entity: Record<string, unknown>,
        user: AuthenticatedUser | null,
      ): Record<string, unknown> {
        if (!user || Object.keys(fieldPerms).length === 0) return entity;
        const roleName = this.roleIdToName(user.role?.id);
        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(entity)) {
          const fieldRule = fieldPerms[key];
          if (fieldRule?.read) {
            const allowedRoles = resolveRolesArray(fieldRule.read);
            if (!allowedRoles.includes(user.role?.id)) continue;
          }
          result[key] = value;
        }
        return result;
      }

      private roleIdToName(roleId: number | undefined): string {
        // Delegate to RoleRegistry so:
        //   - customer (2) maps to 'user' (spec permission vocabulary), NOT
        //     'customer' (BUG #4) — so rowLevel['user'] matches.
        //   - custom roles (manager) resolve via the registry's DB-backed map
        //     (BUG #8) instead of failing closed.
        return RoleRegistry.resolveName(roleId);
      }

      // ─── GET / ──────────────────────────────────────────
      @Get()
      @Roles(...listRoles)
      async findAll(
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('sort') sortParam?: string,
        @Query('include') includeParam?: string,
        @Query() query?: Record<string, unknown>,
        @Req() req?: Request,
        @Res({ passthrough: true }) res?: Response,
      ) {
        const user = (req?.user as AuthenticatedUser) || null;
        const trace = new TraceBuilder(
          resourceName,
          'list',
          user ? { id: user.id, role: user.role?.name || '' } : null,
          this.logger,
          isDev,
        );

        trace.startStage('auth');
        trace.endStage('auth', 'pass', {
          guard: 'jwt',
          rolesChecked: listRoles,
        });

        trace.startStage('db');
        const pageNum =
          page && Number.isFinite(Number(page))
            ? Math.max(1, Math.floor(Number(page)))
            : 1;
        const limitNum =
          limit && Number.isFinite(Number(limit))
            ? Math.max(1, Math.min(100, Math.floor(Number(limit))))
            : 20;
        const skip = (pageNum - 1) * limitNum;

        // Row-level filter first
        const rowWhere = this.applyRowLevelFilter(user, {});
        // Apply user-supplied filters AFTER row-level filter (defense-in-depth)
        const parsedFilters = query
          ? ControllerFactory.parseFilters(query, spec)
          : {};
        const where = { ...rowWhere, ...parsedFilters };

        // Sorting — defaults to id DESC if nothing valid specified
        const parsedSort = sortParam
          ? ControllerFactory.parseSort(sortParam, spec)
          : {};
        const order =
          Object.keys(parsedSort).length > 0
            ? parsedSort
            : { id: 'DESC' as const };

        // Includes — validated against includeable fields
        const relations = includeParam
          ? ControllerFactory.parseIncludes(includeParam, spec)
          : [];

        // beforeQuery hook — allows complex query modification (joins, extra WHERE, relations)
        let queryOptions: FindManyOptions = {
          skip,
          take: limitNum,
          where,
          order: order as any,
          withDeleted: false,
        };
        if (relations.length > 0) {
          queryOptions.relations = relations.reduce(
            (acc, name) => ({ ...acc, [name]: true }),
            {} as Record<string, boolean>,
          );
        }

        if (allHooks.beforeQuery) {
          trace.startStage('beforeHook');
          const ctx = this.buildContext(user, 'list', trace);
          queryOptions = await hookExecutor.executeBeforeQueryHook(
            allHooks.beforeQuery,
            queryOptions,
            ctx,
            trace,
          );
        } else {
          trace.skipStage('beforeHook', 'no beforeQuery hook defined');
        }

        const [items, total] = await this.repository.findAndCount(queryOptions);

        trace.endStage('db', 'pass', {
          operation: 'SELECT',
          table: spec.table,
          count: items.length,
        });

        // Apply field-level RBAC to each item
        const sanitized = items.map((item: any) =>
          this.applyFieldReadPerms(item, user),
        );

        trace.skipStage('validation', 'not applicable to list');
        trace.skipStage('afterHook', 'not applicable to list');
        trace.skipStage('notifications', 'not applicable to list');

        trace.startStage('response');
        const response = {
          data: sanitized,
          meta: {
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum),
          },
        };
        trace.endStage('response', 'pass', {
          fieldsStripped: [],
          rowLevelFilterApplied: Object.keys(where).length > 0,
        });

        trace.finish();
        this.attachTrace(res, trace);
        return response;
      }

      // ─── GET /:id ───────────────────────────────────────
      @Get(':id')
      @Roles(...readRoles)
      async findOne(
        @Param('id') id: string,
        @Query('include') includeParam?: string,
        @Req() req?: Request,
        @Res({ passthrough: true }) res?: Response,
      ) {
        const numericId = parseId(id);
        if (!Number.isFinite(numericId)) {
          throw new BadRequestException(`Invalid ID: "${id}" must be a number`);
        }
        const user = (req?.user as AuthenticatedUser) || null;
        const trace = new TraceBuilder(
          resourceName,
          'read',
          user ? { id: user.id, role: user.role?.name || '' } : null,
          this.logger,
          isDev,
        );

        trace.startStage('auth');
        trace.endStage('auth', 'pass', {
          guard: 'jwt',
          rolesChecked: readRoles,
        });

        trace.startStage('db');
        const where = this.applyRowLevelFilter(user, { id: Number(id) });
        // Includes — validated against includeable fields
        const relations = includeParam
          ? ControllerFactory.parseIncludes(includeParam, spec)
          : [];
        const findOneOpts: FindOneOptions = { where };
        if (relations.length > 0) {
          (findOneOpts as any).relations = relations.reduce(
            (acc, name) => ({ ...acc, [name]: true }),
            {} as Record<string, boolean>,
          );
        }
        const entity = await this.repository.findOne(findOneOpts);
        trace.endStage('db', 'pass', {
          operation: 'SELECT',
          table: spec.table,
          found: !!entity,
        });

        if (!entity) {
          trace.finish();
          this.attachTrace(res, trace);
          throw new NotFoundException(`${displayName} with ID ${id} not found`);
        }

        trace.skipStage('validation', 'not applicable to read');
        trace.skipStage('beforeHook', 'not applicable to read');
        trace.skipStage('afterHook', 'not applicable to read');
        trace.skipStage('notifications', 'not applicable to read');

        trace.startStage('response');
        // Resolve computed fields before applying read permissions, so
        // computed values appear in the read response and are subject to
        // field-level read RBAC like any stored field.
        let entityForResponse: Record<string, unknown> = entity;
        if (spec.fields.some((f) => f.type === 'computed')) {
          const ctx = this.buildContext(user, 'read', trace);
          entityForResponse = await ComputedFieldResolver.resolve(
            entity,
            spec,
            ctx,
          ).catch((err: unknown) => {
            this.logger.debug(
              `Computed field resolution failed for ${resourceName}#${id}: ${(err as Error).message}`,
            );
            return entity as Record<string, unknown>;
          });
        }
        const sanitized = this.applyFieldReadPerms(entityForResponse, user);
        trace.endStage('response', 'pass');

        trace.finish();
        this.attachTrace(res, trace);
        return sanitized;
      }

      // ─── POST / ─────────────────────────────────────────
      @Post()
      @HttpCode(HttpStatus.CREATED)
      @Roles(...createRoles)
      async create(
        @Body() body: unknown,
        @Req() req?: Request,
        @Res({ passthrough: true }) res?: Response,
      ) {
        const user = (req?.user as AuthenticatedUser) || null;
        const trace = new TraceBuilder(
          resourceName,
          'create',
          user ? { id: user.id, role: user.role?.name || '' } : null,
          this.logger,
          isDev,
        );

        // Stage 1: Auth (already passed via guard)
        trace.startStage('auth');
        trace.endStage('auth', 'pass', {
          guard: 'jwt',
          rolesChecked: createRoles,
        });

        // Stage 2: Validation
        trace.startStage('validation');
        const result = createSchema.safeParse(body);
        if (!result.success) {
          const errors = result.error.issues.map((i) => ({
            field: i.path.join('.'),
            message: i.message,
          }));
          trace.endStage(
            'validation',
            'fail',
            { errors },
            undefined,
            undefined,
            { message: 'Validation failed', code: 'VALIDATION_ERROR' },
          );
          trace.finish();
          this.attachTrace(res, trace);
          throw new BadRequestException({ validation: errors });
        }
        trace.endStage('validation', 'pass', {
          schema: `${resourceName}.create`,
          rulesChecked: spec.fields.length,
        });

        let data = result.data as Record<string, unknown>;

        // Apply field-level write permissions
        data = this.applyFieldWritePerms(data, user);

        // Extract M:N values before creating the entity (not stored on main row)
        const manyToManyValues = this.extractManyToManyValues(data);
        data = this.omitManyToManyFields(data);

        const executeCore = async () => {
          // Stage 3: Before hook
          if (allHooks.beforeCreate) {
            trace.startStage('beforeHook');
            const ctx = this.buildContext(user, 'create', trace);
            const hookResult = await hookExecutor.executeBeforeHook(
              allHooks.beforeCreate,
              data,
              ctx,
              trace,
            );
            if (!hookResult.proceed) {
              trace.endStage('beforeHook', 'fail', {
                proceed: false,
                error: 'Hook aborted',
              });
              return {
                aborted: true,
                error: hookResult.error || 'Hook aborted the operation',
              };
            }
            data = this.sanitizeHookOutput(hookResult.data);
          } else {
            trace.skipStage('beforeHook', 'no beforeCreate hook defined');
          }

          // Stage 4: DB operation
          trace.startStage('db');
          let saved: any;
          try {
            const repo = this.getRepositoryForOperation();
            const entity = repo.create(data);
            saved = await repo.save(entity);
            trace.endStage('db', 'pass', {
              operation: 'INSERT',
              table: spec.table,
              id: saved.id,
            });
          } catch (err) {
            trace.endStage('db', 'fail', { error: (err as Error).message });
            throw err;
          }

          // Stage 5: After hook (inside transaction)
          if (allHooks.afterCreate) {
            trace.startStage('afterHook');
            const ctx = this.buildContext(user, 'create', trace);
            await hookExecutor.executeAfterHook(
              allHooks.afterCreate,
              saved,
              ctx,
              trace,
            );
          } else {
            trace.skipStage('afterHook', 'no afterCreate hook defined');
          }

          return { saved };
        };

        let saved: any;
        if (isTransactional) {
          try {
            const outcome = await this.getDataSource().transaction(
              async (manager: any) => {
                this.setTransactionManager(manager);
                const result = await executeCore();
                if ('aborted' in result) {
                  throw new HookAbortError(
                    result.error || 'Hook aborted the operation',
                    400,
                  );
                }
                await this.syncManyToManyRelations(
                  result.saved,
                  manyToManyValues,
                  'create',
                );
                return result.saved;
              },
            );
            saved = outcome;
          } catch (err) {
            if (err instanceof HookAbortError) {
              trace.finish();
              this.attachTrace(res, trace);
              return { error: err.message };
            }
            trace.endStage('db', 'fail', { error: (err as Error).message });
            trace.finish();
            this.attachTrace(res, trace);
            throw err;
          } finally {
            this.clearTransactionManager();
          }
        } else {
          const outcome = await executeCore();
          if ('aborted' in outcome) {
            trace.finish();
            this.attachTrace(res, trace);
            return { error: outcome.error };
          }
          saved = outcome.saved;
          await this.syncManyToManyRelations(saved, manyToManyValues, 'create');
        }

        // Outbound webhooks + scheduled actions (fire-and-forget)
        this.afterEntityCreate(saved, spec, user, trace);

        // Stage 6: Notifications (outside transaction)
        if (notifications.length > 0) {
          trace.startStage('notifications');
          const ctx = this.buildContext(user, 'create', trace);
          // Load entity with relations so notification templates can access ${entity.assignee.email}
          const entityForNotifications = await this.loadForNotifications(
            saved,
            spec,
          );
          const summary = await notificationDispatcher.dispatch({
            notifications,
            operation: 'afterCreate',
            entity: entityForNotifications,
            ctx,
            extensionDir,
            appConfig: getAppConfig(),
          });
          trace.endStage(
            'notifications',
            'pass',
            summary as unknown as Record<string, unknown>,
          );
        } else {
          trace.skipStage('notifications', 'no notifications defined');
        }

        // Stage 7: Response
        trace.startStage('response');
        const sanitized = this.applyFieldReadPerms(saved, user);
        trace.endStage('response', 'pass');

        trace.finish();
        this.attachTrace(res, trace);
        return sanitized;
      }

      // ─── PATCH /:id ─────────────────────────────────────
      @Patch(':id')
      @Roles(...updateRoles)
      async update(
        @Param('id') id: string,
        @Body() body: unknown,
        @Req() req?: Request,
        @Res({ passthrough: true }) res?: Response,
      ) {
        const numericId = parseId(id);
        if (!Number.isFinite(numericId)) {
          throw new BadRequestException(`Invalid ID: "${id}" must be a number`);
        }
        const user = (req?.user as AuthenticatedUser) || null;
        const trace = new TraceBuilder(
          resourceName,
          'update',
          user ? { id: user.id, role: user.role?.name || '' } : null,
          this.logger,
          isDev,
        );

        trace.startStage('auth');
        trace.endStage('auth', 'pass', {
          guard: 'jwt',
          rolesChecked: updateRoles,
        });

        // Stage 2: Validation
        trace.startStage('validation');
        const result = updateSchema.safeParse(body);
        if (!result.success) {
          const errors = result.error.issues.map((i) => ({
            field: i.path.join('.'),
            message: i.message,
          }));
          trace.endStage('validation', 'fail', { errors });
          trace.finish();
          this.attachTrace(res, trace);
          throw new BadRequestException({ validation: errors });
        }
        trace.endStage('validation', 'pass', {
          schema: `${resourceName}.update`,
        });

        let data = result.data as Record<string, unknown>;

        // Apply field-level write permissions
        data = this.applyFieldWritePerms(data, user);

        // Extract M:N values before updating the entity (not stored on main row)
        const manyToManyValues = this.extractManyToManyValues(data);
        data = this.omitManyToManyFields(data);

        const executeCore = async () => {
          // Stage 3: Before hook
          if (allHooks.beforeUpdate) {
            trace.startStage('beforeHook');
            const ctx = this.buildContext(user, 'update', trace);
            const hookResult = await hookExecutor.executeBeforeHook(
              allHooks.beforeUpdate,
              data,
              ctx,
              trace,
            );
            if (!hookResult.proceed) {
              trace.endStage('beforeHook', 'fail', {
                proceed: false,
                error: 'Hook aborted',
              });
              return {
                aborted: true,
                error: hookResult.error || 'Hook aborted the operation',
              };
            }
            data = this.sanitizeHookOutput(hookResult.data);
          } else {
            trace.skipStage('beforeHook', 'no beforeUpdate hook defined');
          }

          // Stage 4: DB
          trace.startStage('db');
          const where = this.applyRowLevelFilter(user, { id: numericId });
          const repo = this.getRepositoryForOperation();
          const existing = await repo.findOne({ where });
          if (!existing) {
            trace.endStage('db', 'fail', { error: 'Not found' });
            throw new NotFoundException(
              `${displayName} with ID ${id} not found`,
            );
          }

          // State machine validation — if any field being updated has a
          // stateMachine, validate the transition from the current value to
          // the new value before mutating the database.
          const roleName = user
            ? this.roleIdToName(user.role?.id)
            : '__denied__';
          for (const f of spec.fields) {
            if (!f.stateMachine) continue;
            const newValue = data[f.name];
            if (newValue === undefined) continue;
            const from = String(existing[f.name]);
            const to = String(newValue);
            if (from === to) continue; // no transition requested
            const outcome = StateMachineValidator.validateTransition(
              spec,
              f,
              from,
              to,
              roleName,
            );
            if (!outcome.valid) {
              trace.endStage('db', 'fail', { error: outcome.error });
              throw new BadRequestException(outcome.error);
            }
          }

          let saved: any;
          try {
            await repo.update(numericId, data);
            // Reload to get the updated entity for response
            saved = await repo.findOne({ where });
            if (!saved) {
              trace.endStage('db', 'fail', { error: 'Not found after update' });
              throw new NotFoundException(
                `${displayName} with ID ${id} not found after update`,
              );
            }
            trace.endStage('db', 'pass', {
              operation: 'UPDATE',
              table: spec.table,
              id: numericId,
            });
          } catch (err) {
            trace.endStage('db', 'fail', { error: (err as Error).message });
            throw err;
          }

          // Audit log — fire-and-forget at the call site
          this.maybeAudit(existing, data, spec, user).catch((err: unknown) => {
            this.logger.debug(
              `Audit log error swallowed: ${(err as Error).message}`,
            );
          });

          // Stage 5: After hook (inside transaction)
          if (allHooks.afterUpdate) {
            trace.startStage('afterHook');
            const ctx = this.buildContext(user, 'update', trace);
            await hookExecutor.executeAfterHook(
              allHooks.afterUpdate,
              saved,
              ctx,
              trace,
            );
          } else {
            trace.skipStage('afterHook', 'no afterUpdate hook defined');
          }

          return { saved };
        };

        let saved: any;
        if (isTransactional) {
          try {
            const outcome = await this.getDataSource().transaction(
              async (manager: any) => {
                this.setTransactionManager(manager);
                const result = await executeCore();
                if ('aborted' in result) {
                  throw new HookAbortError(
                    result.error || 'Hook aborted the operation',
                    400,
                  );
                }
                if (
                  manyToManyValues &&
                  Object.keys(manyToManyValues).length > 0
                ) {
                  await this.syncManyToManyRelations(
                    result.saved,
                    manyToManyValues,
                    'update',
                  );
                }
                return result.saved;
              },
            );
            saved = outcome;
          } catch (err) {
            if (err instanceof HookAbortError) {
              trace.finish();
              this.attachTrace(res, trace);
              return { error: err.message };
            }
            trace.endStage('db', 'fail', { error: (err as Error).message });
            trace.finish();
            this.attachTrace(res, trace);
            throw err;
          } finally {
            this.clearTransactionManager();
          }
        } else {
          const outcome = await executeCore();
          if ('aborted' in outcome) {
            trace.finish();
            this.attachTrace(res, trace);
            return { error: outcome.error };
          }
          saved = outcome.saved;
          if (manyToManyValues && Object.keys(manyToManyValues).length > 0) {
            await this.syncManyToManyRelations(
              saved,
              manyToManyValues,
              'update',
            );
          }
        }

        // Outbound webhooks + reschedule scheduled actions (fire-and-forget)
        this.afterEntityUpdate(saved, spec, user, trace);

        // Stage 6: Notifications (outside transaction)
        if (notifications.length > 0) {
          trace.startStage('notifications');
          const ctx = this.buildContext(user, 'update', trace);
          const entityForNotifications = await this.loadForNotifications(
            saved,
            spec,
          );
          const summary = await notificationDispatcher.dispatch({
            notifications,
            operation: 'afterUpdate',
            entity: entityForNotifications,
            ctx,
            extensionDir,
            appConfig: getAppConfig(),
          });
          trace.endStage(
            'notifications',
            'pass',
            summary as unknown as Record<string, unknown>,
          );
        } else {
          trace.skipStage('notifications', 'no notifications defined');
        }

        // Stage 7: Response
        trace.startStage('response');
        // Resolve computed fields before field-level read permissions are
        // applied so that computed values are included in the response and
        // can be filtered by read perms just like stored fields.
        let entityForResponse: Record<string, unknown> = saved;
        if (spec.fields.some((f) => f.type === 'computed')) {
          const ctx = this.buildContext(user, 'update', trace);
          entityForResponse = await ComputedFieldResolver.resolve(
            saved,
            spec,
            ctx,
          ).catch((err: unknown) => {
            this.logger.debug(
              `Computed field resolution failed for ${resourceName}#${numericId}: ${(err as Error).message}`,
            );
            return saved as Record<string, unknown>;
          });
        }
        const sanitized = this.applyFieldReadPerms(entityForResponse, user);
        trace.endStage('response', 'pass');

        trace.finish();
        this.attachTrace(res, trace);
        return sanitized;
      }

      // ─── DELETE /:id ────────────────────────────────────
      @Delete(':id')
      @HttpCode(HttpStatus.NO_CONTENT)
      @Roles(...deleteRoles)
      async remove(
        @Param('id') id: string,
        @Req() req?: Request,
        @Res({ passthrough: true }) res?: Response,
      ) {
        const numericId = parseId(id);
        if (!Number.isFinite(numericId)) {
          throw new BadRequestException(`Invalid ID: "${id}" must be a number`);
        }
        const user = (req?.user as AuthenticatedUser) || null;
        const trace = new TraceBuilder(
          resourceName,
          'delete',
          user ? { id: user.id, role: user.role?.name || '' } : null,
          this.logger,
          isDev,
        );

        trace.startStage('auth');
        trace.endStage('auth', 'pass', {
          guard: 'jwt',
          rolesChecked: deleteRoles,
        });

        const executeCore = async () => {
          trace.startStage('db');
          const where = this.applyRowLevelFilter(user, { id: numericId });
          const repo = this.getRepositoryForOperation();
          const entity = await repo.findOne({ where });
          if (!entity) {
            trace.endStage('db', 'fail', { error: 'Not found' });
            throw new NotFoundException(
              `${displayName} with ID ${id} not found`,
            );
          }
          trace.endStage('db', 'pass', {
            operation: 'SELECT',
            table: spec.table,
            id,
          });

          // Before delete hook
          if (allHooks.beforeDelete) {
            trace.startStage('beforeHook');
            const ctx = this.buildContext(user, 'delete', trace);
            await hookExecutor.executeBeforeHook(
              allHooks.beforeDelete,
              entity as Record<string, unknown>,
              ctx,
              trace,
            );
          } else {
            trace.skipStage('beforeHook', 'no beforeDelete hook defined');
          }

          await repo.softDelete(where);

          if (allHooks.afterDelete) {
            trace.startStage('afterHook');
            const ctx = this.buildContext(user, 'delete', trace);
            await hookExecutor.executeAfterHook(
              allHooks.afterDelete,
              entity,
              ctx,
              trace,
            );
          } else {
            trace.skipStage('afterHook', 'no afterDelete hook defined');
          }

          return entity;
        };

        let entity: any;
        if (isTransactional) {
          try {
            entity = await this.getDataSource().transaction(
              async (manager: any) => {
                this.setTransactionManager(manager);
                return executeCore();
              },
            );
          } catch (err) {
            trace.endStage('db', 'fail', { error: (err as Error).message });
            trace.finish();
            this.attachTrace(res, trace);
            throw err;
          } finally {
            this.clearTransactionManager();
          }
        } else {
          entity = await executeCore();
        }

        // Outbound webhooks (fire-and-forget)
        this.afterEntityDelete(
          entity as Record<string, unknown>,
          spec,
          user,
          trace,
        );

        // Notifications (outside transaction)
        if (notifications.length > 0) {
          trace.startStage('notifications');
          const ctx = this.buildContext(user, 'delete', trace);
          const entityForNotifications = await this.loadForNotifications(
            entity,
            spec,
          );
          const summary = await notificationDispatcher.dispatch({
            notifications,
            operation: 'afterDelete',
            entity: entityForNotifications,
            ctx,
            extensionDir,
            appConfig: getAppConfig(),
          });
          trace.endStage(
            'notifications',
            'pass',
            summary as unknown as Record<string, unknown>,
          );
        } else {
          trace.skipStage('notifications', 'no notifications defined');
        }

        trace.startStage('response');
        trace.endStage('response', 'pass', { statusCode: 204 });

        trace.finish();
        this.attachTrace(res, trace);
      }

      // ─── Helper: load entity with relations for notifications ──
      private async loadForNotifications(
        entity: any,
        spec: ResourceSpec,
      ): Promise<Record<string, unknown>> {
        // Collect ref field names for relation loading
        const refFields = spec.fields
          .filter((f) => f.type === 'ref')
          .map((f) => f.name.replace(/Id$/, ''));

        if (refFields.length === 0) return entity;

        try {
          // Reload with relations populated
          const loaded = await this.repository.findOne({
            where: { id: entity.id },
            relations: refFields.reduce(
              (acc, name) => ({ ...acc, [name]: true }),
              {},
            ),
          });
          return loaded || entity;
        } catch {
          // If relation loading fails (e.g. target entity not registered),
          // return the original entity — notification interpolation will
          // gracefully handle missing fields
          return entity;
        }
      }

      // ─── Helper: audit log changed fields ─────────────────
      /**
       * If spec.audit is enabled, compare old vs new values for the fields
       * present in `newValues` and write one audit row per changed field via
       * SpecAuditLogger. Respects AuditSpec.fields (allow-list) and
       * AuditSpec.exclude (deny-list). Fire-and-forget at the call site.
       */
      private async maybeAudit(
        existing: Record<string, unknown>,
        newValues: Record<string, unknown>,
        spec: ResourceSpec,
        user: AuthenticatedUser | null,
      ): Promise<void> {
        if (!spec.audit) return;

        // Resolve the audit logger lazily from the DI container via the
        // boot service's ModuleRef. If it isn't available, silently bail.
        let auditLogger: SpecAuditLogger | null = null;
        try {
          const moduleRef = SpecEngineBootService.getModuleRef();
          auditLogger = moduleRef.get(SpecAuditLogger, { strict: false });
        } catch {
          return; // SpecAuditLogger not registered — auditing disabled.
        }
        if (!auditLogger) return;

        // Determine which fields to audit.
        const auditSpec = spec.audit === true ? {} : spec.audit;
        const allowedFields = auditSpec.fields
          ? new Set(auditSpec.fields)
          : null;
        const excludeFields = auditSpec.exclude
          ? new Set(auditSpec.exclude)
          : new Set<string>();

        const entityId = Number((existing as any).id);
        const userId = user ? user.id : null;

        for (const [field, newValue] of Object.entries(newValues)) {
          // Skip fields not in the allow-list (if defined).
          if (allowedFields && !allowedFields.has(field)) continue;
          // Skip excluded fields.
          if (excludeFields.has(field)) continue;
          // Skip 'id' — it never changes on update.
          if (field === 'id') continue;

          const oldValue = (existing as any)[field];
          // Only audit fields that actually changed.
          if (this.valuesEqual(oldValue, newValue)) continue;

          auditLogger
            .log({
              resource: resourceName,
              entityId,
              operation: 'update',
              field,
              oldValue,
              newValue,
              userId,
            })
            .catch((err: unknown) => {
              this.logger.debug(
                `Audit log write failed for ${resourceName}#${entityId}/${field}: ${(err as Error).message}`,
              );
            });
        }
      }

      /**
       * Loose equality for audit comparison — mirrors the semantics used by
       * the notification `when` parser (null/undefined treated as equal,
       * everything else stringified for comparison).
       */
      private valuesEqual(a: unknown, b: unknown): boolean {
        if (a == null && b == null) return true;
        if (a == null || b == null) return false;
        return String(a) === String(b);
      }

      // ─── Helper: outbound webhooks + scheduled actions ─────────────────
      /**
       * Fire outbound webhooks for an entity event, and schedule any
       * entity-level scheduled actions. Fire-and-forget: never throws.
       */
      private async dispatchOutboundAndScheduled(
        event: string,
        entity: Record<string, unknown>,
        spec: ResourceSpec,
        user: AuthenticatedUser | null,
        trace: TraceBuilder,
        scheduleActions: boolean,
      ): Promise<void> {
        const ctx = this.buildContext(user, event, trace);
        // Outbound webhooks
        if (spec.outboundWebhooks && spec.outboundWebhooks.length > 0) {
          OutboundWebhookDispatcher.dispatch({
            webhooks: spec.outboundWebhooks,
            event,
            entity,
            ctx,
          }).catch((err: unknown) => {
            this.logger.debug(
              `Outbound webhook dispatch error swallowed: ${(err as Error).message}`,
            );
          });
        }
        // Scheduled actions (entity-level delayed jobs)
        if (
          scheduleActions &&
          spec.scheduledActions &&
          spec.scheduledActions.length > 0
        ) {
          for (const action of spec.scheduledActions) {
            SpecScheduledActionManager.schedule({
              entity,
              spec,
              action,
              ctx,
            }).catch((err: unknown) => {
              this.logger.debug(
                `Scheduled action "${action.name}" error swallowed: ${(err as Error).message}`,
              );
            });
          }
        }
      }

      private afterEntityCreate(
        entity: Record<string, unknown>,
        spec: ResourceSpec,
        user: AuthenticatedUser | null,
        trace: TraceBuilder,
      ): void {
        void this.dispatchOutboundAndScheduled(
          `${spec.name}.created`,
          entity,
          spec,
          user,
          trace,
          true,
        );
      }

      private afterEntityUpdate(
        entity: Record<string, unknown>,
        spec: ResourceSpec,
        user: AuthenticatedUser | null,
        trace: TraceBuilder,
      ): void {
        void this.dispatchOutboundAndScheduled(
          `${spec.name}.updated`,
          entity,
          spec,
          user,
          trace,
          true,
        );
      }

      private afterEntityDelete(
        entity: Record<string, unknown>,
        spec: ResourceSpec,
        user: AuthenticatedUser | null,
        trace: TraceBuilder,
      ): void {
        void this.dispatchOutboundAndScheduled(
          `${spec.name}.deleted`,
          entity,
          spec,
          user,
          trace,
          false,
        );
      }

      // ─── Helper: attach trace to response ───────────────
      private attachTrace(
        res: Response | undefined,
        trace: TraceBuilder,
      ): void {
        if (!res || !trace.isActive()) return;
        try {
          res.setHeader('X-Spec-Trace', trace.toBase64());
        } catch {
          // Response already sent — ignore
        }
      }
    }

    // Give the dynamic class a useful name
    Object.defineProperty(SpecDynamicController, 'name', {
      value: `${this.pascalCase(resourceName)}SpecController`,
    });

    return {
      controllerClass: SpecDynamicController,
      entitySchemaName,
    };
  }

  /**
   * Parse `?filter[field]=value` query params into a TypeORM `where` fragment.
   *
   * Only scalar fields (string/text/integer/decimal/boolean/datetime/date/enum)
   * are accepted as filter targets; ref / many-to-many / computed / file fields
   * are excluded. Unknown filter field names are silently ignored (defense-in-
   * depth against SQL injection, since field names are never interpolated into
   * raw SQL).
   *
   * A comma-separated value (e.g. `?status=open,closed`) becomes an `In (...)`
   * clause via TypeORM's FindOperator.
   */
  private static parseFilters(
    query: Record<string, unknown>,
    spec: ResourceSpec,
  ): Record<string, unknown> {
    const filterParam = query['filter'];
    if (!filterParam || typeof filterParam !== 'object') return {};

    const filters = filterParam as Record<string, string>;
    const SCALAR_TYPES = new Set([
      'string',
      'text',
      'integer',
      'decimal',
      'boolean',
      'datetime',
      'date',
      'enum',
    ]);
    const filterable = new Set(
      spec.fields
        .filter((f) => SCALAR_TYPES.has(f.type))
        .map((f) => f.name),
    );

    const result: Record<string, unknown> = {};
    for (const [field, value] of Object.entries(filters)) {
      if (!filterable.has(field)) continue;
      if (typeof value !== 'string' || value.length === 0) continue;
      const parts = value
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
      if (parts.length === 0) continue;
      if (parts.length === 1) {
        result[field] = parts[0];
      } else {
        // Use a simple In operator via TypeORM FindOperator
        const { In } = require('typeorm');
        result[field] = In(parts);
      }
    }
    return result;
  }

  /**
   * Parse `?sort=-field1,field2` into a TypeORM `order` fragment.
   *
   * Only scalar fields (string/text/integer/decimal/boolean/datetime/date/enum)
   * can be sorted. A `-` prefix means DESC, otherwise ASC. Unknown field names
   * are ignored.
   */
  private static parseSort(
    sortParam: string,
    spec: ResourceSpec,
  ): Record<string, 'ASC' | 'DESC'> {
    if (!sortParam || typeof sortParam !== 'string') return {};
    const SCALAR_TYPES = new Set([
      'string',
      'text',
      'integer',
      'decimal',
      'boolean',
      'datetime',
      'date',
      'enum',
    ]);
    const sortable = new Set(
      spec.fields
        .filter((f) => SCALAR_TYPES.has(f.type))
        .map((f) => f.name),
    );
    const result: Record<string, 'ASC' | 'DESC'> = {};
    for (const raw of sortParam.split(',')) {
      const token = raw.trim();
      if (!token) continue;
      const desc = token.startsWith('-');
      const field = desc ? token.slice(1) : token;
      if (!sortable.has(field)) continue;
      result[field] = desc ? 'DESC' : 'ASC';
    }
    return result;
  }

  /**
   * Parse `?include=assignee,comments` into a list of relation names to load.
   *
   * Only relations for fields with `includeable: true` can be included.
   * The relation name is derived from the field name by stripping a trailing
   * `Id` suffix (e.g. `assigneeId` → `assignee`), mirroring loadForNotifications.
   */
  private static parseIncludes(
    includeParam: string,
    spec: ResourceSpec,
  ): string[] {
    if (!includeParam || typeof includeParam !== 'string') return [];
    const includeable = spec.fields.filter((f) => f.includeable);
    // Build a lookup from both the raw field name and the relation name
    // (field name without trailing `Id`) so callers can request either form.
    const allowed = new Set<string>();
    for (const f of includeable) {
      allowed.add(f.name);
      const rel = f.name.replace(/Id$/, '');
      if (rel !== f.name) allowed.add(rel);
    }
    const result: string[] = [];
    for (const raw of includeParam.split(',')) {
      const token = raw.trim();
      if (!token) continue;
      if (!allowed.has(token)) continue;
      // Always use the relation name (without `Id`) for TypeORM
      result.push(token.replace(/Id$/, ''));
    }
    // De-duplicate while preserving order without relying on Set iteration
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const r of result) {
      if (!seen.has(r)) {
        seen.add(r);
        unique.push(r);
      }
    }
    return unique;
  }

  /**
   * Convert permission role names to RoleEnum values.
   * Uses RoleRegistry so custom roles (manager) resolve to their DB id.
   */
  private static resolveRoles(roles: PermissionRole[]): number[] {
    const out: number[] = [];
    for (const r of roles) {
      const id = RoleRegistry.resolveId(r);
      if (id !== null) out.push(id);
    }
    return out;
  }

  /**
   * Simple pluralization
   */
  private static pluralize(name: string): string {
    if (name.endsWith('s')) return name;
    if (name.endsWith('y')) return name.slice(0, -1) + 'ies';
    if (name.endsWith('ch') || name.endsWith('sh') || name.endsWith('x')) {
      return name + 'es';
    }
    return name + 's';
  }

  /**
   * Convert kebab-case or snake_case to PascalCase
   */
  private static pascalCase(name: string): string {
    return name
      .split(/[-_]/)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join('');
  }
}
