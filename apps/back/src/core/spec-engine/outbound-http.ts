/**
 * Outbound HTTP helper for spec-engine webhook/notification fetches.
 *
 * Centralizes three cross-cutting concerns for every outbound request:
 *
 *   1. Timeout — every fetch gets an AbortSignal so a hung receiver can
 *      never pin the event loop. Configurable via SPEC_ENGINE_WEBHOOK_TIMEOUT_MS
 *      (default 10000 ms, must be a positive integer).
 *
 *   2. Per-webhook HMAC secret resolution — precedence: per-webhook secret
 *      declared in the spec (webhooks[].hmacSecret) → env fallback
 *      (WEBHOOK_HMAC_SECRET) → no signature at all. When no secret is
 *      available we still deliver (unsigned) but log a loud, one-time WARN
 *      per webhook so operators notice unsigned deliveries. The warn-once
 *      set lives at module level so repeated dispatches (and tests) don't
 *      spam identical warnings.
 *
 *   3. Safe failure logging — on fetch failure/timeout we WARN with bounded
 *      detail (url host + status/error name only). Never log secrets,
 *      payloads, or full URLs with query strings.
 */

import { Logger } from '@nestjs/common';

export const SPEC_ENGINE_WEBHOOK_TIMEOUT_MS = 'SPEC_ENGINE_WEBHOOK_TIMEOUT_MS';

/** Default outbound timeout: 10 seconds. */
export const DEFAULT_WEBHOOK_TIMEOUT_MS = 10_000;

const logger = new Logger('OutboundHttp');

/** One-time warnings keyed by a stable per-webhook identifier. */
const warnedMissingSecret = new Set<string>();

/** Read the configured timeout in ms (env override with safe default). */
export function getWebhookTimeoutMs(): number {
  const raw = process.env[SPEC_ENGINE_WEBHOOK_TIMEOUT_MS];
  if (raw === undefined || raw === '') return DEFAULT_WEBHOOK_TIMEOUT_MS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    logger.warn(
      `Invalid ${SPEC_ENGINE_WEBHOOK_TIMEOUT_MS}="${raw}" — using default ${DEFAULT_WEBHOOK_TIMEOUT_MS}ms`,
    );
    return DEFAULT_WEBHOOK_TIMEOUT_MS;
  }
  return parsed;
}

export interface ResolveSecretParams {
  /** Stable identifier used to dedupe the warn-once log (e.g. webhook name + URL). */
  webhookKey: string;
  /** Human-readable webhook name for logs. */
  webhookName: string;
  /** Per-webhook secret declared in the spec (highest precedence). */
  specSecret?: string | null;
  /** Env fallback secret (WEBHOOK_HMAC_SECRET). */
  envSecret?: string | null;
}

export interface ResolvedSecret {
  secret: string | null;
  signed: boolean;
}

/**
 * Resolve the HMAC secret for one webhook per the precedence chain:
 * spec field → env fallback → none (deliver unsigned + warn once).
 */
export function resolveWebhookSecret(
  params: ResolveSecretParams,
): ResolvedSecret {
  const { webhookKey, webhookName, specSecret, envSecret } = params;
  if (specSecret) {
    return { secret: specSecret, signed: true };
  }
  if (envSecret) {
    return { secret: envSecret, signed: true };
  }
  if (!warnedMissingSecret.has(webhookKey)) {
    warnedMissingSecret.add(webhookKey);
    logger.warn(
      `No HMAC secret configured for outbound webhook "${webhookName}" ` +
        '(no spec hmacSecret and no WEBHOOK_HMAC_SECRET env) — payload will be sent WITHOUT signature. ' +
        'Set webhooks[].hmacSecret or WEBHOOK_HMAC_SECRET to enable signing.',
    );
  }
  return { secret: null, signed: false };
}

/** Reset the warn-once set (used by tests). */
export function resetWarnedSecretsForTest(): void {
  warnedMissingSecret.clear();
}

/** Extract only the host from a URL for bounded logging. Never throws. */
export function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return '<invalid-url>';
  }
}

export interface PostJsonParams {
  url: string;
  body: string;
  headers: Record<string, string>;
  /** Human-readable name used in log lines. */
  name: string;
}

export interface PostJsonResult {
  ok: boolean;
  status?: number;
  error?: string;
}

/**
 * POST a JSON body with a hard timeout. Failures are logged (WARN, bounded
 * detail) and returned — never thrown — since outbound delivery is
 * fire-and-forget everywhere it is used.
 */
export async function postJsonWithTimeout(
  params: PostJsonParams,
): Promise<PostJsonResult> {
  const { url, body, headers, name } = params;
  const timeoutMs = getWebhookTimeoutMs();
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      logger.warn(
        `Outbound webhook "${name}" to ${safeHost(url)} returned HTTP ${response.status}`,
      );
      return {
        ok: false,
        status: response.status,
        error: `HTTP ${response.status}`,
      };
    }
    return { ok: true, status: response.status };
  } catch (err) {
    const errorName =
      err instanceof Error
        ? (err.name || 'Error') + `: ${err.message}`
        : String(err);
    logger.warn(
      `Outbound webhook "${name}" to ${safeHost(url)} failed: ${errorName} (timeout ${timeoutMs}ms)`,
    );
    return { ok: false, error: errorName };
  }
}
