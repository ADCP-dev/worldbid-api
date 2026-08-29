/**
 * WebhookControllerFactory
 * -------------------------
 * Creates dynamic NestJS controllers for inbound webhook endpoints defined in
 * spec YAML. Each controller handles a single POST route, verifies the
 * configured auth mode (none | hmac | jwt), loads the handler module at startup,
 * and invokes it at request time with a full HookContext.
 *
 * The HookContext is built via SpecEngineBootService (same as lifecycle hooks),
 * giving webhook handlers access to repositories, services, config, logger,
 * and error reporting.
 */

import {
  Controller,
  Post,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  InternalServerErrorException,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags } from '@nestjs/swagger';
import * as crypto from 'crypto';
import * as path from 'path';
import type { Request } from 'express';

import type { WebhookSpec } from './spec.types';
import type { HookContext as SpecHookContext } from './spec.types';
import { SpecEngineBootService } from './spec-engine-boot';
import { HookContextImpl } from './hook-context';
import { TraceBuilder } from './spec-trace';
import { attachTraceToError } from './error-trace';

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export type WebhookHandler = (
  payload: any,
  ctx: SpecHookContext,
) => Promise<void>;

export interface WebhookControllerFactoryResult {
  controllerClass: any;
}

/* -------------------------------------------------------------------------- */
/* JWT guard (reused across all jwt-mode controllers)                          */
/* -------------------------------------------------------------------------- */

const JwtAuthGuard = AuthGuard('jwt');

/* -------------------------------------------------------------------------- */
/* Factory                                                                     */
/* -------------------------------------------------------------------------- */

export class WebhookControllerFactory {
  private static readonly logger = new Logger('WebhookControllerFactory');

  /**
   * Create a dynamic NestJS controller for a single webhook spec.
   */
  static create(
    spec: WebhookSpec,
    extensionDir: string,
    resourceName: string,
  ): WebhookControllerFactoryResult {
    const webhookName = spec.name;
    const routePath = this.normalizeRoutePath(spec.path);
    const authMode = spec.auth ?? 'none';

    // Load the handler at startup (cached)
    const { handler, handlerError } = this.loadHandler(spec, extensionDir);

    const logger = new Logger(`Webhook:${webhookName}`);

    @Controller(routePath)
    @ApiTags(`webhooks-${resourceName}`)
    class DynamicWebhookController {
      private readonly logger = logger;
      private readonly webhookName = webhookName;
      private readonly resourceName = resourceName;
      private readonly handler: WebhookHandler | null = handler;
      private readonly handlerError: string | null = handlerError;
      private readonly authMode = authMode;
      private readonly webhookSecret: string | undefined =
        process.env.WEBHOOK_HMAC_SECRET;

      @Post()
      @HttpCode(HttpStatus.OK)
      async handleWebhook(
        @Body() body: any,
        @Req() req: Request,
      ): Promise<{ status: string }> {
        this.logger.log(
          `Received webhook '${this.webhookName}' on ${req.method} ${req.url}`,
        );

        // Auth verification
        if (this.authMode === 'hmac') {
          this.verifyHmac(req, body);
        }

        // Handler availability
        if (this.handlerError || !this.handler) {
          this.logger.error(
            `Handler not available: ${this.handlerError ?? 'no handler loaded'}`,
          );
          throw new InternalServerErrorException(
            'Webhook handler is not configured',
          );
        }

        // Build full HookContext via SpecEngineBootService
        let ctx: SpecHookContext;
        let trace: TraceBuilder | null = null;
        try {
          const moduleRef = SpecEngineBootService.getModuleRef();
          const configService = SpecEngineBootService.getConfigService();
          const user = (req as any).user ?? null;
          trace = new TraceBuilder(
            this.resourceName,
            'webhook',
            user ? { id: user.id, role: user.role?.name || '' } : null,
            this.logger,
            process.env.NODE_ENV !== 'production',
            req.headers?.['x-request-id'] as string | undefined,
          );

          ctx = new HookContextImpl(
            moduleRef,
            configService,
            user,
            this.resourceName,
            'webhook',
            trace,
          ) as unknown as SpecHookContext;
        } catch (err) {
          this.logger.error(
            `Failed to build HookContext: ${(err as Error).message}`,
          );
          throw new InternalServerErrorException('Internal context error');
        }

        // Invoke the handler
        try {
          await this.handler(body, ctx);
          trace.finish();
          this.logger.log(
            `Webhook '${this.webhookName}' processed successfully`,
          );
          return { status: 'ok' };
        } catch (err) {
          trace.endStage(
            'response',
            'fail',
            { error: err instanceof Error ? err.message : String(err) },
            undefined,
            undefined,
            {
              message: err instanceof Error ? err.message : String(err),
              code: 'WEBHOOK_HANDLER_ERROR',
            },
          );
          trace.finish();
          attachTraceToError(
            err instanceof Error ? err : new Error(String(err)),
            {
              ...trace.toJSON(),
              layer: 'webhook_controller',
              step: `webhook ${this.webhookName} handler`,
            },
          );
          const message = err instanceof Error ? err.message : String(err);
          this.logger.error(
            `Handler error for webhook '${this.webhookName}': ${message}`,
            err instanceof Error ? err.stack : undefined,
          );
          throw new InternalServerErrorException('Webhook handler failed');
        }
      }

      /* ----------------------- HMAC verification ------------------------ */

      private verifyHmac(req: Request, body: any): void {
        const signatureHeader =
          (req.headers['x-signature-256'] as string | undefined) ??
          (req.headers['X-Signature-256'] as string | undefined);

        if (!signatureHeader) {
          this.logger.warn(
            `Missing X-Signature-256 header for webhook '${this.webhookName}'`,
          );
          throw new UnauthorizedException('Missing signature header');
        }

        if (!this.webhookSecret || this.webhookSecret === '') {
          this.logger.error(
            `No WEBHOOK_HMAC_SECRET configured for webhook '${this.webhookName}'`,
          );
          throw new InternalServerErrorException('HMAC secret not configured');
        }

        const rawBody: Buffer | string =
          (req as any).rawBody ??
          Buffer.from(
            typeof body === 'string' || Buffer.isBuffer(body)
              ? body
              : JSON.stringify(body ?? {}),
          );

        const expected = this.computeSignature(rawBody, this.webhookSecret);
        const provided = signatureHeader.startsWith('sha256=')
          ? signatureHeader.slice('sha256='.length)
          : signatureHeader;

        if (!this.safeCompareHex(provided, expected)) {
          this.logger.warn(
            `Invalid HMAC signature for webhook '${this.webhookName}'`,
          );
          throw new UnauthorizedException('Invalid signature');
        }
      }

      private computeSignature(data: Buffer | string, secret: string): string {
        const hmac = crypto.createHmac('sha256', secret);
        hmac.update(data as any);
        return hmac.digest('hex');
      }

      private safeCompareHex(a: string, b: string): boolean {
        const bufA = Buffer.from(a, 'hex');
        const bufB = Buffer.from(b, 'hex');

        if (bufA.length !== bufB.length) {
          crypto.timingSafeEqual(bufB, bufB);
          return false;
        }

        return crypto.timingSafeEqual(bufA, bufB);
      }
    }

    // Apply JWT guard only when required
    if (authMode === 'jwt') {
      UseGuards(JwtAuthGuard)(DynamicWebhookController);
    }

    Object.defineProperty(DynamicWebhookController, 'name', {
      value: `WebhookController_${resourceName}_${webhookName}`.replace(
        /[^a-zA-Z0-9_]/g,
        '_',
      ),
      configurable: true,
    });

    return { controllerClass: DynamicWebhookController };
  }

  /* ------------------------------------------------------------------------ */
  /* Helpers                                                                   */
  /* ------------------------------------------------------------------------ */

  private static normalizeRoutePath(rawPath: string): string {
    if (!rawPath || typeof rawPath !== 'string') {
      throw new Error(
        `WebhookControllerFactory: invalid spec path "${rawPath}"`,
      );
    }
    return rawPath.startsWith('/') ? rawPath.slice(1) : rawPath;
  }

  private static loadHandler(
    spec: WebhookSpec,
    extensionDir: string,
  ): { handler: WebhookHandler | null; handlerError: string | null } {
    try {
      const handlerFilePath = path.resolve(extensionDir, spec.handler);
      // Path containment check
      const normalizedDir = path.resolve(extensionDir) + path.sep;
      if (!handlerFilePath.startsWith(normalizedDir)) {
        this.logger.warn(
          `⚠️  Webhook handler "${spec.handler}" escapes extension directory`,
        );
        return {
          handler: null,
          handlerError: 'Handler path escapes extension directory',
        };
      }
      // In production, .ts → .js
      const requirePath =
        process.env.NODE_ENV === 'production'
          ? handlerFilePath.replace(/\.ts$/, '.js')
          : handlerFilePath;

      // eslint-disable-next-line @typescript-eslint/no-require-imports -- dynamic extension handler load (cached at materialization time)
      const mod = require(requirePath);

      const handlerFn: unknown =
        mod && typeof mod === 'object' && 'default' in mod ? mod.default : mod;

      if (typeof handlerFn !== 'function') {
        const msg = `Handler file "${spec.handler}" does not export a function`;
        this.logger.warn(msg);
        return { handler: null, handlerError: msg };
      }

      this.logger.log(
        `Loaded webhook handler "${spec.name}" from ${handlerFilePath}`,
      );

      return { handler: handlerFn as WebhookHandler, handlerError: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Failed to load handler for webhook "${spec.name}" ` +
          `(handler: "${spec.handler}"): ${message}`,
      );
      return {
        handler: null,
        handlerError: `Failed to load handler: ${message}`,
      };
    }
  }
}
