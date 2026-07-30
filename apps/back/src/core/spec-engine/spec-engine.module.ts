/**
 * SpecEngineModule — the dynamic module that loads YAML specs and materializes them.
 *
 * This replaces hand-written NestJS modules for spec-driven extensions.
 * Drop a .spec.yaml in extensions/<name>/ → full CRUD API is available at runtime.
 *
 * Flow:
 *   1. Scan extensions dir for .spec.yaml files
 *   2. For each resource in each spec:
 *      a. Build TypeORM EntitySchema (dynamic entity)
 *      b. Register dynamic repository in NestJS DI
 *      c. Build dynamic controller with CRUD routes + Zod validation + auth
 *   3. Register job handlers (BullMQ or setInterval)
 *   4. Register webhook controllers
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

import { SpecLoader, LoadedSpec } from './spec-loader';
import { EntityFactory } from './entity-factory';
import { ControllerFactory } from './controller-factory';
import { SpecJobRunner } from './spec-job-runner';
import type { ResourceSpec } from './spec.types';

const logger = new Logger('SpecEngine');

export interface SpecEngineContext {
  loadedSpecs: LoadedSpec[];
  resourceSpecs: Map<string, ResourceSpec>;
}

@Module({})
export class SpecEngineModule {
  /**
   * Register the spec engine: scan for specs and materialize all resources
   */
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

    // Phase 2: Build a registry of all resource specs (for ref validation)
    const resourceSpecs = new Map<string, ResourceSpec>();
    for (const loaded of loadedSpecs) {
      for (const res of loaded.spec.resources) {
        resourceSpecs.set(res.name, res);
      }
    }

    // Validate all resources
    for (const [name, res] of resourceSpecs) {
      const errors = SpecLoader.validateResource(res, resourceSpecs);
      if (errors.length > 0) {
        logger.error(`❌ Resource "${name}" has validation errors:`);
        errors.forEach((e) => logger.error(`   ${e}`));
      }
    }

    // Phase 3: Materialize entities + controllers
    const entitySchemas: EntitySchema<any>[] = [];
    const controllers: Type<any>[] = [];
    const providers: Provider[] = [];
    const imports: any[] = [];

    for (const loaded of loadedSpecs) {
      for (const resource of loaded.spec.resources) {
        try {
          // Create entity schema
          const entitySchema = EntityFactory.create(resource);
          entitySchemas.push(entitySchema);

          // Create controller
          const { controllerClass } = ControllerFactory.create(
            resource,
            resource.name,
          );
          controllers.push(controllerClass);

          logger.log(
            `✅ Materialized: ${resource.name} → table ${resource.table}, ${resource.fields.length} fields`,
          );
        } catch (err) {
          logger.error(
            `❌ Failed to materialize resource "${resource.name}": ${(err as Error).message}`,
          );
        }
      }
    }

    // Phase 4: Register TypeORM with all dynamic entity schemas
    if (entitySchemas.length > 0) {
      imports.push(TypeOrmModule.forFeature(entitySchemas));
    }

    // Phase 5: Register job runner with loaded specs injected via factory
    const jobContext: SpecEngineContext = { loadedSpecs, resourceSpecs };
    providers.push({
      provide: 'SPEC_ENGINE_CONTEXT',
      useValue: jobContext,
    });
    providers.push({
      provide: SpecJobRunner,
      useFactory: () => {
        const runner = new SpecJobRunner();
        runner.setLoadedSpecs(loadedSpecs);
        return runner;
      },
    });

    logger.log(
      `Spec engine ready: ${entitySchemas.length} entities, ${controllers.length} controllers`,
    );

    return {
      module: SpecEngineModule,
      imports,
      controllers,
      providers,
      exports: [SpecJobRunner, 'SPEC_ENGINE_CONTEXT'],
    };
  }

  /**
   * Find the extensions directory relative to this compiled file
   */
  private static findExtensionsDir(): string | null {
    // __dirname is dist/core/spec-engine (compiled) or src/core/spec-engine (ts)
    // extensions/ is at src/extensions/ or dist/extensions/
    const path = require('path');
    const fs = require('fs');

    // Try dist/extensions (compiled)
    const distPath = path.resolve(__dirname, '../../extensions');
    if (fs.existsSync(distPath)) return distPath;

    // Try src/extensions (ts-node / dev)
    const srcPath = path.resolve(__dirname, '../../../src/extensions');
    if (fs.existsSync(srcPath)) return srcPath;

    return null;
  }
}