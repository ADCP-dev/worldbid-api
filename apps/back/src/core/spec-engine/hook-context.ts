/**
 * HookContext — the unified interface between hooks and Foundation.
 *
 * A hook is a pure function that receives data + this context.
 * It does NOT know about NestJS, DI, controllers, decorators.
 * The context provides access to repositories, services, config,
 * logger, trace, and abort — everything a hook needs.
 *
 * Implementation uses ModuleRef to resolve services from the global
 * NestJS DI container.
 */

import { Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';

import type { AuthenticatedUser, TraceWriter } from './spec.types';
import { HookAbortError } from './spec.types';
import type { EmailJobDataLike } from './email-job-data';
import { isKnownService, KNOWN_SERVICES } from './service-registry';

// Import actual service classes for ModuleRef resolution.
// These imports are safe here because hook-context.ts is only loaded
// at module registration time (runtime), not during spec type checking.
import { MailerService } from '@infra/mailer/mailer.service';
import { QueuedMailerService } from '@comms/email-queue/queued-mailer.service';
import { EmailService } from '@comms/email-queue/email.service';
import { FilesService } from '@storage/files/files.service';
import { ErrorTrackerService } from '@src/modules/error-tracker/error-tracker.service';

// Import driver-specific file services
// These may not all be available depending on FILE_DRIVER config
// We use optional resolution in getService() to handle this.

/**
 * Map of service name → actual class reference for ModuleRef resolution.
 */
const SERVICE_CLASS_MAP: Record<string, any> = {
  MailerService,
  QueuedMailerService,
  EmailService,
  FilesService,
  ErrorTrackerService,
  // Driver-specific file services — resolved lazily since not all may be registered
};

export class HookContextImpl {
  readonly logger: Logger;
  readonly trace: TraceWriter;
  readonly user: AuthenticatedUser | null;
  readonly operation: string;
  readonly resource: string;

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly configService: ConfigService<any>,
    user: AuthenticatedUser | null,
    resource: string,
    operation: string,
    trace: TraceWriter,
  ) {
    this.logger = new Logger(`HookContext:${resource}:${operation}`);
    this.trace = trace;
    this.user = user;
    this.resource = resource;
    this.operation = operation;
  }

  /**
   * Get a TypeORM repository by resource name.
   * For spec-driven resources: registered with `SpecRepo_<name>` token.
   * For Foundation entities: throw with guidance (use getService instead).
   */
  getRepository(name: string): Repository<any> {
    try {
      return this.moduleRef.get(getRepositoryToken(name as any), { strict: false });
    } catch {
      throw new Error(
        `Repository "${name}" not found. Spec-driven resources are available by name. ` +
          `For Foundation entities, use ctx.getService() to access the relevant service.`,
      );
    }
  }

  /**
   * Get a Foundation service by name.
   *
   * Known services:
   *   'MailerService'           — sync email sending
   *   'QueuedMailerService'     — async email via BullMQ
   *   'EmailService'            — queue management
   *   'FilesService'            — file CRUD facade
   *   'ErrorTrackerService'     — error logging
   *   'ConfigService'           — config access
   */
  getService<T = any>(token: string): T {
    if (token === 'ConfigService') {
      return this.configService as T;
    }

    if (!isKnownService(token)) {
      throw new Error(
        `Unknown service: "${token}". Available: ${KNOWN_SERVICES.join(', ')}`,
      );
    }

    const serviceClass = SERVICE_CLASS_MAP[token];
    if (!serviceClass) {
      throw new Error(
        `Service "${token}" is known but not available. ` +
          `Ensure the module that provides it is imported in AppModule.`,
      );
    }

    try {
      return this.moduleRef.get(serviceClass, { strict: false }) as T;
    } catch {
      throw new Error(
        `Service "${token}" could not be resolved from DI container. ` +
          `Ensure the module that provides it is imported in AppModule.`,
      );
    }
  }

  /**
   * Get a config value by key path.
   * @example ctx.config('app.notificationEmail')
   * @example ctx.config('mail.host')
   */
  config(key: string): any {
    return this.configService.get(key as any, { infer: true });
  }

  /**
   * Send an email via the queued mailer service.
   */
  async sendEmail(data: EmailJobDataLike): Promise<void> {
    const queuedMailer = this.getService<QueuedMailerService>('QueuedMailerService');
    return queuedMailer.sendMail(data);
  }

  /**
   * Abort the current operation with an HTTP error.
   */
  abort(message: string, statusCode = 400): never {
    throw new HookAbortError(message, statusCode);
  }

  /**
   * Log an error to ErrorTrackerService (persists to DB).
   */
  async logError(
    message: string,
    source?: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    try {
      const errorTracker = this.getService<ErrorTrackerService>('ErrorTrackerService');
      await errorTracker.logError({
        message,
        source: source || `spec-engine:${this.resource}:${this.operation}`,
        metadata,
      });
    } catch {
      this.logger.error(`Failed to log error to ErrorTracker: ${message}`);
    }
  }
}

export { HookAbortError } from './spec.types';