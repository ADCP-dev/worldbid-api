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

import {
  DynamicModule,
  Module,
  Type,
  Logger,
  Provider,
} from '@nestjs/common';
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
import type { ResourceSpec, HookSpec } from './spec.types';
import type { LoadedHook } from './hook-executor';

const logger = new Logger('SpecEngine');

@Module({})
export class SpecEngineModule {
  static register(): DynamicModule {
    const extensionsDir = this.findExtensionsDir();

    if (!extensionsDir) {
      logger.log('No extensions directory found — skipping spec engine');
      return { module: SpecEngineModule, imports: [], providers: [], controllers: [] };
    }

    // Phase 1: Load all specs
    const loadedSpecs = SpecLoader.load(extensionsDir);

    if (loadedSpecs.length === 0) {
      logger.log('No spec files found — skipping spec engine');
      return { module: SpecEngineModule, imports: [], providers: [], controllers: [] };
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
      logger.error(`❌ ${validationResult.errors.length} validation error(s) found:`);
      validationResult.errors.forEach((e) => {
        const ctx = [e.resource, e.field].filter(Boolean).join('.');
        logger.error(`   ${ctx ? `[${ctx}] ` : ''}${e.message}${e.suggestion ? ` → ${e.suggestion}` : ''}`);
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
          const entitySchema = EntityFactory.create(resource, resourceSpecs);
          entitySchemas.push(entitySchema);

          // Load hooks for this resource
          const allHooks = this.loadHooksForResource(
            resource.hooks,
            loaded.dir,
            resource.name,
            hookExecutor,
          );

          // We need to defer controller creation until we have ModuleRef.
          // For now, we create a placeholder and wire it in onModuleInit.
          // Actually, NestJS DynamicModule requires controllers to be
          // registered at registration time, not at onModuleInit.
          //
          // Solution: we pass a lazy resolver that gets ModuleRef later.
          // The controller factory needs ModuleRef for HookContextImpl.
          // We use a module-level variable that gets set in onModuleInit.

          // Create controller with deferred ModuleRef
          const { controllerClass } = ControllerFactory.create({
            spec: resource,
            entitySchemaName: resource.name,
            extensionDir: loaded.dir,
            hookExecutor,
            notificationDispatcher,
            isDev: process.env.NODE_ENV !== 'production',
            allHooks,
          });

          controllers.push(controllerClass);

          logger.log(
            `✅ Materialized: ${resource.name} → table ${resource.table}, ${resource.fields.length} fields` +
              (allHooks.beforeCreate ? ', beforeCreate hook' : '') +
              (allHooks.afterCreate ? ', afterCreate hook' : '') +
              (resource.notifications?.length ? `, ${resource.notifications.length} notifications` : '') +
              (resource.jobs?.length ? `, ${resource.jobs.length} jobs` : '') +
              (resource.webhooks?.length ? `, ${resource.webhooks.length} webhooks` : ''),
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
      loaded.spec.resources.some(
        (r) => r.outboundWebhooks?.some((w) => w.subscriptionModel === 'dynamic'),
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
      beforeCreate: hookExecutor.loadHook(hooks.beforeCreate, extensionDir, resourceName, 'beforeCreate') || undefined,
      afterCreate: hookExecutor.loadHook(hooks.afterCreate, extensionDir, resourceName, 'afterCreate') || undefined,
      beforeUpdate: hookExecutor.loadHook(hooks.beforeUpdate, extensionDir, resourceName, 'beforeUpdate') || undefined,
      afterUpdate: hookExecutor.loadHook(hooks.afterUpdate, extensionDir, resourceName, 'afterUpdate') || undefined,
      beforeDelete: hookExecutor.loadHook(hooks.beforeDelete, extensionDir, resourceName, 'beforeDelete') || undefined,
      afterDelete: hookExecutor.loadHook(hooks.afterDelete, extensionDir, resourceName, 'afterDelete') || undefined,
      beforeQuery: hookExecutor.loadHook(hooks.beforeQuery, extensionDir, resourceName, 'beforeQuery') || undefined,
    };
  }

  /**
   * Find the extensions directory relative to this compiled file
   */
  private static findExtensionsDir(): string | null {
    // Try dist/extensions (compiled)
    const distPath = path.resolve(__dirname, '../../extensions');
    if (fs.existsSync(distPath)) return distPath;

    // Try src/extensions (ts-node / dev)
    const srcPath = path.resolve(__dirname, '../../../src/extensions');
    if (fs.existsSync(srcPath)) return srcPath;

    return null;
  }
}