/**
 * SpecEngineActionFactory — creates dynamic NestJS controllers for custom
 * (non-CRUD) actions declared in `spec.actions[]`.
 *
 * Each action is a POST (or GET/PATCH/DELETE) endpoint at a sub-path of the
 * resource. The handler is a plain function loaded via `require()` at
 * materialization time (same path-containment + .ts→.js pattern as
 * hook-executor / webhook-controller-factory), and receives:
 *
 *   (entityId: number | null, input: Record<string, unknown>, ctx: HookContext)
 *     => Promise<Record<string, unknown>>
 *
 *   - For actions with `:id` in path (row actions): entityId is the URL param.
 *   - For bulk actions without `:id`: entityId is null.
 *
 * Auth: the action's `auth` roles (default: resource create permissions) are
 * applied via the `@Roles` decorator + AuthGuard('jwt') + RolesGuard.
 *
 * Input validation: simple type-checking against `ActionInputSpec`.
 *
 * Tracing: each action invocation is wrapped in a TraceBuilder so dev traces
 * (X-Spec-Trace) are available, mirroring the CRUD controller.
 */
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  Logger,
  Inject,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { EntitySchema, Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as path from 'path';
import type { Request, Response } from 'express';

import { Roles } from '@iam/roles/roles.decorator';
import { RoleEnum } from '@iam/roles/roles.enum';
import { RolesGuard } from '@iam/roles/roles.guard';

import type {
  ActionSpec,
  ActionInputSpec,
  PermissionRole,
  HookContext,
  AuthenticatedUser,
  ResourceSpec,
  FieldType,
} from './spec.types';
import { HookAbortError } from './spec.types';
import { SpecEngineBootService } from './spec-engine-boot';
import { HookContextImpl } from './hook-context';
import { TraceBuilder } from './spec-trace';
import { attachTraceToError } from './error-trace';
import {
  resolveHookModulePath,
  loadExtensionModule,
  extractModuleExport,
} from './extension-module-loader';

/** Signature of an action handler loaded via require(). */
export type ActionHandler = (
  entityId: number | null,
  input: Record<string, unknown>,
  ctx: HookContext,
) => Promise<Record<string, unknown>>;

export interface ActionFactoryResult {
  controllerClass: any;
}

/** Maps PermissionRole → RoleEnum value (null = no auth). */
const ROLE_MAP: Record<PermissionRole, number | null> = {
  admin: RoleEnum.admin,
  customer: RoleEnum.customer,
  user: RoleEnum.customer,
  // Custom roles resolved at runtime
  public: null,
};

function resolveRolesArray(roles: PermissionRole[]): number[] {
  return roles.map((r) => ROLE_MAP[r]).filter((r): r is number => r !== null);
}

export class SpecEngineActionFactory {
  private static readonly logger = new Logger('SpecEngineActionFactory');

  /**
   * Build a single dynamic controller exposing every action in `spec.actions`.
   * All actions are mounted under the resource's pluralized route (same base
   * as the CRUD controller) so URLs like `POST /tasks/:id/assign` work.
   *
   * Returns the controller class to register with the Nest module, or null
   * if the resource has no actions.
   */
  static create(
    spec: ResourceSpec,
    entitySchema: EntitySchema<any>,
    extensionDir: string,
    isDev: boolean,
  ): ActionFactoryResult | null {
    if (!spec.actions || spec.actions.length === 0) return null;

    const resourceName = spec.name;
    const displayName = spec.displayName || resourceName;
    const routePath = this.pluralize(resourceName);
    const diToken = getRepositoryToken(entitySchema);

    // Default auth = resource create permissions (per spec contract)
    const createRoles = spec.permissions?.create || ['admin'];

    // Load + cache all action handlers up front (fail-fast at boot).
    const loadedActions = spec.actions.map((action) => {
      const handler = this.loadActionHandler(
        action,
        extensionDir,
        resourceName,
      );
      return { action, handler };
    });

    @ApiTags(`${displayName}-actions`)
    @ApiBearerAuth()
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Controller({ path: routePath, version: '1' })
    class SpecActionController {
      private readonly logger = new Logger(`SpecActions:${displayName}`);

      constructor(
        @Inject(diToken) private readonly repository: Repository<any>,
      ) {}

      // ─── context builder ──────────────────────────────────────────────
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
        ) as unknown as HookContext & { _resourceRepo?: Repository<any> };

        // Inject the resource's repository so the handler can access it
        // via ctx.getRepository(resourceName) without relying on
        // getRepositoryToken(string) which returns 'undefinedRepository'.
        ctx._resourceRepo = this.repository;

        return ctx;
      }

      // ─── entrypoint dispatcher ────────────────────────────────────────
      // Each registered route method delegates to runAction() so the
      // trace/validation/handler plumbing is shared.
      private async runAction(
        loaded: { action: ActionSpec; handler: ActionHandler | null },
        entityId: number | null,
        input: Record<string, unknown>,
        user: AuthenticatedUser | null,
        res: Response | undefined,
        requestId?: string,
      ): Promise<unknown> {
        const { action, handler } = loaded;
        const trace = new TraceBuilder(
          resourceName,
          'create', // actions reuse the 'create' operation bucket for trace
          user ? { id: user.id, role: user.role?.name || '' } : null,
          this.logger,
          isDev,
          requestId,
        );

        trace.startStage('auth');
        const actionRoles = resolveRolesArray(
          action.auth && action.auth.length > 0 ? action.auth : createRoles,
        );
        trace.endStage('auth', 'pass', {
          guard: 'jwt',
          rolesChecked: actionRoles,
          action: action.name,
        });

        // Validate input against ActionInputSpec (simple type checks).
        trace.startStage('validation');
        const validationError = SpecEngineActionFactory.validateInput(
          action.input,
          input,
        );
        if (validationError) {
          trace.endStage(
            'validation',
            'fail',
            { error: validationError },
            undefined,
            undefined,
            {
              message: validationError,
              code: 'VALIDATION_ERROR',
            },
          );
          trace.finish();
          this.attachTrace(res, trace);
          throw new BadRequestException({ error: validationError });
        }
        trace.endStage('validation', 'pass', { action: action.name });

        // Verify handler is loaded.
        if (!handler) {
          trace.startStage('response');
          trace.endStage(
            'response',
            'fail',
            { error: 'handler not loaded' },
            undefined,
            undefined,
            {
              message: `Action handler for "${action.name}" is not loaded`,
              code: 'HANDLER_MISSING',
            },
          );
          trace.finish();
          this.attachTrace(res, trace);
          throw new InternalServerErrorException(
            `Action handler for "${action.name}" is not available`,
          );
        }

        // If the action targets an entity row (`:id`), confirm the entity
        // exists before invoking the handler — this gives a clean 404
        // instead of an opaque handler error and keeps row-level semantics.
        if (entityId !== null) {
          trace.startStage('db');
          const exists = await this.repository.findOne({
            where: { id: entityId },
          });
          if (!exists) {
            trace.endStage('db', 'fail', { error: 'entity not found' });
            trace.finish();
            this.attachTrace(res, trace);
            throw new NotFoundException(
              `${displayName} with ID ${entityId} not found`,
            );
          }
          trace.endStage('db', 'pass', { operation: 'SELECT', id: entityId });
        } else {
          trace.skipStage('db', 'bulk action — no entity lookup');
        }

        // Execute handler.
        trace.startStage('afterHook');
        let result: Record<string, unknown>;
        try {
          const ctx = this.buildContext(user, `action:${action.name}`, trace);
          result = await handler(entityId, input, ctx);
        } catch (err) {
          if (err instanceof HookAbortError) {
            trace.endStage(
              'afterHook',
              'fail',
              { error: err.message },
              undefined,
              undefined,
              {
                message: err.message,
                code: 'ACTION_ABORT',
              },
            );
            trace.finish();
            this.attachTrace(res, trace);
            throw new BadRequestException(err.message);
          }
          const message = err instanceof Error ? err.message : String(err);
          this.logger.error(
            `Action "${action.name}" failed: ${message}`,
            err instanceof Error ? err.stack : undefined,
          );
          // Trace enrichment (PRD 01): attach the finished trace so the
          // global filter persists the real stage history with the
          // action-factory layer marker.
          attachTraceToError(err instanceof Error ? err : new Error(message), {
            ...trace.toJSON(),
            layer: 'action_factory',
            step: `action ${action.name}`,
          });
          trace.endStage(
            'afterHook',
            'fail',
            { error: message },
            undefined,
            undefined,
            {
              message,
              code: 'ACTION_ERROR',
            },
          );
          trace.finish();
          this.attachTrace(res, trace);
          throw new InternalServerErrorException(`Action failed: ${message}`);
        }
        trace.endStage('afterHook', 'pass', { action: action.name });

        trace.skipStage('notifications', 'not applicable to actions');

        trace.startStage('response');
        trace.endStage('response', 'pass', { action: action.name });

        trace.finish();
        this.attachTrace(res, trace);
        return result ?? { ok: true };
      }

      // ─── route registrations ──────────────────────────────────────────
      // We register one method per action. NestJS decorators are applied
      // imperatively so we can use dynamic HTTP methods / paths.
      // The method bodies are uniform: parse `:id` if present, delegate to
      // runAction with the action's loaded handler.

      private attachTrace(
        res: Response | undefined,
        trace: TraceBuilder,
      ): void {
        if (!res || !trace.isActive()) return;
        try {
          res.setHeader('X-Spec-Trace', trace.toBase64());
        } catch {
          // response already sent — ignore
        }
      }

      private parseEntityId(id: string): number | null {
        const num = Number(id);
        if (!Number.isFinite(num)) {
          throw new BadRequestException(`Invalid ID: "${id}" must be a number`);
        }
        return num;
      }
    }

    // Wire each action as a route method on the controller class.
    for (const loaded of loadedActions) {
      const { action } = loaded;
      const httpMethod = action.method || 'POST';
      const actionPath = this.normalizeActionPath(action.path);
      const roles = resolveRolesArray(
        action.auth && action.auth.length > 0 ? action.auth : createRoles,
      );
      const hasId = actionPath.includes(':id');

      // Define the handler function with the correct NestJS signature.
      const routeHandler = function (
        this: any,
        paramId: string | undefined,
        body: unknown,
        req: Request | undefined,
        res: Response | undefined,
      ): Promise<unknown> {
        const user = (req?.user as AuthenticatedUser) || null;
        const entityId =
          hasId && paramId !== undefined ? this.parseEntityId(paramId) : null;
        const input =
          body && typeof body === 'object'
            ? (body as Record<string, unknown>)
            : {};
        return this.runAction(
          loaded,
          entityId,
          input,
          user,
          res,
          req?.headers?.['x-request-id'] as string | undefined,
        );
      };

      // Build the parameter list matching the decorators we'll apply.
      // We use a stable parameter order: [paramId?, body?, req, res].
      const paramTypes: any[] = [];
      const paramDecorators: any[] = [];

      if (hasId) {
        paramTypes.push(String);
        paramDecorators.push(Param('id'));
      }
      // GET actions don't have a body.
      if (httpMethod !== 'GET') {
        paramTypes.push(Object);
        paramDecorators.push(Body());
      }
      paramTypes.push(Object);
      paramDecorators.push(Req());
      paramTypes.push(Object);
      paramDecorators.push(Res({ passthrough: true }));

      // Apply HTTP method decorator to the method.
      const methodDecorator =
        httpMethod === 'GET'
          ? Get(actionPath)
          : httpMethod === 'PATCH'
            ? Patch(actionPath)
            : httpMethod === 'DELETE'
              ? Delete(actionPath)
              : Post(actionPath);

      const statusDecorator =
        httpMethod === 'POST'
          ? HttpCode(HttpStatus.CREATED)
          : HttpCode(HttpStatus.OK);

      // Define the method on the prototype with a unique name so NestJS can
      // reflect metadata without collisions.
      const methodName = `action_${action.name.replace(/[^a-zA-Z0-9_]/g, '_')}`;

      // Bind to controller prototype so `this` works when NestJS invokes it.
      (SpecActionController.prototype as any)[methodName] = routeHandler;

      // Build a property descriptor that NestJS decorators expect.
      // NestJS decorators (@Get, @HttpCode, @Roles) operate on
      // (target, propertyKey, descriptor) and read descriptor.value.
      const descriptor: PropertyDescriptor = {
        value: routeHandler as any,
        writable: true,
        enumerable: true,
        configurable: true,
      };

      // Apply @Roles to the method.
      Roles(...(roles as RoleEnum[]))(
        SpecActionController.prototype,
        methodName,
        descriptor,
      );
      // Apply HTTP + status decorators.
      (methodDecorator as any)(
        SpecActionController.prototype,
        methodName,
        descriptor,
      );
      (statusDecorator as any)(
        SpecActionController.prototype,
        methodName,
        descriptor,
      );

      // Ensure the decorated method is on the prototype.
      (SpecActionController.prototype as any)[methodName] = descriptor.value;
      Reflect.defineMetadata(
        'design:paramtypes',
        paramTypes,
        descriptor.value as any,
      );
    }

    // Return the controller class and metadata.

    return { controllerClass: SpecActionController };
  }

  // ─── helpers ──────────────────────────────────────────────────────────

  /**
   * Load an action handler via require() with path containment + .ts→.js fix
   * (same pattern as hook-executor / webhook-controller-factory).
   */
  private static loadActionHandler(
    action: ActionSpec,
    extensionDir: string,
    resourceName: string,
  ): ActionHandler | null {
    try {
      const absolutePath = path.resolve(extensionDir, action.handler);
      const requirePath = resolveHookModulePath(absolutePath, extensionDir);
      if (!requirePath) {
        this.logger.warn(
          `⚠️  Action handler "${action.handler}" for ${resourceName}.${action.name} escapes extension directory — skipping`,
        );
        return null;
      }

      const mod = loadExtensionModule(requirePath);
      const handler: unknown = extractModuleExport(mod);
      if (typeof handler !== 'function') {
        this.logger.warn(
          `⚠️  Action "${action.name}" for ${resourceName} has no default export function — skipping`,
        );
        return null;
      }
      this.logger.log(
        `🪩 Loaded action: ${resourceName}.${action.name} → ${action.handler}`,
      );
      return handler as ActionHandler;
    } catch (err) {
      this.logger.warn(
        `⚠️  Could not load action handler "${action.handler}" for ${resourceName}.${action.name}: ${(err as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Validate input against the declared ActionInputSpec list.
   * Simple type-checking (no Zod) — matches the spec contract.
   * Returns an error message string, or null if valid.
   */
  private static validateInput(
    inputSpec: ActionInputSpec[] | undefined,
    input: Record<string, unknown>,
  ): string | null {
    if (!inputSpec || inputSpec.length === 0) return null;

    for (const field of inputSpec) {
      const value = input[field.name];

      // Required check
      if (field.required && (value === undefined || value === null)) {
        return `Field "${field.name}" is required`;
      }
      if (value === undefined || value === null) continue; // optional + absent = ok

      const typeError = this.checkType(field.type, value, field.name);
      if (typeError) return typeError;
    }
    return null;
  }

  private static checkType(
    type: FieldType,
    value: unknown,
    name: string,
  ): string | null {
    const t = type;
    switch (t) {
      case 'string':
      case 'text':
        if (typeof value !== 'string')
          return `Field "${name}" must be a string`;
        return null;
      case 'integer':
        if (typeof value !== 'number' || !Number.isInteger(value))
          return `Field "${name}" must be an integer`;
        return null;
      case 'decimal':
        if (typeof value !== 'number' || !Number.isFinite(value))
          return `Field "${name}" must be a number`;
        return null;
      case 'boolean':
        if (typeof value !== 'boolean')
          return `Field "${name}" must be a boolean`;
        return null;
      case 'datetime':
      case 'date':
        if (typeof value !== 'string' && !(value instanceof Date))
          return `Field "${name}" must be a date string`;
        return null;
      case 'json':
        if (typeof value !== 'object')
          return `Field "${name}" must be an object`;
        return null;
      case 'enum':
        if (typeof value !== 'string')
          return `Field "${name}" must be a string (enum value)`;
        return null;
      case 'ref':
        if (typeof value !== 'number')
          return `Field "${name}" must be a numeric reference id`;
        return null;
      case 'file':
        if (typeof value !== 'string')
          return `Field "${name}" must be a file id string`;
        return null;
      case 'computed':
        // computed inputs aren't expected from clients — accept any.
        return null;
      default:
        return null;
    }
  }

  /**
   * Normalize the action sub-path so NestJS can mount it under the resource
   * controller's base route. Examples:
   *   ':id/assign'      → ':id/assign'
   *   'bulk/assign'     → 'bulk/assign'
   *   '/:id/assign'     → ':id/assign'  (leading slash stripped)
   */
  private static normalizeActionPath(rawPath: string): string {
    if (!rawPath || typeof rawPath !== 'string') {
      throw new Error(
        `SpecEngineActionFactory: invalid action path "${rawPath}"`,
      );
    }
    return rawPath.startsWith('/') ? rawPath.slice(1) : rawPath;
  }

  private static pluralize(name: string): string {
    if (name.endsWith('s')) return name;
    if (name.endsWith('y')) return name.slice(0, -1) + 'ies';
    if (name.endsWith('ch') || name.endsWith('sh') || name.endsWith('x')) {
      return name + 'es';
    }
    return name + 's';
  }

  private static pascalCase(name: string): string {
    return name
      .split(/[-_]/)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join('');
  }
}
