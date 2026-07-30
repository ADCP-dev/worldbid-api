/**
 * WebhookControllerFactory
 * -------------------------
 * Creates dynamic NestJS controllers for inbound webhook endpoints defined in
 * spec YAML. Each controller handles a single POST route, verifies the
 * configured auth mode (none | hmac | jwt), loads the handler module at startup,
 * and invokes it at request time with a minimal HookContext.
 *
 * The factory is intended to be called at NestJS module-registration time
 * (e.g. via DynamicModule / controllers array). The returned controller class
 * is registered against the spec `path`.
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

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export interface WebhookSpec {
  name: string;
  path: string; // URL path like 'tasks/webhooks/stale'
  method: 'POST';
  auth: 'none' | 'hmac' | 'jwt';
  handler: string; // path to handler .ts file, relative to spec dir
}

export interface HookContext {
  logger: Logger;
  resourceName: string;
  extensionDir: string;
  webhookName: string;
}

export type WebhookHandler = (payload: any, ctx: HookContext) => Promise<void>;

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
   *
   * @param spec           The webhook definition from spec YAML.
   * @param extensionDir   Absolute path to the extension directory that owns
   *                       this webhook (used to resolve the handler file).
   * @param resourceName   The resource name this webhook belongs to.
   * @returns              The dynamic controller class ready for NestJS module
   *                       registration.
   */
  static create(
    spec: WebhookSpec,
    extensionDir: string,
    resourceName: string,
  ): WebhookControllerFactoryResult {
    const webhookName = spec.name;
    const routePath = this.normalizeRoutePath(spec.path);
    const authMode = spec.auth ?? 'none';

    // --- Load the handler at startup (cached) -------------------------------
    const { handler, handlerError } = this.loadHandler(spec, extensionDir);

    // --- Shared logger ------------------------------------------------------
    const logger = new Logger(`Webhook:${webhookName}`);

    // --- Build the dynamic controller class ---------------------------------
    @Controller(routePath)
    @ApiTags(`webhooks-${resourceName}`)
    class DynamicWebhookController {
      private readonly logger = logger;
      private readonly webhookName = webhookName;
      private readonly resourceName = resourceName;
      private readonly extensionDir = extensionDir;
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

        // --- Auth verification --------------------------------------------
        if (this.authMode === 'hmac') {
          this.verifyHmac(req, body);
        }
        // 'jwt' is enforced by the JwtAuthGuard applied below.
        // 'none' requires no verification.

        // --- Handler availability -----------------------------------------
        if (this.handlerError || !this.handler) {
          this.logger.error(
            `Handler not available: ${this.handlerError ?? 'no handler loaded'}`,
          );
          throw new InternalServerErrorException(
            'Webhook handler is not configured',
          );
        }

        // --- Build a minimal HookContext ----------------------------------
        const ctx: HookContext = {
          logger: this.logger,
          resourceName: this.resourceName,
          extensionDir: this.extensionDir,
          webhookName: this.webhookName,
        };

        // --- Invoke the handler -------------------------------------------
        try {
          await this.handler(body, ctx);
          this.logger.log(`Webhook '${this.webhookName}' processed successfully`);
          return { status: 'ok' };
        } catch (err) {
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

        if (!this.webhookSecret) {
          this.logger.error(
            `No WEBHOOK_HMAC_SECRET configured for webhook '${this.webhookName}'`,
          );
          throw new InternalServerErrorException(
            'HMAC secret not configured',
          );
        }

        // Prefer the cached raw body if available (body-parser / rawBody).
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

      /**
       * Timing-safe comparison of two hex strings.
       * Both are converted to Buffers first; if lengths differ we still
       * perform a comparison against a same-length buffer to avoid leaking
       * length information via timing.
       */
      private safeCompareHex(a: string, b: string): boolean {
        const bufA = Buffer.from(a, 'hex');
        const bufB = Buffer.from(b, 'hex');

        if (bufA.length !== bufB.length) {
          // Still run a comparison to keep timing constant-ish.
          timingSafeEqual(bufB, bufB);
          return false;
        }

        return crypto.timingSafeEqual(bufA, bufB);
      }
    }

    // Apply the JWT guard only when required. We decorate the class after
    // creation so that non-jwt controllers never touch @nestjs/passport.
    if (authMode === 'jwt') {
      UseGuards(JwtAuthGuard)(DynamicWebhookController);
    }

    // Give the dynamic class a readable name for debugging / NestJS logs.
    Object.defineProperty(DynamicWebhookController, 'name', {
      value: `WebhookController_${resourceName}_${webhookName}`
        .replace(/[^a-zA-Z0-9_]/g, '_'),
      configurable: true,
    });

    return { controllerClass: DynamicWebhookController };
  }

  /* ------------------------------------------------------------------------ */
  /* Helpers                                                                   */
  /* ------------------------------------------------------------------------ */

  /**
   * Ensure the route path does not have a leading slash (NestJS controllers
   * are mounted relative to the global prefix) and is a non-empty string.
   */
  private static normalizeRoutePath(rawPath: string): string {
    if (!rawPath || typeof rawPath !== 'string') {
      throw new Error(`WebhookControllerFactory: invalid spec path "${rawPath}"`);
    }
    return rawPath.startsWith('/') ? rawPath.slice(1) : rawPath;
  }

  /**
   * Load and cache the webhook handler module at startup.
   *
   * The handler file path in the spec is relative to the extension directory.
   * We resolve it to an absolute path and require() it. The module must export
   * a default function matching `WebhookHandler`.
   *
   * If the file cannot be found or does not export a valid handler, a warning
   * is logged and `handlerError` is set so the controller can return 500.
   */
  private static loadHandler(
    spec: WebhookSpec,
    extensionDir: string,
  ): { handler: WebhookHandler | null; handlerError: string | null } {
    try {
      const handlerFilePath = path.resolve(extensionDir, spec.handler);
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require(handlerFilePath);

      const handlerFn: unknown =
        mod && typeof mod === 'object' && 'default' in mod
          ? mod.default
          : mod;

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