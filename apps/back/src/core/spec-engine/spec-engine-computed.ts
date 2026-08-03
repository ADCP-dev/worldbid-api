/**
 * ComputedFieldResolver — evaluates `type: 'computed'` fields declared in a
 * ResourceSpec and attaches their values to the entity before it is sent in
 * the response.
 *
 * Three compute kinds are supported (see ComputeSpec in spec.types.ts):
 *
 *   1. count
 *      Query a related resource where `foreignKey == entity.id` and count
 *      the matching rows. Sets the computed field to that count (number).
 *      Requires `compute.relation` (the related resource name) and
 *      `compute.foreignKey` (the FK column on the related table).
 *
 *   2. expression
 *      Evaluate a safe boolean expression against the entity data using the
 *      same minimal expression language as NotificationDispatcher's `when`
 *      parser (== / != clauses joined by && / ||, dot-path field lookups,
 *      no eval/Function). Sets the computed field to the boolean result.
 *      Requires `compute.expression`.
 *
 *   3. template
 *      Interpolate `${field}` references from the entity data into a string.
 *      Sets the computed field to the resulting string. Requires
 *      `compute.template`.
 *
 * This resolver NEVER throws — if any computed field fails to evaluate, that
 * field is set to null and the error is logged via the provided HookContext's
 * logger. The remaining computed fields are still resolved.
 */

import { Logger } from '@nestjs/common';

import type { ResourceSpec, HookContext, FieldSpec } from './spec.types';

export class ComputedFieldResolver {
  /**
   * Resolve all `type: 'computed'` fields on a single entity.
   *
   * @param entity  The persisted entity row (mutated in place — computed
   *                fields are added as keys).
   * @param spec    The ResourceSpec describing the entity.
   * @param ctx     HookContext — used to fetch related repositories (for
   *                count) and for logging on error.
   * @returns       The same entity reference with computed fields populated.
   */
  static async resolve(
    entity: Record<string, unknown>,
    spec: ResourceSpec,
    ctx: HookContext,
  ): Promise<Record<string, unknown>> {
    const computedFields = spec.fields.filter(
      (f) => f.type === 'computed' && f.compute,
    );

    for (const field of computedFields) {
      try {
        entity[field.name] = await this.resolveOne(field, entity, ctx);
      } catch (err) {
        // Never let one computed field break the response.
        entity[field.name] = null;
        try {
          ctx.logger.error(
            `Computed field "${field.name}" on "${spec.name}" failed: ${(err as Error).message}`,
          );
        } catch {
          // ctx.logger should always be present, but guard just in case.
        }
      }
    }

    return entity;
  }

  // ─── Per-field dispatch ───────────────────────────────────────────────────

  private static async resolveOne(
    field: FieldSpec,
    entity: Record<string, unknown>,
    ctx: HookContext,
  ): Promise<unknown> {
    const compute = field.compute!;
    switch (compute.type) {
      case 'count':
        return this.resolveCount(compute, entity, ctx);

      case 'expression':
        return this.resolveExpression(compute.expression ?? '', entity);

      case 'template':
        return this.resolveTemplate(compute.template ?? '', entity);

      default: {
        // Exhaustiveness guard — if a new compute type is added to the
        // type but not here, this branch catches it.
        const exhaustive: never = compute.type;
        throw new Error(`Unsupported compute type: ${String(exhaustive)}`);
      }
    }
  }

  // ─── count ───────────────────────────────────────────────────────────────

  /**
   * Count rows in the related resource where `foreignKey == entity.id`.
   */
  private static async resolveCount(
    compute: NonNullable<FieldSpec['compute']>,
    entity: Record<string, unknown>,
    ctx: HookContext,
  ): Promise<number> {
    if (!compute.relation || !compute.foreignKey) {
      throw new Error(
        `compute.type === 'count' requires both 'relation' and 'foreignKey'`,
      );
    }
    if (entity.id == null) {
      // Without an entity id there is nothing to count against.
      return 0;
    }

    const repo = ctx.getRepository(compute.relation);
    const where: Record<string, unknown> = { [compute.foreignKey]: entity.id };
    const count = await repo.count({ where });
    return count;
  }

  // ─── expression ──────────────────────────────────────────────────────────

  /**
   * Evaluate a boolean expression against entity data.
   *
   * Uses the same safe expression language as NotificationDispatcher's `when`
   * parser: clauses of `field op value` joined by `&&` / `||`, where `field`
   * is a dot-path and `value` is a literal (null, true, false, number, quoted
   * string, or bare enum string). No eval, no Function — purely structural.
   */
  private static resolveExpression(
    expression: string,
    entity: Record<string, unknown>,
  ): boolean {
    const trimmed = expression.trim();
    if (!trimmed) return true; // empty condition = always true

    // Split on || at the top level (lower precedence than &&).
    const orParts = this.splitTopLevel(trimmed, '||');
    for (const orPart of orParts) {
      if (this.evalAndChain(orPart.trim(), entity)) {
        return true;
      }
    }
    return false;
  }

  private static evalAndChain(
    expr: string,
    entity: Record<string, unknown>,
  ): boolean {
    const andParts = this.splitTopLevel(expr, '&&');
    for (const part of andParts) {
      if (!this.evalClause(part.trim(), entity)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Split an expression on a top-level operator, respecting single/double
   * quoted strings (so `||` inside `'a || b'` is not treated as an operator).
   */
  private static splitTopLevel(expr: string, op: string): string[] {
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
   */
  private static evalClause(
    clause: string,
    entity: Record<string, unknown>,
  ): boolean {
    if (!clause) return true;
    const match = clause.match(/^([\w.]+)\s*(==|!=)\s*(.+)$/);
    if (!match) return false;
    const [, fieldRaw, op, valueRaw] = match;
    const actual = this.resolveDotPath(entity, fieldRaw.trim());
    const expected = this.parseLiteral(valueRaw.trim());
    const equal = this.valuesEqual(actual, expected);
    return op === '==' ? equal : !equal;
  }

  private static parseLiteral(raw: string): unknown {
    if (raw === 'null') return null;
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    if (
      (raw.startsWith("'") && raw.endsWith("'")) ||
      (raw.startsWith('"') && raw.endsWith('"'))
    ) {
      return raw.slice(1, -1);
    }
    if (/^-?\d+(\.\d+)?$/.test(raw)) return Number(raw);
    return raw; // bare enum value
  }

  private static valuesEqual(actual: unknown, expected: unknown): boolean {
    if (actual == null && expected == null) return true;
    if (actual == null || expected == null) return false;
    if (typeof actual === 'number' && typeof expected === 'number')
      return actual === expected;
    return String(actual) === String(expected);
  }

  // ─── template ────────────────────────────────────────────────────────────

  /**
   * Interpolate `${field}` references from entity data into a string.
   * Unresolvable paths are replaced with an empty string. Object values are
   * JSON-stringified rather than rendered as `[object Object]`.
   */
  private static resolveTemplate(
    template: string,
    entity: Record<string, unknown>,
  ): string {
    return template.replace(/\$\{([^}]+)\}/g, (fullMatch, pathExpr: string) => {
      const resolved = this.resolveDotPath(entity, pathExpr.trim());
      if (resolved === undefined || resolved === null) return '';
      if (typeof resolved === 'object') {
        try {
          return JSON.stringify(resolved);
        } catch {
          return '';
        }
      }
      return String(resolved);
    });
  }

  // ─── shared helpers ──────────────────────────────────────────────────────

  /**
   * Resolve a dot-path (`a.b.c`) from an object. Returns undefined if any
   * segment is missing or not an object.
   */
  private static resolveDotPath(source: unknown, dotPath: string): unknown {
    if (source == null) return undefined;
    const segments = dotPath.split('.');
    let current: unknown = source;
    for (const seg of segments) {
      if (current == null || typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[seg];
    }
    return current;
  }
}
