/**
 * SpecErrorReporter — central error sink for the spec engine.
 *
 * Every SpecError produced by the spec engine (hook failures, validation
 * explosions, job crashes, webhook handler errors, …) flows through here.
 *
 * Responsibilities:
 *   1. Persist the error to the ErrorTrackerService DB (so it surfaces in the
 *      admin Error Tracker UI and is queryable / resolvable).
 *   2. On the FIRST occurrence of a unique error (deduplicated by hash) while
 *      running in production, open a GitHub issue via the `gh` CLI so the team
 *      is notified without manually watching logs.
 *
 * Why lazy injection?
 *   ErrorTrackerService lives in a different NestJS module graph than the
 *   spec engine. Injecting it through the constructor would create a circular
 *   dependency at module-registration time (the spec engine module is dynamic
 *   and built before the static error-tracker module is guaranteed to be
 *   resolved). Instead the host (typically FoundationModule or a bootstrap
 *   step) resolves ErrorTrackerService from the DI container and injects it
 *   via setErrorTrackerService() once it is available.
 */

import { Injectable, Logger } from '@nestjs/common';
import { execSync } from 'child_process';
import { createHash, randomUUID } from 'crypto';
import { existsSync } from 'fs';
import { join } from 'path';

import type {
  ActionableError,
  ErrorCategory,
  ErrorSeverity,
  FailurePointLayer,
  SuggestedFix,
  SpecError,
  SpecTrace,
} from './spec.types';
import type { ErrorTrackerService } from '@src/modules/error-tracker/error-tracker.service';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Keys whose values are scrubbed before being serialized into a GitHub issue
 * body. We never want credentials, tokens, or full file payloads in a public
 * (or even private) issue tracker.
 */
const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /passwd/i,
  /secret/i,
  /token/i,
  /authorization/i,
  /auth/i,
  /apikey/i,
  /api[_-]?key/i,
  /private[_-]?key/i,
  /refresh/i,
  /access/i,
  /cookie/i,
  /session/i,
  /ssn/i,
  /credit/i,
  /cvv/i,
  /credential/i,
  /bearer/i,
  /jwt/i,
  /secret[_-]?key/i,
];

/**
 * Compute the canonical deduplication hash for a spec error.
 *
 * Matches the scheme used by ErrorTrackerService.generateHash:
 *   sha256( message + source + stack[:200] )
 *
 * Exported so callers that build SpecError objects can populate `hash`
 * without depending on ErrorTrackerService internals.
 */
export function computeSpecErrorHash(
  message: string,
  source: string,
  stack?: string,
): string {
  const stackSnippet = stack ? stack.slice(0, 200) : '';
  return createHash('sha256')
    .update(`${message}${source}${stackSnippet}`)
    .digest('hex');
}

/**
 * Recursively scrub sensitive keys from an arbitrary value, returning a
 * JSON-safe copy. Non-serializable values (functions, symbols, BigInts,
 * circular references) are replaced with placeholder strings so the result
 * can always be JSON.stringify'd.
 */
function sanitizeForIssue(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[max depth reached]';
  if (value === null || value === undefined) return value;

  if (typeof value === 'function') return '[function]';
  if (typeof value === 'symbol') return '[symbol]';
  if (typeof value === 'bigint') return `[bigint: ${value.toString()}n]`;

  if (typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    return value.map((v) => sanitizeForIssue(v, depth + 1));
  }

  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    if (SENSITIVE_KEY_PATTERNS.some((re) => re.test(key))) {
      out[key] = '[redacted]';
    } else {
      try {
        out[key] = sanitizeForIssue(obj[key], depth + 1);
      } catch {
        out[key] = '[unserializable]';
      }
    }
  }
  return out;
}

/**
 * Safely stringify a value for inclusion in a markdown code block.
 */
function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(sanitizeForIssue(value), null, 2);
  } catch {
    return '[failed to serialize]';
  }
}

/**
 * Truncate a string to a max length, appending an ellipsis if truncated.
 */
function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + '…';
}

// ─── GitHub CLI detection ───────────────────────────────────────────────────

/**
 * Cached result of gh-availability check so we don't shell out on every error.
 */
let ghAvailabilityCache: boolean | null = null;

/**
 * Resolve the path to the `gh` CLI binary, or null if not found.
 *
 * Checks (in order):
 *   1. The known Hermes install location: ~/.hermes/home/.local/bin/gh
 *   2. `which gh` (i.e. anything on PATH)
 */
function findGhBinary(): string | null {
  if (ghAvailabilityCache === false) return null;
  if (ghAvailabilityCache === true) return 'gh';

  // 1. Known Hermes location
  const home = process.env.HOME || '/root';
  const hermesGh = join(home, '.hermes/home/.local/bin/gh');
  if (existsSync(hermesGh)) {
    ghAvailabilityCache = true;
    return hermesGh;
  }

  // 2. PATH lookup
  try {
    execSync('command -v gh', { stdio: 'ignore', shell: '/bin/sh' });
     ghAvailabilityCache = true;
     return 'gh';
   } catch {
     ghAvailabilityCache = false;
     return null;
   }
}

// ─── Actionable Error enrichment (PRD 01) ───────────────────────────────────

/**
 * Max serialized size of the `input` field in an ActionableError. Inputs
 * larger than this are truncated so error logs / GitHub issues don't blow
 * up on binary blobs or huge payloads.
 */
const MAX_INPUT_BYTES = 10 * 1024;

/**
 * Scrub sensitive keys from a payload and truncate it to MAX_INPUT_BYTES.
 * Reuses `SENSITIVE_KEY_PATTERNS` so the scrubbing policy is consistent
 * with the GitHub-issue body sanitizer. Pure function — no side effects.
 */
export function scrubSensitive(value: unknown): unknown {
  const scrubbed = sanitizeForIssue(value);
  // Truncate large string payloads to keep logs bounded.
  if (typeof scrubbed === 'string' && scrubbed.length > MAX_INPUT_BYTES) {
    return scrubbed.slice(0, MAX_INPUT_BYTES) + '[truncated]';
  }
  if (
    scrubbed &&
    typeof scrubbed === 'object' &&
    !Array.isArray(scrubbed)
  ) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(
      scrubbed as Record<string, unknown>,
    )) {
      if (typeof v === 'string' && v.length > MAX_INPUT_BYTES) {
        out[k] = v.slice(0, MAX_INPUT_BYTES) + '[truncated]';
      } else {
        out[k] = v;
      }
    }
    return out;
  }
  return scrubbed;
}

/**
 * Decide whether an error should be persisted to the error tracker.
 * `permission_denied` is expected behavior (a guard did its job) and is
 * NOT a bug — it is logged for audit but not tracked as an error. Client
 * input validation failures (wrong shape, missing required field) are
 * likewise not bugs in the server. Everything else is tracked.
 */
export function shouldTrackAsError(
  error: SpecError,
  trace: SpecTrace,
): boolean {
  if (trace.layer === 'permission_guard') return false;
  if (trace.layer === 'validation_factory' && isClientInputError(error)) {
    return false;
  }
  return true;
}

function isClientInputError(error: SpecError): boolean {
  const msg = error.message.toLowerCase();
  return (
    msg.includes('expected') ||
    msg.includes('required') ||
    msg.includes('invalid') ||
    msg.includes('must be')
  );
}

/**
 * Infer a suggested fix from the error message + trace using regex
 * heuristics. Returns null when no heuristic matches (the caller / agent
 * then decides what to do). Five patterns are detected:
 *
 *   1. null/undefined property access (Node 18+ and <18)
 *   2. foreign key constraint violation
 *   3. permission denied (layer=permission_guard)
 *   4. hook crash generic (layer=hook_executor)
 *   5. EntityMetadataNotFoundError (missing migration)
 *
 * Pure function — deterministic, no side effects.
 */
export function inferSuggestedFix(
  error: SpecError,
  trace: SpecTrace,
): SuggestedFix | null {
  const msg = error.message;

  // 1. null/undefined property access — "Cannot read properties of
  //    undefined (reading 'X')" (Node 18+) or "Cannot read property 'X'
  //    of undefined" (Node <18).
  if (
    msg.includes('Cannot read properties of undefined') ||
    msg.includes('Cannot read property')
  ) {
    const propMatch =
      msg.match(/reading '(\w+)'/) || msg.match(/Cannot read property '(\w+)'/);
    const prop = propMatch?.[1] || 'unknown';
    return {
      type: 'spec_fix',
      description: `Handler assumes that ${prop} exists but it arrived undefined/null. Mark ${prop} as required in the spec or add a null check in the handler.`,
      targetFile: trace.handlerFile ?? null,
      targetSpec: trace.specFile ?? null,
      targetField: prop,
      suggestedCode: null,
      confidence: 'medium',
    };
  }

  // 2. foreign key constraint violation
  if (msg.includes('violates foreign key constraint')) {
    return {
      type: 'data_fix',
      description:
        'Reference to an entity that does not exist. Verify the referenced ID exists before creating.',
      targetFile: null,
      targetSpec: trace.specFile ?? null,
      targetField: null,
      suggestedCode: null,
      confidence: 'high',
    };
  }

  // 3. permission denied — guard blocked access (expected, but we still
  //    surface a fix so an admin can grant the role if intended).
  if (trace.layer === 'permission_guard') {
    return {
      type: 'spec_fix',
      description: `User with role ${trace.userRole ?? 'unknown'} attempted ${trace.operation} on ${trace.resource}. If they should be allowed, add the role to permissions.${trace.operation} in the spec.`,
      targetFile: null,
      targetSpec: trace.specFile ?? null,
      targetField: null,
      suggestedCode: null,
      confidence: 'high',
    };
  }

  // 5. EntityMetadataNotFoundError — the entity table doesn't exist in the DB.
  if (msg.includes('EntityMetadataNotFoundError')) {
    return {
      type: 'config_fix',
      description:
        'Run `pnpm spec:generate-migration <extension>` and `pnpm migration:run` so the entity table exists in the database.',
      targetFile: null,
      targetSpec: null,
      targetField: null,
      suggestedCode: null,
      confidence: 'high',
    };
  }

  // 4. hook crash generic — a hook threw but the message doesn't match a
  //    more specific heuristic. Point at the handler file.
  if (trace.layer === 'hook_executor') {
    return {
      type: 'code_fix',
      description: `Hook at step "${trace.step}" threw an exception. Inspect the handler in ${trace.handlerFile ?? 'the hook file'}.`,
      targetFile: trace.handlerFile ?? null,
      targetSpec: null,
      targetField: null,
      suggestedCode: null,
      confidence: 'low',
    };
  }

  return null;
}

/**
 * Categorize an error into the ErrorCategory taxonomy based on the trace
 * layer + message. Pure function.
 */
function categorize(
  error: SpecError,
  trace: SpecTrace,
): ErrorCategory {
  switch (trace.layer) {
    case 'permission_guard':
      return 'permission_denied';
    case 'hook_executor':
      return 'hook_failure';
    case 'job_runner':
      return 'job_failure';
    case 'webhook_controller':
      return 'webhook_failure';
    case 'action_factory':
      return 'action_failure';
    case 'validation_factory':
      return 'validation';
    case 'notification_dispatcher':
      return 'notification';
    case 'spec_loader':
    case 'spec_engine_boot':
      return msgIsSpecInvalid(error.message) ? 'spec_invalid' : 'extension_load';
    case 'controller_factory':
      return msgIsNotFound(error.message) ? 'not_found' : 'database';
    default:
      return 'unknown';
  }
}

function msgIsSpecInvalid(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes('spec') ||
    m.includes('yaml') ||
    m.includes('invalid') ||
    m.includes('missing')
  );
}

function msgIsNotFound(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes('not found') || m.includes('no metadata');
}

/**
 * Infer a severity from the category + message. Critical = the extension
 * cannot load or the DB is unreachable; error = a real bug; warning =
 * expected-but-noteworthy (not_found, rate_limit). Pure function.
 */
function inferSeverity(
  error: SpecError,
  trace: SpecTrace,
): ErrorSeverity {
  const cat = categorize(error, trace);
  if (cat === 'extension_load' || cat === 'database') return 'critical';
  if (cat === 'not_found' || cat === 'rate_limit') return 'warning';
  return 'error';
}

/**
 * Build a fully-populated ActionableError from a SpecError + SpecTrace.
 * Pure function — the id + timestamp are generated here, occurrences are
 * initialized to 1 (the persistence layer updates them on dedup).
 */
export function buildActionableError(
  error: SpecError,
  trace: SpecTrace,
): ActionableError {
  const timestamp = new Date().toISOString();
  const category = categorize(error, trace);
  const severity = inferSeverity(error, trace);
  const layer: FailurePointLayer =
    trace.layer ?? 'spec_engine_boot';
  return {
    id: randomUUID(),
    hash: error.hash,
    timestamp,
    category,
    severity,
    extension: trace.extension ?? null,
    resource: trace.resource ?? error.resource ?? null,
    specFile: trace.specFile ?? null,
    operation: trace.operation ?? error.operation ?? 'unknown',
    input: (scrubSensitive(trace.input ?? {}) as Record<string, unknown>) ?? {},
    userId: trace.userId ?? null,
    requestId: trace.requestId ?? error.requestId ?? '',
    message: error.message,
    technicalMessage: error.message,
    stack: error.stack ?? '',
    handlerFile: trace.handlerFile ?? null,
    handlerFunction: trace.handlerFunction ?? null,
    failurePoint: {
      layer,
      step: trace.step ?? '',
      rawError: error.message,
    },
    suggestedFix: inferSuggestedFix(error, trace),
    relatedSpec: trace.specFile
      ? {
          specFile: trace.specFile,
          resource: trace.resource ?? '',
          field: null,
          section: 'fields',
          lineHint: null,
        }
      : null,
    occurrences: error.occurrences || 1,
    firstOccurredAt: timestamp,
    lastOccurredAt: timestamp,
    resolved: false,
  };
}

// ─── Provider ───────────────────────────────────────────────────────────────

@Injectable()
export class SpecErrorReporter {
  private readonly logger = new Logger('SpecErrorReporter');

  /**
   * ErrorTrackerService is injected lazily to avoid circular module
   * dependencies. The host resolves it from the DI container and calls
   * setErrorTrackerService() once available.
   */
  private errorTrackerService: ErrorTrackerService | null = null;

  constructor() {}

  /**
   * Inject the ErrorTrackerService after the DI container has finished
   * bootstrapping. Safe to call multiple times — the last call wins.
   */
  setErrorTrackerService(service: ErrorTrackerService): void {
    this.errorTrackerService = service;
    this.logger.debug('ErrorTrackerService bound');
  }

  /**
   * Report a spec engine error.
   *
   * Always:
   *   - Persists the error to the ErrorTrackerService DB (if available).
   *   - Logs it via the NestJS logger.
   *
   * Additionally, when ALL of the following are true:
   *   - occurrences === 1  (first time we've seen this hash)
   *   - NODE_ENV === 'production'
   *   - the `gh` CLI is available
   * then a GitHub issue is created so the team is notified.
   *
   * This method never throws — reporting failures must not cascade into
   * the caller's error handling.
   */
  async report(error: SpecError): Promise<void> {
    if (!error || !error.hash) {
      this.logger.warn(
        'report() called with an error missing a hash — skipping',
      );
      return;
    }

    // Always log locally first, so we have a record even if DB persistence fails.
    this.logger.error(
      `[${error.source}] ${error.message}` +
        (error.resource ? ` (resource=${error.resource})` : '') +
        (error.operation ? ` (operation=${error.operation})` : '') +
        (error.stage ? ` (stage=${error.stage})` : ''),
      error.stack,
    );

    // 1. Persist to ErrorTrackerService DB.
    await this.persistToDb(error);

    // 2. Open a GitHub issue on first occurrence in production.
    if (error.occurrences === 1 && this.isProduction()) {
      this.createGitHubIssue(error).catch((err) => {
        // Already handled inside createGitHubIssue, but guard the promise too.
        this.logger.debug(
          `GitHub issue creation rejected: ${(err as Error).message}`,
        );
      });

      // 3. Send Telegram notification on first occurrence in production.
      this.sendTelegramNotification(error).catch((err) => {
        this.logger.debug(
          `Telegram notification rejected: ${(err as Error).message}`,
        );
      });
    }
  }

  // ─── DB persistence ───────────────────────────────────────────────────────

  /**
   * Persist the SpecError to the central ErrorTrackerService.
   *
   * If the service hasn't been bound yet (early bootstrap errors), we log a
   * warning and move on — the error is still in the application logs.
   */
  private async persistToDb(error: SpecError): Promise<void> {
    if (!this.errorTrackerService) {
      this.logger.warn(
        'ErrorTrackerService not bound — error persisted to logs only. ' +
          'Call setErrorTrackerService() during bootstrap.',
      );
      return;
    }

    try {
      await this.errorTrackerService.logError({
        message: error.message,
        source: error.source,
        stack: error.stack,
        metadata: {
          resource: error.resource,
          operation: error.operation,
          stage: error.stage,
          requestId: error.requestId,
          specHash: error.specHash,
          hookPath: error.hookPath,
          hash: error.hash,
          occurrences: error.occurrences,
          trace: error.trace,
          inputData: sanitizeForIssue(error.inputData),
        },
      });
    } catch (err) {
      // Never let DB persistence failure mask the original error.
      this.logger.error(
        `Failed to persist spec error to ErrorTrackerService: ${(err as Error).message}`,
      );
    }
  }

  // ─── GitHub issue creation ────────────────────────────────────────────────

  /**
   * Create a GitHub issue for a spec engine error using the `gh` CLI.
   *
   * Wrapped in try/catch — any failure is logged and swallowed so the
   * reporting pipeline stays resilient.
   */
  private async createGitHubIssue(error: SpecError): Promise<void> {
    const gh = findGhBinary();
    if (!gh) {
      this.logger.debug(
        'gh CLI not available — skipping GitHub issue creation',
      );
      return;
    }

    const title = this.buildIssueTitle(error);
    const body = this.buildIssueBody(error);
    const labels = 'bug,spec-engine,auto-generated';

    try {
      // Use execSync — issue creation is fire-and-forget and synchronous gh
      // invocation is simpler/more reliable than spawning a child process
      // and parsing stdout. The command is short-lived.
      //
      // We pass title/body/labels as a single argv to avoid shell-injection
      // via the error message content. execSync with an args array is not
      // directly supported, so we escape via shell quoting.
      const escapedTitle = shellEscape(title);
      const escapedBody = shellEscape(body);
      const escapedLabels = shellEscape(labels);

      const cmd = `${gh} issue create --title ${escapedTitle} --body ${escapedBody} --label ${escapedLabels}`;

      const output = execSync(cmd, {
        encoding: 'utf-8',
        timeout: 30_000,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env },
      }).trim();

      this.logger.log(
        `Created GitHub issue for spec error ${error.hash}: ${output}`,
      );
    } catch (err) {
      const msg = (err as Error).message;
      // gh may emit helpful stderr; capture it if present.
      const stderr =
        err && typeof err === 'object' && 'stderr' in err
          ? String((err as { stderr: unknown }).stderr)
          : '';
      this.logger.error(
        `Failed to create GitHub issue for spec error ${error.hash}: ${msg}` +
          (stderr ? `\ngh stderr: ${stderr}` : ''),
      );
    }
  }

  /**
   * Build the GitHub issue title.
   *
   * Format: `[spec-engine] {resource}.{stage} failed: {message[:80]}`
   *
   * Falls back gracefully when resource/stage are absent.
   */
  private buildIssueTitle(error: SpecError): string {
    const qualifier = [error.resource, error.stage].filter(Boolean).join('.');

    const prefix = qualifier ? `${qualifier} failed: ` : 'Error: ';
    const core = truncate(error.message, 80);
    return `[spec-engine] ${prefix}${core}`;
  }

  /**
   * Build the markdown issue body with full diagnostic context.
   */
  private buildIssueBody(error: SpecError): string {
    const lines: string[] = [];

    lines.push('## Spec Engine Error');
    lines.push('');

    lines.push('### Summary');
    lines.push('');
    lines.push(`**Message:** ${error.message}`);
    lines.push(`**Source:** \`${error.source}\``);
    if (error.resource) lines.push(`**Resource:** \`${error.resource}\``);
    if (error.operation) lines.push(`**Operation:** \`${error.operation}\``);
    if (error.stage) lines.push(`**Stage:** \`${error.stage}\``);
    lines.push('');

    if (error.stack) {
      lines.push('### Stack Trace (first 5 frames)');
      lines.push('```');
      const frames = error.stack.split('\n').slice(0, 6);
      lines.push(frames.join('\n'));
      lines.push('```');
      lines.push('');
    }

    if (error.trace) {
      lines.push('### Trace');
      lines.push('');
      lines.push('```json');
      lines.push(safeJsonStringify(error.trace));
      lines.push('```');
      lines.push('');
      this.appendTraceSummary(lines, error.trace);
    }

    if (error.inputData !== undefined && error.inputData !== null) {
      lines.push('### Input Data (sanitized)');
      lines.push('```json');
      lines.push(safeJsonStringify(error.inputData));
      lines.push('```');
      lines.push('');
    }

    if (error.hookPath) {
      lines.push('### Hook');
      lines.push('');
      lines.push(`**Path:** \`${require('path').basename(error.hookPath)}\``);
      lines.push('');
    }

    lines.push('### Environment');
    lines.push('');
    lines.push(`- **Node env:** \`${process.env.NODE_ENV || 'development'}\``);
    lines.push(
      `- **Platform:** \`${process.platform}\` / Node \`${process.version}\``,
    );
    lines.push(`- **Spec hash:** \`${error.specHash || 'n/a'}\``);
    lines.push(`- **Error hash:** \`${error.hash}\``);
    lines.push(`- **Occurrences:** ${error.occurrences}`);
    if (error.requestId) lines.push(`- **Request ID:** \`${error.requestId}\``);
    lines.push('');

    lines.push('---');
    lines.push(
      '_This issue was created automatically by `SpecErrorReporter`. ' +
        'Resolve it in the [Error Tracker](./admin/errors) UI after fixing._',
    );

    return lines.join('\n');
  }

  /**
   * Append a human-readable summary of a trace (stage statuses + durations).
   */
  private appendTraceSummary(lines: string[], trace: SpecTrace): void {
    if (!trace.stages || trace.stages.length === 0) return;
    lines.push('<details><summary>Trace stages</summary>');
    lines.push('');
    lines.push('| Stage | Status | Duration |');
    lines.push('|-------|--------|----------|');
    for (const s of trace.stages) {
      lines.push(`| \`${s.stage}\` | ${s.status} | ${s.durationMs}ms |`);
    }
    lines.push('');
    lines.push(`**Total:** ${trace.totalDurationMs}ms`);
    lines.push('');
    lines.push('</details>');
    lines.push('');
  }

  // ─── Telegram notification ────────────────────────────────────────────────

  /**
   * Send a Telegram message for a spec engine error.
   *
   * Only fires on first occurrence (dedup by hash) in production.
   * Uses TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID env vars.
   * Silent if not configured — no crash, no noise.
   */
  private async sendTelegramNotification(error: SpecError): Promise<void> {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      this.logger.debug(
        'TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set — skipping Telegram notification',
      );
      return;
    }

    const message = this.buildTelegramMessage(error);

    try {
      const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        this.logger.error(
          `Telegram API returned ${res.status}: ${body.slice(0, 200)}`,
        );
      }
    } catch (err) {
      this.logger.error(
        `Failed to send Telegram notification: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Build a concise Telegram message for an error.
   * Uses HTML parse_mode. Keep it short — Telegram messages should be scannable.
   */
  private buildTelegramMessage(error: SpecError): string {
    const lines: string[] = [];

    lines.push('🚨 <b>Spec Engine Error</b>');
    lines.push('');
    lines.push(`<b>${this.escapeHtml(truncate(error.message, 200))}</b>`);
    lines.push('');

    if (error.resource)
      lines.push(
        `📦 Resource: <code>${this.escapeHtml(error.resource)}</code>`,
      );
    if (error.operation)
      lines.push(
        `⚡ Operation: <code>${this.escapeHtml(error.operation)}</code>`,
      );
    if (error.stage)
      lines.push(`🔧 Stage: <code>${this.escapeHtml(error.stage)}</code>`);
    if (error.hookPath)
      lines.push(
        `🪩 Hook: <code>${this.escapeHtml(require('path').basename(error.hookPath))}</code>`,
      );
    lines.push(
      `🔑 Hash: <code>${this.escapeHtml(error.hash.slice(0, 16))}</code>`,
    );
    lines.push(`📊 Occurrences: ${error.occurrences}`);

    if (error.trace && error.trace.stages.length > 0) {
      lines.push('');
      lines.push('<b>Trace:</b>');
      const failedStages = error.trace.stages.filter(
        (s) => s.status === 'fail',
      );
      for (const s of failedStages) {
        lines.push(
          `  ❌ <code>${this.escapeHtml(s.stage)}</code> — ${this.escapeHtml(s.error?.message || 'failed')}`,
        );
      }
      lines.push(`  Total: ${error.trace.totalDurationMs}ms`);
    }

    return lines.join('\n');
  }

  /**
   * Escape HTML special characters for Telegram's HTML parse_mode.
   */
  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // ─── Utilities ────────────────────────────────────────────────────────────

  private isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }
}

// ─── Shell escaping ─────────────────────────────────────────────────────────

/**
 * Escape a string so it can be safely passed as a single-quoted shell argument.
 *
 * In POSIX sh, single quotes preserve everything literally — the only character
 * that cannot appear inside a single-quoted string is the single quote itself.
 * We handle that by closing the quote, emitting an escaped quote, and reopening.
 *
 * This prevents shell injection via error messages / stack traces that may
 * contain characters like `;`, `$(...)`, backticks, etc.
 */
function shellEscape(str: string): string {
  if (str === '') return "''";
  // ' -> '\''  (close quote, escaped quote, reopen quote)
  return `'${str.replace(/'/g, "'\\''")}'`;
}
