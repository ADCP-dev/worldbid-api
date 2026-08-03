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

import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { SpecErrorReporter } from './spec-error-reporter';

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
