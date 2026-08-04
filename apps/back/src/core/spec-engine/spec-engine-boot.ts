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
      this.logger.warn(
        `Could not run spec seeds: ${(err as Error).message}`,
      );
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
