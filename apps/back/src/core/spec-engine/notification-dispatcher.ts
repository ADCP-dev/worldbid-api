/**
 * NotificationDispatcher — evaluates and fires notifications declared in a
 * ResourceSpec against the current operation.
 *
 * The spec format lets an extension author declare notifications like:
 *
 *   notifications:
 *     - name: assignee-email
 *       trigger:
 *         on: afterCreate
 *         when: priority == urgent && assigneeId != null
 *       channel: email
 *       template: ./templates/new-task.hbs
 *       to: '${entity.assignee.email}'
 *       subject: 'Nueva tarea: ${entity.title}'
 *
 * At runtime, after a CRUD operation completes, the controller (or hook
 * executor) calls `dispatcher.dispatch(...)` with the entity, the operation
 * name, and a HookContext. The dispatcher:
 *   1. Filters notifications whose `trigger.on` matches the operation.
 *   2. Evaluates each `trigger.when` condition against the entity.
 *   3. For matching notifications, renders + sends via the declared channel.
 *   4. Returns a structured summary for tracing.
 *
 * Design notes:
 *   - Notifications are fire-and-forget. A failure in one notification must
 *     never throw into the caller — errors are logged and reported via
 *     ctx.logError(), then recorded in the returned summary.
 *   - The dispatcher imports ONLY from spec.types, handlebars, fs/promises,
 *     path, and @nestjs/common. It does NOT import from @comms or @infra —
 *     the HookContext already carries sendEmail(), avoiding circular deps.
 *   - Expression evaluation (`${...}` interpolation and `when` conditions) is
 *     intentionally minimal and safe: no eval, no Function constructor. It
 *     supports dot-path lookups and == / != comparisons joined by && / ||.
 */

import { Injectable, Logger } from '@nestjs/common';
import * as Handlebars from 'handlebars';
import * as fs from 'fs/promises';
import * as path from 'path';

import type { NotificationSpec, HookContext } from './spec.types';

/**
 * App-level config slice needed to render email templates and address mail.
 * Passed in by the caller (controller / hook executor) — never imported from
 * @infra to keep the dispatcher free of cross-module deps.
 */
export interface NotificationAppConfig {
  url: string;
  name: string;
  notificationEmail: string;
}

/**
 * Result summary returned by `dispatch()` — consumed by the trace builder
 * (spec-trace.ts) to populate the `notifications` stage meta.
 */
export interface DispatchSummary {
  evaluated: number;
  matched: number;
  fired: Array<{ name: string; channel: string; to?: string }>;
  skipped: Array<{ name: string; reason: string }>;
}

/**
 * Shape of the Handlebars template context passed to compiled .hbs files.
 * Extensions author templates against `{{entity.title}}`, `{{user.id}}`,
 * `{{app.url}}`, etc.
 */
export interface NotificationTemplateContext {
  entity: Record<string, unknown>;
  user: HookContext['user'];
  app: {
    url: string;
    name: string;
    notificationEmail: string;
  };
}

/**
 * Params passed to `dispatch()`.
 */
export interface DispatchParams {
  notifications: NotificationSpec[];
  /** Lifecycle stage: 'afterCreate', 'afterUpdate', 'afterDelete', etc. */
  operation: string;
  /** The persisted (or about-to-be-persisted) entity row. */
  entity: Record<string, unknown>;
  /** Hook context — provides sendEmail(), logError(), logger, user, etc. */
  ctx: HookContext;
  /** Absolute path to the extension directory (for resolving .hbs templates). */
  extensionDir: string;
  /** App config slice for template rendering + email from-address. */
  appConfig: NotificationAppConfig;
}

/**
 * Compiled template cache keyed by absolute path — avoids re-reading and
 * re-compiling the same .hbs file on every dispatch call.
 */
interface CachedTemplate {
  compiled: HandlebarsTemplateDelegate;
}

@Injectable()
export class NotificationDispatcher {
  private readonly logger = new Logger('NotificationDispatcher');
  private readonly templateCache = new Map<string, CachedTemplate>();

  /**
   * Evaluate and fire notifications for a given operation.
   *
   * This method never throws — all channel failures are caught, logged, and
   * reported via `ctx.logError()`. The returned summary reflects what happened
   * for trace observability.
   */
  async dispatch(params: DispatchParams): Promise<DispatchSummary> {
    const { notifications, operation, entity, ctx, extensionDir, appConfig } =
      params;

    const summary: DispatchSummary = {
      evaluated: 0,
      matched: 0,
      fired: [],
      skipped: [],
    };

    if (!notifications || notifications.length === 0) {
      return summary;
    }

    // The template context is shared across all notifications in this dispatch.
    const templateContext: NotificationTemplateContext = {
      entity,
      user: ctx.user,
      app: {
        url: appConfig.url,
        name: appConfig.name,
        notificationEmail: appConfig.notificationEmail,
      },
    };

    for (const spec of notifications) {
      summary.evaluated++;

      // ── 1. Filter by trigger.on ────────────────────────────────────────
      if (spec.trigger?.on !== operation) {
        summary.skipped.push({
          name: spec.name,
          reason: `trigger.on '${spec.trigger?.on}' != '${operation}'`,
        });
        continue;
      }

      // ── 2. Evaluate `when` condition (if present) ──────────────────────
      if (spec.trigger.when) {
        const passes = this.evaluateWhen(spec.trigger.when, entity);
        if (!passes) {
          summary.skipped.push({
            name: spec.name,
            reason: `when condition not met: '${spec.trigger.when}'`,
          });
          continue;
        }
      }

      summary.matched++;

      // ── 3. Dispatch to the channel ─────────────────────────────────────
      try {
        const fired = await this.fireChannel(
          spec,
          templateContext,
          ctx,
          extensionDir,
          appConfig,
        );
        summary.fired.push(fired);
      } catch (err) {
        const message = (err as Error).message ?? String(err);
        this.logger.error(
          `Notification "${spec.name}" failed: ${message}`,
          (err as Error).stack,
        );
        // Trace enrichment (PRD 01): localize to the notification dispatcher.
        const _trace = {
          layer: 'notification_dispatcher',
          template: spec.template,
          recipient: spec.to,
        };
        void _trace;
        summary.skipped.push({
          name: spec.name,
          reason: `dispatch error: ${message}`,
        });

        // Report to ErrorTracker (best-effort — ctx.logError swallows its own
        // internal failures, so this won't throw).
        try {
          await ctx.logError(
            `Notification "${spec.name}" failed: ${message}`,
            `spec-engine:notifications:${operation}`,
            {
              notificationName: spec.name,
              channel: spec.channel,
              operation,
              entityId: entity?.id,
              error: (err as Error).stack,
            },
          );
        } catch {
          // ctx.logError already logs internally if ErrorTracker is unavailable.
        }
      }
    }

    if (summary.fired.length > 0) {
      this.logger.debug(
        `Dispatched ${summary.fired.length}/${summary.matched} notification(s) for ${operation}`,
      );
    }

    return summary;
  }

  // ─── Channel dispatch ──────────────────────────────────────────────────

  /**
   * Route a single notification to its channel handler.
   * Returns a fired-record for the summary, or throws to be caught upstream.
   */
  private async fireChannel(
    spec: NotificationSpec,
    templateContext: NotificationTemplateContext,
    ctx: HookContext,
    extensionDir: string,
    appConfig: NotificationAppConfig,
  ): Promise<{ name: string; channel: string; to?: string }> {
    switch (spec.channel) {
      case 'email':
        return this.fireEmail(
          spec,
          templateContext,
          ctx,
          extensionDir,
          appConfig,
        );

      case 'webhook':
        return this.fireWebhook(spec, templateContext, ctx);

      case 'sms':
        // SMS gateway integration is not part of this dispatcher. We log and
        // report so operators know the notification was matched but not sent.
        this.logger.warn(
          `SMS channel for notification "${spec.name}" is not implemented — skipping`,
        );
        try {
          await ctx.logError(
            `SMS channel not implemented for notification "${spec.name}"`,
            `spec-engine:notifications`,
            { notificationName: spec.name, channel: 'sms' },
          );
        } catch {
          // best-effort
        }
        return { name: spec.name, channel: 'sms' };

      default: {
        // Exhaustiveness guard — if a new channel is added to the type but not
        // here, this branch catches it.
        const exhaustive: never = spec.channel;
        throw new Error(
          `Unsupported notification channel: ${String(exhaustive)}`,
        );
      }
    }
  }

  /**
   * Email channel:
   *   - Resolve `to` and `subject` via ${...} interpolation.
   *   - Read + compile the .hbs template (cached by absolute path).
   *   - Render with { entity, user, app }.
   *   - Send via ctx.sendEmail().
   */
  private async fireEmail(
    spec: NotificationSpec,
    templateContext: NotificationTemplateContext,
    ctx: HookContext,
    extensionDir: string,
    appConfig: NotificationAppConfig,
  ): Promise<{ name: string; channel: string; to?: string }> {
    // Resolve recipient
    const to = spec.to ? this.interpolate(spec.to, templateContext) : '';
    if (!to) {
      throw new Error(
        `Email notification "${spec.name}" has no resolvable 'to' address (spec.to='${
          spec.to ?? ''
        }')`,
      );
    }

    // Resolve subject (fall back to the app name + notification name)
    const subject = spec.subject
      ? this.interpolate(spec.subject, templateContext)
      : `${appConfig.name}: ${spec.name}`;

    // Render the template
    let html: string;
    if (spec.template) {
      html = await this.renderTemplate(
        spec.template,
        extensionDir,
        templateContext,
        spec.name,
      );
    } else {
      // No template — build a minimal textual body from entity + payload so the
      // email is still useful.
      html = this.renderFallbackEmail(spec, templateContext);
    }

    // Send — fire-and-forget at the call site, but we await here so a send
    // failure surfaces into the dispatch() try/catch and gets logged.
    await ctx.sendEmail({
      to,
      subject,
      html,
      from: appConfig.notificationEmail,
    });

    return { name: spec.name, channel: 'email', to };
  }

  /**
   * Webhook channel:
   *   - Build payload = spec.payload merged with { entity, user, app }.
   *   - POST to spec.url via global fetch (Node 18+).
   *   - Non-2xx responses are logged as failures (via ctx.logError) but do not
   *     throw — the notification is still reported as fired.
   */
  private async fireWebhook(
    spec: NotificationSpec,
    templateContext: NotificationTemplateContext,
    ctx: HookContext,
  ): Promise<{ name: string; channel: string; to?: string }> {
    if (!spec.url) {
      throw new Error(`Webhook notification "${spec.name}" has no 'url'`);
    }

    const url = this.interpolate(spec.url, templateContext);

    const payload: Record<string, unknown> = {
      ...(spec.payload ?? {}),
      entity: templateContext.entity,
      user: templateContext.user,
      app: templateContext.app,
      notificationName: spec.name,
      operation: ctx.operation,
      resource: ctx.resource,
      timestamp: new Date().toISOString(),
    };

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      // Network-level failure (DNS, connection refused, timeout). Report but
      // don't throw — notifications are best-effort.
      const message = (err as Error).message ?? String(err);
      this.logger.error(`Webhook "${spec.name}" to ${url} failed: ${message}`);
      try {
        await ctx.logError(
          `Webhook "${spec.name}" request failed: ${message}`,
          `spec-engine:notifications`,
          {
            notificationName: spec.name,
            channel: 'webhook',
            url,
            error: (err as Error).stack,
          },
        );
      } catch {
        // best-effort
      }
      return { name: spec.name, channel: 'webhook', to: url };
    }

    if (!response.ok) {
      const status = response.status;
      this.logger.warn(
        `Webhook "${spec.name}" to ${url} returned HTTP ${status}`,
      );
      try {
        await ctx.logError(
          `Webhook "${spec.name}" returned non-2xx status ${status}`,
          `spec-engine:notifications`,
          {
            notificationName: spec.name,
            channel: 'webhook',
            url,
            httpStatus: status,
          },
        );
      } catch {
        // best-effort
      }
    }

    return { name: spec.name, channel: 'webhook', to: url };
  }

  // ─── Template rendering ────────────────────────────────────────────────

  /**
   * Read, compile (cached), and render a .hbs template.
   * Throws on file-not-found / compile errors — caught by dispatch().
   */
  private async renderTemplate(
    templatePath: string,
    extensionDir: string,
    context: NotificationTemplateContext,
    notificationName: string,
  ): Promise<string> {
    const absolutePath = path.resolve(extensionDir, templatePath);

    let cached = this.templateCache.get(absolutePath);
    if (!cached) {
      let source: string;
      try {
        source = await fs.readFile(absolutePath, 'utf-8');
      } catch (err) {
        const message = (err as Error).message ?? String(err);
        throw new Error(
          `Template file not found for notification "${notificationName}": ${templatePath} (resolved: ${absolutePath}) — ${message}`,
        );
      }

      let compiled: HandlebarsTemplateDelegate;
      try {
        compiled = Handlebars.compile(source);
      } catch (err) {
        const message = (err as Error).message ?? String(err);
        throw new Error(
          `Failed to compile Handlebars template "${templatePath}" for notification "${notificationName}": ${message}`,
        );
      }

      cached = { compiled };
      this.templateCache.set(absolutePath, cached);
    }

    try {
      return cached.compiled(context);
    } catch (err) {
      const message = (err as Error).message ?? String(err);
      throw new Error(
        `Failed to render Handlebars template "${templatePath}" for notification "${notificationName}": ${message}`,
      );
    }
  }

  /**
   * Build a minimal HTML email body when no .hbs template is declared.
   * Renders the entity as a definition list plus any declared payload.
   */
  private renderFallbackEmail(
    spec: NotificationSpec,
    context: NotificationTemplateContext,
  ): string {
    const entityRows = Object.entries(context.entity)
      .map(
        ([k, v]) =>
          `<tr><td style="padding:4px 12px 4px 0;color:#666;font-weight:600">${this.escapeHtml(
            k,
          )}</td><td style="padding:4px 0">${this.escapeHtml(this.formatValue(v))}</td></tr>`,
      )
      .join('');

    const payloadRows = spec.payload
      ? Object.entries(spec.payload)
          .map(
            ([k, v]) =>
              `<tr><td style="padding:4px 12px 4px 0;color:#666;font-weight:600">${this.escapeHtml(
                k,
              )}</td><td style="padding:4px 0">${this.escapeHtml(this.formatValue(v))}</td></tr>`,
          )
          .join('')
      : '';

    return `<!doctype html>
<html><body style="font-family:system-ui,-apple-system,sans-serif;color:#222">
  <h2 style="margin-bottom:4px">${this.escapeHtml(spec.name)}</h2>
  <p style="color:#888;margin-top:0">Notification from ${this.escapeHtml(context.app.name)}</p>
  <h3>Entity</h3>
  <table>${entityRows}</table>
  ${payloadRows ? `<h3>Payload</h3><table>${payloadRows}</table>` : ''}
</body></html>`;
  }

  // ─── Expression evaluation ─────────────────────────────────────────────

  /**
   * Evaluate a `when` condition against the entity.
   *
   * Supports a small, safe expression language:
   *   - Clauses joined by `&&` (AND) and `||` (OR). `&&` binds tighter than
   *     `||` (standard short-circuit precedence).
   *   - Each clause: `field op value` where op is `==` or `!=`.
   *   - `field` is a dot-path resolved from the entity (e.g. `priority`,
   *     `assignee.email`).
   *   - `value` is a literal: bare enum string (`urgent`), a number, `null`,
   *     `true`, `false`, or a single-quoted string.
   *
   * Examples (all valid):
   *   'priority == urgent'
   *   'assigneeId != null'
   *   'status == open && priority == urgent'
   *   'status == done || archived == true'
   *   'assignee.email == "admin@example.com"'
   *
   * No `eval`, no `Function` — purely structural parsing.
   */
  private evaluateWhen(
    expression: string,
    entity: Record<string, unknown>,
  ): boolean {
    const trimmed = expression.trim();
    if (!trimmed) return true; // empty condition = always pass

    // Split on || at the top level (lower precedence than &&).
    const orParts = this.splitTopLevel(trimmed, '||');
    for (const orPart of orParts) {
      if (this.evalAndChain(orPart.trim(), entity)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Evaluate a chain of `&&`-joined clauses.
   */
  private evalAndChain(expr: string, entity: Record<string, unknown>): boolean {
    const andParts = this.splitTopLevel(expr, '&&');
    for (const part of andParts) {
      if (!this.evalClause(part.trim(), entity)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Split an expression on a top-level operator, respecting single-quoted
   * strings (so `||` inside `'a || b'` is not treated as an operator).
   */
  private splitTopLevel(expr: string, op: string): string[] {
    const parts: string[] = [];
    let current = '';
    let inSingle = false;
    let inDouble = false;
    let i = 0;
    while (i < expr.length) {
      const ch = expr[i];
      if (ch === "'" && !inDouble) {
        inSingle = !inSingle;
        current += ch;
        i++;
        continue;
      }
      if (ch === '"' && !inSingle) {
        inDouble = !inDouble;
        current += ch;
        i++;
        continue;
      }
      if (!inSingle && !inDouble && expr.startsWith(op, i)) {
        parts.push(current);
        current = '';
        i += op.length;
        continue;
      }
      current += ch;
      i++;
    }
    parts.push(current);
    return parts;
  }

  /**
   * Evaluate a single clause: `field == value` or `field != value`.
   * Whitespace around the operator is optional.
   */
  private evalClause(clause: string, entity: Record<string, unknown>): boolean {
    if (!clause) return true;

    // Match: <field> <op> <value>  (op = == or !=)
    // The field is a dot-path; the value is everything after the operator.
    const match = clause.match(/^([\w.]+)\s*(==|!=)\s*(.+)$/);
    if (!match) {
      // Unknown clause shape — fail safe (treat as not-matching) but log so
      // the spec author can fix it.
      this.logger.warn(
        `Unparseable when clause: '${clause}' — treating as false`,
      );
      return false;
    }

    const [, fieldRaw, op, valueRaw] = match;
    const field = fieldRaw.trim();
    const actual = this.resolveDotPath(entity, field);
    const expected = this.parseLiteral(valueRaw.trim());

    const equal = this.valuesEqual(actual, expected);
    return op === '==' ? equal : !equal;
  }

  /**
   * Parse a literal value from the `when` clause RHS.
   *
   * Supported:
   *   - null        → null
   *   - true/false  → boolean
   *   - 123 / 12.5  → number
   *   - 'abc' / "abc" → string (quotes stripped)
   *   - urgent      → string (bare enum value — no quotes required)
   */
  private parseLiteral(raw: string): unknown {
    if (raw === 'null') return null;
    if (raw === 'true') return true;
    if (raw === 'false') return false;

    // Quoted string
    if (
      (raw.startsWith("'") && raw.endsWith("'")) ||
      (raw.startsWith('"') && raw.endsWith('"'))
    ) {
      return raw.slice(1, -1);
    }

    // Number
    if (/^-?\d+(\.\d+)?$/.test(raw)) {
      return Number(raw);
    }

    // Bare enum value — return as-is string
    return raw;
  }

  /**
   * Compare two values with loose equality semantics:
   *   - null/undefined are treated as equivalent (both "absent").
   *   - Numbers compared by value.
   *   - Everything else by strict equality after String() coercion of both
   *     sides, so `status == open` works when entity.status is the string
   *     "open" and the literal is the bare string "open".
   */
  private valuesEqual(actual: unknown, expected: unknown): boolean {
    // Absence checks
    if (actual == null && expected == null) return true;
    if (actual == null || expected == null) return false;

    if (typeof actual === 'number' && typeof expected === 'number') {
      return actual === expected;
    }

    return String(actual) === String(expected);
  }

  // ─── ${...} interpolation ──────────────────────────────────────────────

  /**
   * Interpolate `${dot.path}` expressions against the template context.
   *
   * Example:
   *   interpolate('${entity.title}', { entity: { title: 'Hola' }, ... })
   *   → 'Hola'
   *
   * Unresolvable paths are replaced with an empty string (and logged at debug).
   */
  private interpolate(
    expr: string,
    context: NotificationTemplateContext,
  ): string {
    return expr.replace(/\$\{([^}]+)\}/g, (fullMatch, pathExpr: string) => {
      const resolved = this.resolveDotPath(context, pathExpr.trim());
      if (resolved === undefined || resolved === null) {
        this.logger.debug(
          `Interpolation '${fullMatch}' resolved to nothing — replacing with ''`,
        );
        return '';
      }
      if (typeof resolved === 'object') {
        // Don't render [object Object] — use JSON for structured values.
        try {
          return JSON.stringify(resolved);
        } catch {
          return '';
        }
      }
      return String(resolved);
    });
  }

  // ─── Helpers ───────────────────────────────────────────────────────────

  /**
   * Resolve a dot-path (`a.b.c`) from an object. Returns undefined if any
   * segment is missing or not an object.
   */
  private resolveDotPath(source: unknown, dotPath: string): unknown {
    if (source == null) return undefined;
    const segments = dotPath.split('.');
    let current: unknown = source;
    for (const seg of segments) {
      if (current == null || typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[seg];
    }
    return current;
  }

  /**
   * Minimal HTML escaping for the fallback email body.
   */
  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Format a value for display in the fallback email.
   */
  private formatValue(value: unknown): string {
    if (value === null) return 'null';
    if (value === undefined) return '';
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }
    return String(value);
  }
}
