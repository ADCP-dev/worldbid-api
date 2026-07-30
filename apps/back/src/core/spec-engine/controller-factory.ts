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
import { Repository, FindManyOptions } from 'typeorm';
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
} from './spec.types';
import { HookAbortError } from './spec.types';
import { ValidationFactory } from './validation-factory';
import { TraceBuilder } from './spec-trace';
import { HookExecutor, LoadedHook } from './hook-executor';
import { NotificationDispatcher } from './notification-dispatcher';
import { HookContextImpl } from './hook-context';
import { SpecEngineBootService } from './spec-engine-boot';

// Role name → RoleEnum value map
const ROLE_MAP: Record<PermissionRole, number | null> = {
  admin: RoleEnum.admin,
  customer: RoleEnum.customer,
  affiliate: RoleEnum.affiliate,
  public: null,
};


// Free function for role resolution (used inside dynamic controller class)
function resolveRolesArray(roles: PermissionRole[]): number[] {
  return roles
    .map((r) => ROLE_MAP[r])
    .filter((r): r is number => r !== null);
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
  entitySchemaName: string;
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
}

export class ControllerFactory {
  /**
   * Build a dynamic controller class with the full 7-stage pipeline.
   */
  static create(params: ControllerFactoryParams): MaterializedController {
    const {
      spec,
      entitySchemaName,
      extensionDir,
      hookExecutor,
      notificationDispatcher,
      isDev,
      allHooks,
    } = params;

    const resourceName = spec.name;
    const displayName = spec.displayName || resourceName;
    const routePath = this.pluralize(resourceName);
    const createSchema = ValidationFactory.createCreateSchema(spec);
    const updateSchema = ValidationFactory.createUpdateSchema(spec);
    const diToken = getRepositoryToken(entitySchemaName as any);

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
        notificationEmail: cs.get('app.notificationEmail', { infer: true }) || '',
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

      // ─── Helper: build HookContext ──────────────────────
      private buildContext(
        user: AuthenticatedUser | null,
        operation: string,
        trace: TraceBuilder,
      ): HookContext {
        return new HookContextImpl(
          SpecEngineBootService.getModuleRef(),
          SpecEngineBootService.getConfigService(),
          user,
          resourceName,
          operation,
          trace,
        ) as unknown as HookContext;
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
        this.logger.warn(`Row-level filter "${rule.filter}" could not be parsed — denying all rows`);
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
        switch (roleId) {
          case RoleEnum.admin: return 'admin';
          case RoleEnum.customer: return 'customer';
          case RoleEnum.affiliate: return 'affiliate';
          default: return '__denied__'; // Fail closed for unknown roles
        }
      }

      // ─── GET / ──────────────────────────────────────────
      @Get()
      @Roles(...listRoles)
      async findAll(
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Req() req?: Request,
        @Res({ passthrough: true }) res?: Response,
      ) {
        const user = (req?.user as AuthenticatedUser) || null;
        const trace = new TraceBuilder(resourceName, 'list', user ? { id: user.id, role: user.role?.name || '' } : null, this.logger, isDev);

        trace.startStage('auth');
        trace.endStage('auth', 'pass', { guard: 'jwt', rolesChecked: listRoles });

        trace.startStage('db');
        const pageNum = page && Number.isFinite(Number(page)) ? Math.max(1, Math.floor(Number(page))) : 1;
        const limitNum = limit && Number.isFinite(Number(limit)) ? Math.max(1, Math.min(100, Math.floor(Number(limit)))) : 20;
        const skip = (pageNum - 1) * limitNum;

        const where = this.applyRowLevelFilter(user, {});

        // beforeQuery hook — allows complex query modification (joins, extra WHERE, relations)
        let queryOptions: FindManyOptions = {
          skip,
          take: limitNum,
          where,
          order: { id: 'DESC' as any },
          withDeleted: false,
        };

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

        trace.endStage('db', 'pass', { operation: 'SELECT', table: spec.table, count: items.length });

        // Apply field-level RBAC to each item
        const sanitized = items.map((item: any) => this.applyFieldReadPerms(item, user));

        trace.skipStage('validation', 'not applicable to list');
        trace.skipStage('afterHook', 'not applicable to list');
        trace.skipStage('notifications', 'not applicable to list');

        trace.startStage('response');
        const response = {
          data: sanitized,
          meta: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
        };
        trace.endStage('response', 'pass', { fieldsStripped: [], rowLevelFilterApplied: Object.keys(where).length > 1 });

        trace.finish();
        this.attachTrace(res, trace);
        return response;
      }

      // ─── GET /:id ───────────────────────────────────────
      @Get(':id')
      @Roles(...readRoles)
      async findOne(
        @Param('id') id: string,
        @Req() req?: Request,
        @Res({ passthrough: true }) res?: Response,
      ) {
        const numericId = parseId(id);
        if (!Number.isFinite(numericId)) {
          throw new BadRequestException(`Invalid ID: "${id}" must be a number`);
        }
        const user = (req?.user as AuthenticatedUser) || null;
        const trace = new TraceBuilder(resourceName, 'read', user ? { id: user.id, role: user.role?.name || '' } : null, this.logger, isDev);

        trace.startStage('auth');
        trace.endStage('auth', 'pass', { guard: 'jwt', rolesChecked: readRoles });

        trace.startStage('db');
        const where = this.applyRowLevelFilter(user, { id: Number(id) });
        const entity = await this.repository.findOne({ where });
        trace.endStage('db', 'pass', { operation: 'SELECT', table: spec.table, found: !!entity });

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
        const sanitized = this.applyFieldReadPerms(entity, user);
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
        const trace = new TraceBuilder(resourceName, 'create', user ? { id: user.id, role: user.role?.name || '' } : null, this.logger, isDev);

        // Stage 1: Auth (already passed via guard)
        trace.startStage('auth');
        trace.endStage('auth', 'pass', { guard: 'jwt', rolesChecked: createRoles });

        // Stage 2: Validation
        trace.startStage('validation');
        const result = createSchema.safeParse(body);
        if (!result.success) {
          const errors = result.error.issues.map((i) => ({
            field: i.path.join('.'),
            message: i.message,
          }));
          trace.endStage('validation', 'fail', { errors }, undefined, undefined, { message: 'Validation failed', code: 'VALIDATION_ERROR' });
          trace.finish();
          this.attachTrace(res, trace);
          throw new BadRequestException({ validation: errors });
        }
        trace.endStage('validation', 'pass', { schema: `${resourceName}.create`, rulesChecked: spec.fields.length });

        let data = result.data as Record<string, unknown>;

    // Apply field-level write permissions
    data = this.applyFieldWritePerms(data, user);

        // Stage 3: Before hook
        if (allHooks.beforeCreate) {
          trace.startStage('beforeHook');
          const ctx = this.buildContext(user, 'create', trace);
          const hookResult = await hookExecutor.executeBeforeHook(allHooks.beforeCreate, data, ctx, trace);
          data = hookResult.data;
        } else {
          trace.skipStage('beforeHook', 'no beforeCreate hook defined');
        }

        // Stage 4: DB operation
        trace.startStage('db');
        let saved: any;
        try {
          const entity = this.repository.create(data);
          saved = await this.repository.save(entity);
          trace.endStage('db', 'pass', { operation: 'INSERT', table: spec.table, id: saved.id });
        } catch (err) {
          trace.endStage('db', 'fail', { error: (err as Error).message });
          trace.finish();
          this.attachTrace(res, trace);
          throw err;
        }

        // Stage 5: After hook (fire-and-forget)
        if (allHooks.afterCreate) {
          trace.startStage('afterHook');
          const ctx = this.buildContext(user, 'create', trace);
          hookExecutor.executeAfterHook(allHooks.afterCreate, saved, ctx, trace).catch(() => {});
        } else {
          trace.skipStage('afterHook', 'no afterCreate hook defined');
        }

        // Stage 6: Notifications
        if (notifications.length > 0) {
          trace.startStage('notifications');
          const ctx = this.buildContext(user, 'create', trace);
          // Load entity with relations so notification templates can access ${entity.assignee.email}
          const entityForNotifications = await this.loadForNotifications(saved, spec);
          const summary = await notificationDispatcher.dispatch({
            notifications,
            operation: 'afterCreate',
            entity: entityForNotifications,
            ctx,
            extensionDir,
            appConfig: getAppConfig(),
          });
          trace.endStage('notifications', 'pass', summary as unknown as Record<string, unknown>);
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
        const trace = new TraceBuilder(resourceName, 'update', user ? { id: user.id, role: user.role?.name || '' } : null, this.logger, isDev);

        trace.startStage('auth');
        trace.endStage('auth', 'pass', { guard: 'jwt', rolesChecked: updateRoles });

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
        trace.endStage('validation', 'pass', { schema: `${resourceName}.update` });

        let data = result.data as Record<string, unknown>;

    // Apply field-level write permissions
    data = this.applyFieldWritePerms(data, user);

        // Stage 3: Before hook
        if (allHooks.beforeUpdate) {
          trace.startStage('beforeHook');
          const ctx = this.buildContext(user, 'update', trace);
          const hookResult = await hookExecutor.executeBeforeHook(allHooks.beforeUpdate, data, ctx, trace);
          data = hookResult.data;
        } else {
          trace.skipStage('beforeHook', 'no beforeUpdate hook defined');
        }

        // Stage 4: DB
        trace.startStage('db');
        const where = this.applyRowLevelFilter(user, { id: numericId });
        const existing = await this.repository.findOne({ where });
        if (!existing) {
          trace.endStage('db', 'fail', { error: 'Not found' });
          trace.finish();
          this.attachTrace(res, trace);
          throw new NotFoundException(`${displayName} with ID ${id} not found`);
        }
        Object.assign(existing, data);
        let saved: any;
        try {
          saved = await this.repository.save(existing);
          trace.endStage('db', 'pass', { operation: 'UPDATE', table: spec.table, id: saved.id });
        } catch (err) {
          trace.endStage('db', 'fail', { error: (err as Error).message });
          trace.finish();
          this.attachTrace(res, trace);
          throw err;
        }

        // Stage 5: After hook
        if (allHooks.afterUpdate) {
          trace.startStage('afterHook');
          const ctx = this.buildContext(user, 'update', trace);
          hookExecutor.executeAfterHook(allHooks.afterUpdate, saved, ctx, trace).catch(() => {});
        } else {
          trace.skipStage('afterHook', 'no afterUpdate hook defined');
        }

        // Stage 6: Notifications
        if (notifications.length > 0) {
          trace.startStage('notifications');
          const ctx = this.buildContext(user, 'update', trace);
          const entityForNotifications = await this.loadForNotifications(saved, spec);
          const summary = await notificationDispatcher.dispatch({
            notifications,
            operation: 'afterUpdate',
            entity: entityForNotifications,
            ctx,
            extensionDir,
            appConfig: getAppConfig(),
          });
          trace.endStage('notifications', 'pass', summary as unknown as Record<string, unknown>);
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
        const trace = new TraceBuilder(resourceName, 'delete', user ? { id: user.id, role: user.role?.name || '' } : null, this.logger, isDev);

        trace.startStage('auth');
        trace.endStage('auth', 'pass', { guard: 'jwt', rolesChecked: deleteRoles });

        trace.startStage('db');
        const where = this.applyRowLevelFilter(user, { id: numericId });
        const entity = await this.repository.findOne({ where });
        if (!entity) {
          trace.endStage('db', 'fail', { error: 'Not found' });
          trace.finish();
          this.attachTrace(res, trace);
          throw new NotFoundException(`${displayName} with ID ${id} not found`);
        }
        trace.endStage('db', 'pass', { operation: 'SOFT_DELETE', table: spec.table, id });

        // After hook (before actual delete so entity is available)
        if (allHooks.beforeDelete) {
          trace.startStage('beforeHook');
          const ctx = this.buildContext(user, 'delete', trace);
          await hookExecutor.executeBeforeHook(
            allHooks.beforeDelete,
            entity as Record<string, unknown>,
            ctx,
            trace,
          );
          // proceed check is inside executeBeforeHook — throws if proceed=false
        } else {
          trace.skipStage('beforeHook', 'no beforeDelete hook defined');
        }

        await this.repository.softDelete(where);

        if (allHooks.afterDelete) {
          trace.startStage('afterHook');
          const ctx = this.buildContext(user, 'delete', trace);
          hookExecutor.executeAfterHook(allHooks.afterDelete, entity, ctx, trace).catch(() => {});
        } else {
          trace.skipStage('afterHook', 'no afterDelete hook defined');
        }

        // Notifications
        if (notifications.length > 0) {
          trace.startStage('notifications');
          const ctx = this.buildContext(user, 'delete', trace);
          const entityForNotifications = await this.loadForNotifications(entity, spec);
          const summary = await notificationDispatcher.dispatch({
            notifications,
            operation: 'afterDelete',
            entity: entityForNotifications,
            ctx,
            extensionDir,
            appConfig: getAppConfig(),
          });
          trace.endStage('notifications', 'pass', summary as unknown as Record<string, unknown>);
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
          .filter(f => f.type === 'ref')
          .map(f => f.name.replace(/Id$/, ''));
        
        if (refFields.length === 0) return entity;

        try {
          // Reload with relations populated
          const loaded = await this.repository.findOne({
            where: { id: entity.id },
            relations: refFields.reduce((acc, name) => ({ ...acc, [name]: true }), {}),
          });
          return loaded || entity;
        } catch {
          // If relation loading fails (e.g. target entity not registered),
          // return the original entity — notification interpolation will
          // gracefully handle missing fields
          return entity;
        }
      }

      // ─── Helper: attach trace to response ───────────────
      private attachTrace(res: Response | undefined, trace: TraceBuilder): void {
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
   * Convert permission role names to RoleEnum values
   */
  private static resolveRoles(roles: PermissionRole[]): number[] {
    return roles
      .map((r) => ROLE_MAP[r])
      .filter((r): r is number => r !== null);
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