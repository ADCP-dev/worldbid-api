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
import { createHash } from 'crypto';
import { existsSync } from 'fs';
import { join } from 'path';

import type { SpecError, SpecTrace } from './spec.types';
import type { ErrorTrackerService } from '@src/modules/error-tracker/error-tracker.service';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Keys whose values are scrubbed before being serialized into a GitHub issue
 * body. We never want credentials, tokens, or full file payloads in a public
 * (or even private) issue tracker.
 */
const SENSITIVE_KEY_PATTERNS = [
  /^password$/i,
  /^passwd$/i,
  /^secret$/i,
  /^token$/i,
  /^authorization$/i,
  /^auth$/i,
  /^apiKey$/i,
  /^api[_-]?key$/i,
  /^private[_-]?key$/i,
  /^refresh[_-]?token$/i,
  /^access[_-]?token$/i,
  /^cookie$/i,
  /^session[_-]?id$/i,
  /^ssn$/i,
  /^credit[_-]?card$/i,
  /^cvv$/i,
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
      this.logger.warn('report() called with an error missing a hash — skipping');
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
        this.logger.debug(`GitHub issue creation rejected: ${(err as Error).message}`);
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
      this.logger.debug('gh CLI not available — skipping GitHub issue creation');
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

      this.logger.log(`Created GitHub issue for spec error ${error.hash}: ${output}`);
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
    const qualifier = [error.resource, error.stage]
      .filter(Boolean)
      .join('.');

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
      lines.push('### Stack Trace');
      lines.push('```');
      lines.push(error.stack);
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
      lines.push(`**Path:** \`${error.hookPath}\``);
      lines.push('');
    }

    lines.push('### Environment');
    lines.push('');
    lines.push(`- **Node env:** \`${process.env.NODE_ENV || 'development'}\``);
    lines.push(`- **Platform:** \`${process.platform}\` / Node \`${process.version}\``);
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