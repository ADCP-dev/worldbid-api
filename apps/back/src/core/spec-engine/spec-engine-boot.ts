/**
 * SpecEngineBootService — wires ModuleRef and ConfigService into the
 * spec engine after module initialization.
 *
 * The problem: ControllerFactory.create() needs ModuleRef and ConfigService
 * at registration time (static register()), but they're only available
 * after the module is instantiated.
 *
 * Solution: We create a global singleton holder that gets populated in
 * onModuleInit, and the controllers read from it.
 */

import { Injectable, OnModuleInit, Logger, Inject } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { SpecErrorReporter } from './spec-error-reporter';
import { RoleRegistry } from './role-registry';
import { runSpecSeeds } from './spec-seed-loader';
import { runSchemaDriftCheck } from './spec-schema-drift';
import { attachTraceToError } from './error-trace';
import type { LoadedSpec } from './spec-loader';

@Injectable()
export class SpecEngineBootService implements OnModuleInit {
  private readonly logger = new Logger('SpecEngineBoot');

  static moduleRef: ModuleRef | null = null;
  static configService: ConfigService<any> | null = null;
  static dataSource: DataSource | null = null;
  static errorReporterService: any = null;

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly configService: ConfigService<any>,
    private readonly dataSource: DataSource,
    @Inject('SPEC_LOADED_SPECS') private readonly loadedSpecs: LoadedSpec[],
  ) {}

  async onModuleInit() {
    SpecEngineBootService.moduleRef = this.moduleRef;
    SpecEngineBootService.configService = this.configService;
    SpecEngineBootService.dataSource = this.dataSource;

    // Wire ErrorTrackerService into SpecErrorReporter
    try {
      const errorReporter = this.moduleRef.get(SpecErrorReporter, {
        strict: false,
      });
      if (errorReporter?.setErrorTrackerService) {
        const errorTrackerService = this.moduleRef.get('ErrorTrackerService', {
          strict: false,
        });
        if (errorTrackerService) {
          errorReporter.setErrorTrackerService(errorTrackerService);
        }
      }
    } catch (err) {
      this.logger.warn(
        `Could not wire ErrorTrackerService: ${(err as Error).message}`,
      );
      // Trace enrichment (PRD 01): localize boot failures. The marker is
      // picked up by the global exception filter if this failure ever
      // surfaces as a thrown 5xx (defensive — boot usually logs only).
      attachTraceToError(err instanceof Error ? err : new Error(String(err)), {
        requestId: `req_boot_${Date.now().toString(36)}`,
        resource: '',
        operation: 'read',
        user: null,
        stages: [],
        totalDurationMs: 0,
        layer: 'spec_engine_boot',
        step: 'wiring ErrorTrackerService',
      });
    }

    // Build the RoleRegistry from loaded specs + the RoleEntity table so
    // custom roles (manager) and the customer→user asymmetry resolve at
    // runtime (BUG #4 + #8). Safe to fail — the registry falls back to
    // built-in-only and denies unknown roles.
    try {
      const roleRepo = this.dataSource.getRepository('role');
      await RoleRegistry.build(this.loadedSpecs, roleRepo as any);
    } catch (err) {
      this.logger.warn(
        `Could not build RoleRegistry: ${(err as Error).message} — ` +
          'custom roles will fail closed until the DB is reachable.',
      );
    }

    // Run resource seeds declared in spec YAMLs (BUG #9). Idempotent —
    // safe to run on every boot. Per-resource try/catch inside, so one
    // failing seed never blocks the rest.
    try {
      await runSpecSeeds(this.loadedSpecs, this.dataSource);
    } catch (err) {
      this.logger.warn(`Could not run spec seeds: ${(err as Error).message}`);
    }

    // Schema drift detection (design §12.2/§12.3). Compares a stable hash
    // of each extension's merged specs against the persisted
    // spec_schema_version table. Wrapped in try/catch so drift detection
    // NEVER blocks boot on its own internal errors — fail open with a
    // warning. In production, detected drift itself throws (SPEC_ENGINE_DRIFT=block).
    try {
      await runSchemaDriftCheck(this.loadedSpecs, this.dataSource);
    } catch (err) {
      this.logger.error((err as Error).message, (err as Error).stack);
      // Trace enrichment (PRD 01): tag the drift failure with the boot
      // layer before rethrowing, so the global filter persists the real
      // origin instead of a generic 500.
      attachTraceToError(err instanceof Error ? err : new Error(String(err)), {
        requestId: `req_boot_${Date.now().toString(36)}`,
        resource: '',
        operation: 'read',
        user: null,
        stages: [],
        totalDurationMs: 0,
        layer: 'spec_engine_boot',
        step: 'schema drift check',
      });
      throw err;
    }

    this.logger.log(
      'Spec engine boot complete — ModuleRef and ConfigService wired',
    );
  }

  /**
   * Get ModuleRef (available after boot)
   */
  static getModuleRef(): ModuleRef {
    if (!SpecEngineBootService.moduleRef) {
      throw new Error(
        'SpecEngineBootService not yet initialized — ModuleRef unavailable',
      );
    }
    return SpecEngineBootService.moduleRef;
  }

  /**
   * Get ConfigService (available after boot)
   */
  static getConfigService(): ConfigService<any> {
    if (!SpecEngineBootService.configService) {
      throw new Error(
        'SpecEngineBootService not yet initialized — ConfigService unavailable',
      );
    }
    return SpecEngineBootService.configService;
  }

  /**
   * Get DataSource (available after boot)
   */
  static getDataSource(): DataSource {
    if (!SpecEngineBootService.dataSource) {
      throw new Error(
        'SpecEngineBootService not yet initialized — DataSource unavailable',
      );
    }
    return SpecEngineBootService.dataSource;
  }
}
