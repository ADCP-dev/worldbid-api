/**
 * SpecMetaController — exposes the spec metadata API.
 *
 * This controller lets the front-end (and tooling) discover what the spec
 * engine has materialized at runtime: which resources exist, their fields,
 * permissions, hooks, notifications, jobs, and webhooks. It also exposes a
 * trace lookup endpoint (admin-only) that is currently a stub pending a trace
 * store backend.
 *
 * Routes (all under the global api prefix + URI versioning → /api/v1/_spec/*):
 *   GET /_spec/resources        — all resources
 *   GET /_spec/resources/:name  — a single resource spec
 *   GET /_spec/trace/:requestId — trace by request ID (admin only, stub)
 *
 * The loaded specs are injected via the 'SPEC_LOADED_SPECS' provider token,
 * which is registered in SpecEngineModule.register().
 */

import {
  Controller,
  Get,
  Inject,
  Logger,
  NotFoundException,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { Roles } from '@iam/roles/roles.decorator';
import { RoleEnum } from '@iam/roles/roles.enum';
import { RolesGuard } from '@iam/roles/roles.guard';

import type {
  ResourceSpec,
  FieldSpec,
  PermissionSpec,
  HookSpec,
  NotificationSpec,
  JobSpec,
  WebhookSpec,
} from './spec.types';
import type { LoadedSpec } from './spec-loader';

/**
 * Shape returned for a single resource in the metadata payload.
 * Mirrors the ResourceSpec but adds a computed `route` and a stable
 * `displayName`, and omits internal-only fields like `seeds`.
 */
export interface ResourceMetaDTO {
  name: string;
  displayName: string;
  table: string;
  description?: string;
  route: string;
  fields: FieldSpec[];
  permissions?: PermissionSpec;
  hooks?: HookSpec;
  notifications?: NotificationSpec[];
  jobs?: JobSpec[];
  webhooks?: WebhookSpec[];
}

/**
 * Envelope returned by GET /_spec/resources.
 */
export interface SpecResourcesResponse {
  resources: ResourceMetaDTO[];
}

/**
 * Trace lookup result (stub). The real shape will come from the trace
 * store backend once implemented; for now we return a placeholder.
 */
export interface SpecTraceStubResponse {
  requestId: string;
  found: false;
  message: string;
}

@ApiTags('Spec Engine')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ path: '_spec', version: '1' })
export class SpecMetaController {
  private readonly logger = new Logger('SpecMetaController');

  constructor(
    @Inject('SPEC_LOADED_SPECS') private readonly loadedSpecs: LoadedSpec[],
  ) {}

  // ─── GET /_spec/resources ──────────────────────────────────────────────
  /**
   * Returns every materialized resource, with fields/permissions/hooks/
   * notifications/jobs/webhooks so tooling can discover what the engine
   * has materialized at runtime.
   */
  @Get('resources')
  getAllResources(): SpecResourcesResponse {
    const resources = this.collectResources();
    return { resources };
  }

  // ─── GET /_spec/resources/:name ────────────────────────────────────────
  /**
   * Returns a single resource spec by name. Throws 404 when the resource
   * is not registered in the spec engine.
   */
  @Get('resources/:name')
  getOneResource(@Param('name') name: string): ResourceMetaDTO {
    const resource = this.findResourceByName(name);
    if (!resource) {
      throw new NotFoundException(`Resource "${name}" is not registered`);
    }
    return resource;
  }

  // ─── GET /_spec/trace/:requestId ───────────────────────────────────────
  /**
   * Returns the trace for a given request ID. Admin-only.
   *
   * This is a stub: the trace store backend is not yet wired up, so we
   * always report `found: false`. Once a TraceStore provider exists,
   * inject it here and delegate the lookup.
   */
  @Get('trace/:requestId')
  @Roles(RoleEnum.admin)
  getTrace(@Param('requestId') requestId: string): SpecTraceStubResponse {
    this.logger.debug(
      `Trace lookup requested for requestId="${requestId}" (stub)`,
    );
    return {
      requestId,
      found: false,
      message:
        'Trace store is not yet implemented. Traces are currently emitted ' +
        'via the X-Spec-Trace response header in dev mode only.',
    };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────

  /**
   * Walk every loaded extension and collect all resources as DTOs.
   */
  private collectResources(): ResourceMetaDTO[] {
    const out: ResourceMetaDTO[] = [];
    for (const loaded of this.loadedSpecs) {
      for (const res of loaded.spec.resources ?? []) {
        out.push(this.toResourceDTO(res));
      }
    }
    return out;
  }

  /**
   * Find a single resource DTO by name across all loaded extensions.
   */
  private findResourceByName(name: string): ResourceMetaDTO | undefined {
    const normalizedName = String(name ?? '')
      .trim()
      .toLowerCase();
    for (const loaded of this.loadedSpecs) {
      for (const res of loaded.spec.resources ?? []) {
        if (res.name.toLowerCase() === normalizedName) {
          return this.toResourceDTO(res);
        }
      }
    }
    return undefined;
  }

  /**
   * Convert a ResourceSpec into the API DTO, computing the `route`
   * (matching ControllerFactory's pluralization) and a stable
   * `displayName`.
   */
  private toResourceDTO(res: ResourceSpec): ResourceMetaDTO {
    return {
      name: res.name,
      displayName: res.displayName ?? this.titleCase(res.name),
      table: res.table,
      description: res.description,
      route: `/api/v1/${this.pluralize(res.name)}`,
      fields: res.fields ?? [],
      permissions: res.permissions,
      hooks: res.hooks,
      notifications: res.notifications,
      jobs: res.jobs,
      webhooks: res.webhooks,
    };
  }

  /**
   * Pluralize a resource name. Mirrors ControllerFactory.pluralize so the
   * `route` we report matches the actual materialized controller path.
   */
  private pluralize(name: string): string {
    if (name.endsWith('s')) return name;
    if (name.endsWith('y')) return name.slice(0, -1) + 'ies';
    if (name.endsWith('ch') || name.endsWith('sh') || name.endsWith('x')) {
      return name + 'es';
    }
    return name + 's';
  }

  /**
   * Convert a kebab/snake-case name to a Title Case display string.
   */
  private titleCase(name: string): string {
    return name
      .split(/[-_]/)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(' ');
  }
}
