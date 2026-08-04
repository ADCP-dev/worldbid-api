/**
 * SpecEngineModule — the dynamic module that loads YAML specs and
 * materializes them into full CRUD APIs at runtime.
 *
 * Flow:
 *   1. Scan extensions dir for .spec.yaml files
 *   2. Parse and validate each spec
 *   3. For each resource:
 *      a. Build TypeORM EntitySchema (dynamic entity with relations)
 *      b. Load hooks (beforeCreate, afterCreate, etc.)
 *      c. Build dynamic controller with full 7-stage pipeline
 *      d. Build webhook controllers if webhooks defined
 *   4. Register TypeORM with all dynamic entity schemas
 *   5. Register job runner with loaded specs
 *   6. Wire NotificationDispatcher, HookExecutor, SpecErrorReporter
 */

import { DynamicModule, Module, Type, Logger, Provider } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EntitySchema } from 'typeorm';
import { ModuleRef } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

import { SpecLoader, LoadedSpec } from './spec-loader';
import { SpecValidator } from './spec-validator';
import { EntityFactory } from './entity-factory';
import { ControllerFactory } from './controller-factory';
import { ValidationFactory } from './validation-factory';
import { HookExecutor } from './hook-executor';
import { NotificationDispatcher } from './notification-dispatcher';
import { SpecErrorReporter } from './spec-error-reporter';
import { SpecJobRunner } from './spec-job-runner';
import { WebhookControllerFactory } from './webhook-controller-factory';
import { SpecEngineActionFactory } from './spec-engine-action-factory';
import { createSpecWebhookSubscriptionSchema } from './spec-engine-scheduled-actions';
import { SpecEngineBootService } from './spec-engine-boot';
import { SpecMetaController } from './meta-controller';
import { buildFoundationEntitySchemas } from './foundation-entity-schemas';
import { getAuditSchema } from './spec-engine-audit';
import type { ResourceSpec, HookSpec } from './spec.types';
import type { LoadedHook } from './hook-executor';

const logger = new Logger('SpecEngine');

@Module({})
export class SpecEngineModule {
  static register(): DynamicModule {
    const extensionsDir = this.findExtensionsDir();

    if (!extensionsDir) {
      logger.log('No extensions directory found — skipping spec engine');
      return {
        module: SpecEngineModule,
        imports: [],
        providers: [],
        controllers: [],
      };
    }

    // Phase 1: Load all specs
    const loadedSpecs = SpecLoader.load(extensionsDir);

    if (loadedSpecs.length === 0) {
      logger.log('No spec files found — skipping spec engine');
      return {
        module: SpecEngineModule,
        imports: [],
        providers: [],
        controllers: [],
      };
    }

    // Phase 2: Build resource registry
    const resourceSpecs = new Map<string, ResourceSpec>();
    for (const loaded of loadedSpecs) {
      for (const res of loaded.spec.resources) {
        resourceSpecs.set(res.name, res);
      }
    }

    // Validate all resources using SpecValidator
    const validationResult = SpecValidator.validateAll(loadedSpecs);
    if (validationResult.errors.length > 0) {
      logger.error(
        `❌ ${validationResult.errors.length} validation error(s) found:`,
      );
      validationResult.errors.forEach((e) => {
        const ctx = [e.resource, e.field].filter(Boolean).join('.');
        logger.error(
          `   ${ctx ? `[${ctx}] ` : ''}${e.message}${e.suggestion ? ` → ${e.suggestion}` : ''}`,
        );
      });
    }
    if (validationResult.warnings.length > 0) {
      validationResult.warnings.forEach((w) => {
        const ctx = [w.resource, w.field].filter(Boolean).join('.');
        logger.warn(`⚠️  ${ctx ? `[${ctx}] ` : ''}${w.message}`);
      });
    }

    // Phase 3: Create shared providers
    const hookExecutor = new HookExecutor();
    const notificationDispatcher = new NotificationDispatcher();
    const specErrorReporter = new SpecErrorReporter();

    // Wire error reporter into hook executor (for Telegram + GitHub issues)
    hookExecutor.setErrorReporter(specErrorReporter);

    // Phase 4: Materialize entities + controllers + webhooks
    const entitySchemas: EntitySchema<any>[] = [];

    // Append minimal EntitySchema mirrors of Foundation core entities that
    // spec `ref` fields target (user, role). TypeORM builds EntitySchema
    // relations in a SEPARATE metadata store from decorator-registered
    // entities, so a spec relation `target: 'user'` cannot resolve
    // UserEntity unless a mirror EntitySchema with the same name is present
    // in the same store. With synchronize:false, no DDL is emitted for these
    // mirrors — they only satisfy relation resolution. See
    // foundation-entity-schemas.ts for the full rationale.
    entitySchemas.push(...buildFoundationEntitySchemas());

    const controllers: Type<any>[] = [];
    const providers: Provider[] = [];
    const imports: any[] = [];

    // We need ModuleRef and ConfigService — but they're only available
    // after the module is instantiated. So we create a factory that
    // receives them via onModuleInit.
    //
    // For the controller factory, we need ModuleRef at registration time.
    // We use a deferred pattern: store references that get resolved
    // when the module initializes.

    for (const loaded of loadedSpecs) {
      for (const resource of loaded.spec.resources) {
        try {
          // Create entity schema with relations
          const { mainSchema, joinTableSchemas } = EntityFactory.create(
            resource,
            resourceSpecs,
            loaded.spec.name,
          );
          entitySchemas.push(mainSchema);
          entitySchemas.push(...joinTableSchemas);

          // BUG #5: register the per-resource audit table EntitySchema in
          // forFeature() so SpecAuditLogger can resolve a repository for it
          // at runtime. When a resource enables `audit`, an `ext_<name>_audit`
          // table holds per-field change rows. The schema must be in the same
          // metadata store as the resource schema (EntitySchema path) for the
          // lazy getRepository(schema) call to succeed.
          if (resource.audit) {
            entitySchemas.push(getAuditSchema(resource.name));
          }

          // Load hooks for this resource
          const allHooks = this.loadHooksForResource(
            resource.hooks,
            loaded.dir,
            resource.name,
            hookExecutor,
          );

          // Create controller with deferred ModuleRef/DataSource.
          // Pass the EntitySchema (not the resource name string) so that
          // getRepositoryToken() resolves to the correct DI token via the
          // EntitySchema branch (string branch would produce "undefinedRepository"
          // because strings have no `.name` property).
          const { controllerClass } = ControllerFactory.create({
            spec: resource,
            entitySchema: mainSchema,
            extensionDir: loaded.dir,
            hookExecutor,
            notificationDispatcher,
            isDev: process.env.NODE_ENV !== 'production',
            allHooks,
            manyToManySchemas: joinTableSchemas,
          });

          controllers.push(controllerClass);

          logger.log(
            `✅ Materialized: ${resource.name} → table ${resource.table}, ${resource.fields.length} fields` +
              (allHooks.beforeCreate ? ', beforeCreate hook' : '') +
              (allHooks.afterCreate ? ', afterCreate hook' : '') +
              (resource.notifications?.length
                ? `, ${resource.notifications.length} notifications`
                : '') +
              (resource.jobs?.length ? `, ${resource.jobs.length} jobs` : '') +
              (resource.webhooks?.length
                ? `, ${resource.webhooks.length} webhooks`
                : ''),
          );

          // Create webhook controllers
          if (resource.webhooks) {
            for (const webhook of resource.webhooks) {
              try {
                const { controllerClass: webhookController } =
                  WebhookControllerFactory.create(
                    webhook,
                    loaded.dir,
                    resource.name,
                  );
                controllers.push(webhookController);
                logger.log(`  ↳ Webhook: ${webhook.path} (${webhook.auth})`);
              } catch (err) {
                logger.error(
                  `  ↳ Failed to create webhook "${webhook.name}": ${(err as Error).message}`,
                );
              }
            }
          }

          // Create custom action controller (non-CRUD endpoints)
          if (resource.actions && resource.actions.length > 0) {
            try {
              const actionResult = SpecEngineActionFactory.create(
                resource,
                resource.name,
                loaded.dir,
                process.env.NODE_ENV !== 'production',
              );
              if (actionResult) {
                controllers.push(actionResult.controllerClass);
                logger.log(
                  `  ↳ Actions: ${resource.actions.length} endpoint(s) (${resource.actions.map((a) => a.path).join(', ')})`,
                );
              }
            } catch (err) {
              logger.error(
                `  ↳ Failed to create actions for "${resource.name}": ${(err as Error).message}`,
              );
            }
          }
        } catch (err) {
          logger.error(
            `❌ Failed to materialize resource "${resource.name}": ${(err as Error).message}`,
          );
        }
      }
    }

    // Phase 5: Register TypeORM with all dynamic entity schemas
    // If any resource uses dynamic outbound webhooks, register the shared
    // spec_webhook_subscriptions table schema as well.
    const hasDynamicWebhooks = loadedSpecs.some((loaded) =>
      loaded.spec.resources.some((r) =>
        r.outboundWebhooks?.some((w) => w.subscriptionModel === 'dynamic'),
      ),
    );
    if (hasDynamicWebhooks) {
      entitySchemas.push(createSpecWebhookSubscriptionSchema());
    }
    if (entitySchemas.length > 0) {
      imports.push(TypeOrmModule.forFeature(entitySchemas));
    }

    // Phase 6: Register providers
    providers.push(SpecEngineBootService);
    providers.push({
      provide: HookExecutor,
      useValue: hookExecutor,
    });
    providers.push({
      provide: NotificationDispatcher,
      useValue: notificationDispatcher,
    });
    providers.push({
      provide: SpecErrorReporter,
      useValue: specErrorReporter,
    });
    // Register job runner with BullMQ (if Redis available) or setInterval fallback
    const jobRegistration = SpecJobRunner.register(loadedSpecs);
    imports.push(...jobRegistration.imports);
    providers.push(...jobRegistration.providers);

    // Store loaded specs for the boot service to wire ModuleRef
    providers.push({
      provide: 'SPEC_LOADED_SPECS',
      useValue: loadedSpecs,
    });
    providers.push({
      provide: 'SPEC_RESOURCE_SPECS',
      useValue: resourceSpecs,
    });
    providers.push({
      provide: 'SPEC_ENTITY_SCHEMAS',
      useValue: entitySchemas,
    });

    // Register meta controller (spec metadata API)
    controllers.push(SpecMetaController as any);

    logger.log(
      `Spec engine ready: ${entitySchemas.length} entities, ${controllers.length} controllers`,
    );

    return {
      module: SpecEngineModule,
      imports,
      controllers,
      providers,
      exports: [
        HookExecutor,
        NotificationDispatcher,
        SpecErrorReporter,
        SpecJobRunner,
        'SPEC_LOADED_SPECS',
        'SPEC_RESOURCE_SPECS',
      ],
    };
  }

  /**
   * Load all hooks for a resource
   */
  private static loadHooksForResource(
    hooks: HookSpec | undefined,
    extensionDir: string,
    resourceName: string,
    hookExecutor: HookExecutor,
  ): {
    beforeCreate?: LoadedHook;
    afterCreate?: LoadedHook;
    beforeUpdate?: LoadedHook;
    afterUpdate?: LoadedHook;
    beforeDelete?: LoadedHook;
    afterDelete?: LoadedHook;
    beforeQuery?: LoadedHook;
  } {
    if (!hooks) return {};

    return {
      beforeCreate:
        hookExecutor.loadHook(
          hooks.beforeCreate,
          extensionDir,
          resourceName,
          'beforeCreate',
        ) || undefined,
      afterCreate:
        hookExecutor.loadHook(
          hooks.afterCreate,
          extensionDir,
          resourceName,
          'afterCreate',
        ) || undefined,
      beforeUpdate:
        hookExecutor.loadHook(
          hooks.beforeUpdate,
          extensionDir,
          resourceName,
          'beforeUpdate',
        ) || undefined,
      afterUpdate:
        hookExecutor.loadHook(
          hooks.afterUpdate,
          extensionDir,
          resourceName,
          'afterUpdate',
        ) || undefined,
      beforeDelete:
        hookExecutor.loadHook(
          hooks.beforeDelete,
          extensionDir,
          resourceName,
          'beforeDelete',
        ) || undefined,
      afterDelete:
        hookExecutor.loadHook(
          hooks.afterDelete,
          extensionDir,
          resourceName,
          'afterDelete',
        ) || undefined,
      beforeQuery:
        hookExecutor.loadHook(
          hooks.beforeQuery,
          extensionDir,
          resourceName,
          'beforeQuery',
        ) || undefined,
    };
  }

  /**
   * Find the extensions directory relative to this compiled file
   */
  private static findExtensionsDir(): string | null {
    // Prefer src/extensions in dev (ts-node / nest start --watch).
    // YAML specs are not copied to dist by the TypeScript compiler, so the
    // dist path would be missing them. Fall back to dist/extensions only in
    // compiled production builds where src/ is not shipped.
    const srcPath = path.resolve(__dirname, '../../../src/extensions');
    if (fs.existsSync(srcPath)) return srcPath;

    const distPath = path.resolve(__dirname, '../../extensions');
    if (fs.existsSync(distPath)) return distPath;

    return null;
  }
}
