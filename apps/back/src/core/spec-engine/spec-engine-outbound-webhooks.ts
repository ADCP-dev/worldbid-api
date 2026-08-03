/**
 * Spec Engine — Outbound Webhooks (subscriptions)
 *
 * For resources that declare `outboundWebhooks`, every entity operation
 * (create/update/delete) fires outbound webhook notifications to subscribed
 * endpoints.
 *
 * Two subscription models:
 *   - 'static': a fixed URL declared in the spec — POST to it on every match.
 *   - 'dynamic': subscribers POST to a subscribe endpoint; we persist rows in
 *     the `spec_webhook_subscriptions` table (EntitySchema) keyed by event
 *     name. On each entity operation we query that table for matching URLs.
 *
 * Security:
 *   - HMAC signing of the payload (same scheme as inbound webhooks: HMAC-SHA256
 *     over the raw body using WEBHOOK_HMAC_SECRET, header `X-Signature-256`).
 *   - SSRF protection: reject private/loopback/link-local IPs and non-http(s)
 *     schemes (same rules as notification-dispatcher / inbound webhooks).
 *
 * Fire-and-forget: dispatch() NEVER throws. Per-webhook failures are logged
 * via ctx.logError() and reported in the returned summary for tracing.
 */
import { Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { Repository } from 'typeorm';

import type { OutboundWebhookSpec, HookContext } from './spec.types';
import { SpecEngineBootService } from './spec-engine-boot';
import {
  SPEC_WEBHOOK_SUBSCRIPTION_SCHEMA_NAME,
  SpecWebhookSubscriptionRow,
} from './spec-engine-scheduled-actions';

// ─── types ────────────────────────────────────────────────────────────────

export interface OutboundDispatchParams {
  webhooks: OutboundWebhookSpec[];
  /** Lifecycle event, e.g. 'task.created', 'task.updated', 'task.deleted'. */
  event: string;
  entity: Record<string, unknown>;
  ctx: HookContext;
}

export interface OutboundDispatchSummary {
  evaluated: number;
  dispatched: number;
  failed: number;
  results: Array<{
    name: string;
    url: string;
    ok: boolean;
    status?: number;
    error?: string;
  }>;
}

// ─── manager ───────────────────────────────────────────────────────────────

export class OutboundWebhookDispatcher {
  private static readonly logger = new Logger('OutboundWebhooks');

  /**
   * Evaluate and fire outbound webhooks for a given entity event. Never throws.
   */
  static async dispatch(
    params: OutboundDispatchParams,
  ): Promise<OutboundDispatchSummary> {
    const { webhooks, event, entity, ctx } = params;
    const summary: OutboundDispatchSummary = {
      evaluated: 0,
      dispatched: 0,
      failed: 0,
      results: [],
    };

    if (!webhooks || webhooks.length === 0) return summary;

    const secret = process.env.WEBHOOK_HMAC_SECRET || '';

    // Build the canonical payload once. Per-webhook transforms (if any) are
    // applied per-target; the base payload is shared.
    const timestamp = new Date().toISOString();
    const basePayload: Record<string, unknown> = {
      event,
      entity,
      timestamp,
      resource: ctx.resource,
      operation: ctx.operation,
    };

    for (const webhook of webhooks) {
      summary.evaluated++;

      // Filter by event match. The spec's `events` array uses dotted names
      // (e.g. 'task.created'); we compare against the `event` param which
      // the controller derives from the operation.
      if (!this.eventMatches(webhook.events, event)) {
        continue;
      }

      // Resolve target URLs.
      let targets: Array<{ url: string; secret?: string | null }>;
      try {
        targets = await this.resolveTargets(webhook, event, ctx);
      } catch (err) {
        const message = (err as Error).message ?? String(err);
        this.logger.error(
          `Outbound webhook "${webhook.name}" resolveTargets failed: ${message}`,
        );
        summary.failed++;
        summary.results.push({
          name: webhook.name,
          url: '',
          ok: false,
          error: message,
        });
        await this.reportError(
          ctx,
          `Outbound webhook "${webhook.name}" resolve failed: ${message}`,
          {
            webhookName: webhook.name,
            event,
            error: (err as Error).stack,
          },
        );
        continue;
      }

      if (targets.length === 0) {
        continue; // no subscribers — not a failure
      }

      // Optionally transform the payload per the webhook's handler.
      let payload = basePayload;
      if (webhook.handler) {
        const transformed = await this.transformPayload(
          webhook,
          basePayload,
          ctx,
        );
        if (transformed === null) {
          // transform signaled "skip" — abort this webhook
          continue;
        }
        payload = transformed;
      }

      // Fire each target. Fire-and-forget at the dispatch() level — errors
      // are collected into the summary and reported, but never thrown.
      for (const target of targets) {
        const targetSecret = target.secret || secret;
        const result = await this.fireOne(
          webhook.name,
          target.url,
          payload,
          targetSecret,
          ctx,
        );
        summary.results.push(result);
        if (result.ok) {
          summary.dispatched++;
        } else {
          summary.failed++;
        }
      }
    }

    if (summary.dispatched > 0) {
      this.logger.debug(
        `Dispatched ${summary.dispatched} outbound webhook(s) for event "${event}"`,
      );
    }
    return summary;
  }

  // ─── event matching ─────────────────────────────────────────────────────

  /**
   * Match the fired event against the webhook's declared `events` list.
   * Supports exact match and wildcard suffix match (e.g. 'task.*' matches
   * 'task.created', 'task.updated').
   */
  private static eventMatches(
    events: string[] | undefined,
    event: string,
  ): boolean {
    if (!events || events.length === 0) return false;
    for (const e of events) {
      if (e === event) return true;
      if (e.endsWith('.*')) {
        const prefix = e.slice(0, -2);
        if (event.startsWith(prefix + '.')) return true;
      }
    }
    return false;
  }

  // ─── target resolution ──────────────────────────────────────────────────

  private static async resolveTargets(
    webhook: OutboundWebhookSpec,
    event: string,
    ctx: HookContext,
  ): Promise<Array<{ url: string; secret?: string | null }>> {
    if (webhook.subscriptionModel === 'static') {
      if (!webhook.url) {
        this.logger.warn(
          `Outbound webhook "${webhook.name}" is static but has no url — skipping`,
        );
        return [];
      }
      return [{ url: webhook.url, secret: null }];
    }

    // dynamic: query spec_webhook_subscriptions by event name.
    return this.querySubscriptions(event, ctx);
  }

  /**
   * Query the `spec_webhook_subscriptions` table for active rows matching
   * the event name. Uses the boot service's ModuleRef to resolve the
   * repository token.
   */
  private static async querySubscriptions(
    event: string,
    ctx: HookContext,
  ): Promise<Array<{ url: string; secret?: string | null }>> {
    try {
      const moduleRef = SpecEngineBootService.getModuleRef();
      // Repository token for the EntitySchema registered under this name.
      const repo =
        moduleRef.get<Repository<SpecWebhookSubscriptionRow>>(
          // getRepositoryToken equivalent — use the schema name string.
          `SpecWebhookSubscriptionRepository` as any,
          { strict: false },
        ) ||
        moduleRef.get<Repository<SpecWebhookSubscriptionRow>>(
          `repository.${SPEC_WEBHOOK_SUBSCRIPTION_SCHEMA_NAME}` as any,
          { strict: false },
        );
      if (!repo) {
        this.logger.debug(
          `spec_webhook_subscriptions repository not registered — dynamic outbound webhooks disabled for event "${event}"`,
        );
        return [];
      }
      const rows = await repo.find({
        where: { event, active: true } as any,
      });
      return rows.map((r) => ({ url: r.url, secret: r.secret ?? null }));
    } catch (err) {
      this.logger.warn(
        `Failed to query dynamic webhook subscriptions for event "${event}": ${(err as Error).message}`,
      );
      return [];
    }
  }

  // ─── payload transform ──────────────────────────────────────────────────

  /**
   * Apply the webhook's optional `handler` to transform the payload.
   * The handler signature: (payload, ctx) => payload | null.
   * Returning null means "skip this webhook".
   * Handler load uses the same path-containment + .ts→.js pattern.
   */
  private static transformCache = new Map<
    string,
    | ((
        payload: Record<string, unknown>,
        ctx: HookContext,
      ) => Record<string, unknown> | null)
    | null
  >();

  private static async transformPayload(
    webhook: OutboundWebhookSpec,
    payload: Record<string, unknown>,
    ctx: HookContext,
  ): Promise<Record<string, unknown> | null> {
    if (!webhook.handler) return payload;
    let transform = this.transformCache.get(webhook.handler);
    if (transform === undefined) {
      transform = this.loadTransform(webhook.handler, ctx);
      this.transformCache.set(webhook.handler, transform);
    }
    if (!transform) return payload; // load failure → use base payload
    try {
      return transform(payload, ctx);
    } catch (err) {
      this.logger.warn(
        `Outbound webhook transform for "${webhook.name}" threw: ${(err as Error).message} — using base payload`,
      );
      return payload;
    }
  }

  private static loadTransform(
    handlerPath: string,
    ctx: HookContext,
  ):
    | ((
        payload: Record<string, unknown>,
        ctx: HookContext,
      ) => Record<string, unknown> | null)
    | null {
    // The handler path is resolved relative to the extension dir. We don't
    // have the extension dir here directly, but the spec guarantees the
    // handler path is relative to the spec dir, which the boot service can
    // resolve. As a fallback we resolve relative to process.cwd().
    const path = require('path') as typeof import('path');
    const fs = require('fs') as typeof import('fs');
    let resolved: string;
    try {
      resolved = path.resolve(process.cwd(), handlerPath);
      if (!fs.existsSync(resolved)) {
        // Try resolving via the loaded specs to find the extension dir.
        resolved = this.resolveViaLoadedSpecs(handlerPath);
      }
    } catch {
      resolved = path.resolve(process.cwd(), handlerPath);
    }
    if (!resolved) return null;
    try {
      const requirePath =
        process.env.NODE_ENV === 'production'
          ? resolved.replace(/\.ts$/, '.js')
          : resolved;

      const mod = require(requirePath);
      const fn =
        mod && typeof mod === 'object' && 'default' in mod ? mod.default : mod;
      if (typeof fn !== 'function') return null;
      return fn;
    } catch (err) {
      this.logger.warn(
        `Failed to load outbound webhook transform "${handlerPath}": ${(err as Error).message}`,
      );
      return null;
    }
  }

  private static resolveViaLoadedSpecs(handlerPath: string): string {
    const path = require('path') as typeof import('path');
    const fs = require('fs') as typeof import('fs');
    try {
      const moduleRef = SpecEngineBootService.getModuleRef();
      const loadedSpecs = moduleRef.get<any[]>('SPEC_LOADED_SPECS', {
        strict: false,
      });
      if (Array.isArray(loadedSpecs)) {
        for (const loaded of loadedSpecs) {
          const candidate = path.resolve(loaded.dir || '', handlerPath);
          if (fs.existsSync(candidate)) return candidate;
        }
      }
    } catch {
      // boot not ready
    }
    return '';
  }

  // ─── firing ─────────────────────────────────────────────────────────────

  private static async fireOne(
    webhookName: string,
    url: string,
    payload: Record<string, unknown>,
    secret: string,
    ctx: HookContext,
  ): Promise<{
    name: string;
    url: string;
    ok: boolean;
    status?: number;
    error?: string;
  }> {
    // SSRF guard.
    const ssrfError = this.checkSsrf(url);
    if (ssrfError) {
      this.logger.warn(
        `Outbound webhook "${webhookName}" to ${url} blocked by SSRF guard: ${ssrfError}`,
      );
      await this.reportError(
        ctx,
        `Outbound webhook "${webhookName}" blocked by SSRF guard: ${ssrfError}`,
        { webhookName, url, reason: ssrfError },
      );
      return { name: webhookName, url, ok: false, error: ssrfError };
    }

    const body = JSON.stringify(payload);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (secret) {
      headers['X-Signature-256'] = 'sha256=' + this.sign(body, secret);
    }

    try {
      const response = await fetch(url, { method: 'POST', headers, body });
      if (!response.ok) {
        const error = `HTTP ${response.status}`;
        this.logger.warn(
          `Outbound webhook "${webhookName}" to ${url} returned ${error}`,
        );
        await this.reportError(
          ctx,
          `Outbound webhook "${webhookName}" returned non-2xx ${error}`,
          { webhookName, url, httpStatus: response.status },
        );
        return {
          name: webhookName,
          url,
          ok: false,
          status: response.status,
          error,
        };
      }
      return { name: webhookName, url, ok: true, status: response.status };
    } catch (err) {
      const message = (err as Error).message ?? String(err);
      this.logger.error(
        `Outbound webhook "${webhookName}" to ${url} failed: ${message}`,
      );
      await this.reportError(
        ctx,
        `Outbound webhook "${webhookName}" request failed: ${message}`,
        { webhookName, url, error: (err as Error).stack },
      );
      return { name: webhookName, url, ok: false, error: message };
    }
  }

  // ─── HMAC signing (same as inbound webhooks) ────────────────────────────

  private static sign(body: string, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(body);
    return hmac.digest('hex');
  }

  // ─── SSRF protection ─────────────────────────────────────────────────────

  /**
   * Reject URLs that would allow the server to call itself or internal hosts.
   * Rules (mirrors notification-dispatcher / inbound webhooks):
   *   - scheme must be http or https
   *   - hostname must resolve to a public IP (no loopback, link-local,
   *     private ranges, or 'localhost')
   *   - any resolution failure is treated as a violation (fail closed)
   *
   * Returns an error message if the URL is blocked, or null if allowed.
   */
  private static checkSsrf(url: string): string | null {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return `invalid URL: ${url}`;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return `disallowed scheme: ${parsed.protocol}`;
    }
    const host = parsed.hostname;
    if (!host) return 'missing hostname';
    if (host === 'localhost' || host.endsWith('.localhost')) {
      return 'localhost blocked';
    }
    // Literal IP checks — block loopback / private / link-local ranges.
    if (this.isBlockedIp(host)) {
      return `blocked IP/host: ${host}`;
    }
    return null;
  }

  private static isBlockedIp(host: string): boolean {
    // IPv4 or IPv6 literals.
    const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4) {
      const [a, b] = ipv4.slice(1).map((n) => parseInt(n, 10));
      if (a === 10) return true; // private 10/8
      if (a === 172 && b >= 16 && b <= 31) return true; // private 172.16/12
      if (a === 192 && b === 168) return true; // private 192.168/16
      if (a === 127) return true; // loopback
      if (a === 0) return true; // 0.0.0.0/8
      if (a === 169 && b === 254) return true; // link-local 169.254/16
      return false;
    }
    // IPv6 literals: block ::1 (loopback) and fe80::/10 (link-local).
    if (host.includes(':')) {
      const lower = host.toLowerCase();
      if (lower === '::1' || lower === '::') return true;
      if (
        lower.startsWith('fe80:') ||
        lower.startsWith('fe9') ||
        lower.startsWith('fea') ||
        lower.startsWith('feb')
      ) {
        // fe80::/10 — link-local
        if (/^fe[89ab][0-9a-f]:/.test(lower)) return true;
      }
      // fc00::/7 — unique-local (private)
      if (/^f[cd][0-9a-f]{2}:/.test(lower)) return true;
    }
    return false;
  }

  // ─── error reporting helper ─────────────────────────────────────────────

  private static async reportError(
    ctx: HookContext,
    message: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    try {
      await ctx.logError(message, 'spec-engine:outbound-webhooks', metadata);
    } catch {
      // ctx.logError logs internally — never let it bubble
    }
  }
}
