/**
 * SpecImportExport — bulk import (CSV/JSON rows) and export (CSV/JSON string)
 * for spec-driven resources.
 *
 * Import flow (per row):
 *   1. Apply `importConfig.mapping` (rename keys from external names to spec
 *      field names) if present.
 *   2. Validate the row against the resource's Zod create schema
 *      (ValidationFactory.createCreateSchema).
 *   3. If `importConfig.uniqueKey` is set, look up an existing row by that
 *      key. If found → update; otherwise → create.
 *   4. Persist via the resource repository obtained from HookContext.
 *   5. Collect per-row errors without aborting the whole batch — a single
 *      bad row is reported in `errors[]` but processing continues.
 *
 * Export flow:
 *   1. Fetch all rows from the resource repository.
 *   2. Project only `exportConfig.fields` (if defined), otherwise all
 *      non-computed, non-virtual fields.
 *   3. Format as CSV (RFC-4180-ish: quote fields containing commas, quotes,
 *      or newlines) or JSON.
 *
 * This module never imports app-level services directly — it uses
 * HookContext.getRepository() so it works for any spec resource.
 */

import { z } from 'zod';

import type { ResourceSpec, HookContext } from './spec.types';
import { ValidationFactory } from './validation-factory';

export interface SpecImportParams {
  resource: string;
  data: Record<string, unknown>[];
  spec: ResourceSpec;
  ctx: HookContext;
}

export interface SpecImportResult {
  created: number;
  updated: number;
  errors: string[];
}

export interface SpecExportParams {
  resource: string;
  spec: ResourceSpec;
  ctx: HookContext;
  format: 'csv' | 'json';
}

export class SpecImportExport {
  // ─── Import ──────────────────────────────────────────────────────────────

  /**
   * Import an array of row objects into a spec resource.
   *
   * Returns a summary with created/updated counts and a list of per-row
   * error messages (row index is included in each message).
   */
  static async import(params: SpecImportParams): Promise<SpecImportResult> {
    const { resource, data, spec, ctx } = params;
    const result: SpecImportResult = { created: 0, updated: 0, errors: [] };

    const importConfig = spec.importConfig;
    const mapping = importConfig?.mapping;
    const uniqueKey = importConfig?.uniqueKey;

    const repo = ctx.getRepository(resource);
    const createSchema = ValidationFactory.createCreateSchema(spec);
    // For updates we reuse the same schema but all fields are already
    // optional in the create schema for non-required fields; the update
    // schema is more permissive (all optional) so use it for upsert merges.
    const updateSchema = ValidationFactory.createUpdateSchema(spec);

    for (let i = 0; i < data.length; i++) {
      const rowIndex = i;
      try {
        let row = data[i];
        if (!row || typeof row !== 'object') {
          result.errors.push(`Row ${rowIndex}: not an object`);
          continue;
        }

        // 1. Apply mapping
        if (mapping) {
          const mapped: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(row)) {
            const targetKey = mapping[key] ?? key;
            mapped[targetKey] = value;
          }
          row = mapped;
        }

        // 2. Validate
        const parseResult = (createSchema as z.ZodTypeAny).safeParse(row);
        if (!parseResult.success) {
          const issues = parseResult.error.issues
            .map((iss) => `${iss.path.join('.')}: ${iss.message}`)
            .join('; ');
          result.errors.push(`Row ${rowIndex}: validation failed — ${issues}`);
          continue;
        }
        const validated = parseResult.data as Record<string, unknown>;

        // 3. Upsert by uniqueKey
        if (uniqueKey) {
          const keyValue = validated[uniqueKey];
          if (keyValue == null) {
            result.errors.push(
              `Row ${rowIndex}: uniqueKey "${uniqueKey}" is missing`,
            );
            continue;
          }
          const existing = await repo.findOne({
            where: { [uniqueKey]: keyValue },
          });
          if (existing) {
            // Merge validated fields onto existing, re-validate as update.
            const merged = { ...existing, ...validated };
            const updateParse = (updateSchema as z.ZodTypeAny).safeParse(
              merged,
            );
            if (!updateParse.success) {
              const issues = updateParse.error.issues
                .map((iss) => `${iss.path.join('.')}: ${iss.message}`)
                .join('; ');
              result.errors.push(
                `Row ${rowIndex}: update validation failed — ${issues}`,
              );
              continue;
            }
            await repo.update((existing as any).id, validated);
            result.updated++;
            continue;
          }
        }

        // 4. Create
        const entity = repo.create(validated);
        await repo.save(entity);
        result.created++;
      } catch (err) {
        result.errors.push(
          `Row ${rowIndex}: ${(err as Error).message ?? String(err)}`,
        );
      }
    }

    return result;
  }

  // ─── Export ──────────────────────────────────────────────────────────────

  /**
   * Export all rows of a spec resource as a CSV or JSON string.
   *
   * Field selection:
   *   - If `exportConfig.fields` is defined, only those fields are emitted
   *     (in that order).
   *   - Otherwise all non-computed spec fields are emitted (in declaration
   *     order), plus `id`.
   */
  static async export(params: SpecExportParams): Promise<string> {
    const { resource, spec, ctx, format } = params;

    const repo = ctx.getRepository(resource);
    const rows = await repo.find();

    // Determine field list
    const exportFields =
      spec.exportConfig?.fields && spec.exportConfig.fields.length > 0
        ? spec.exportConfig.fields
        : this.defaultExportFields(spec);

    // Project rows to the selected fields
    const projected = rows.map((row: any) => {
      const out: Record<string, unknown> = {};
      for (const field of exportFields) {
        out[field] = row[field];
      }
      return out;
    });

    if (format === 'json') {
      return JSON.stringify(projected, null, 2);
    }

    // CSV
    return this.toCsv(exportFields, projected);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  /**
   * Default export fields: id first, then all spec fields that are not
   * computed (computed fields are derived at read time and don't exist as
   * columns).
   */
  private static defaultExportFields(spec: ResourceSpec): string[] {
    const fields = ['id'];
    for (const f of spec.fields) {
      if (f.type === 'computed') continue;
      fields.push(f.name);
    }
    return fields;
  }

  /**
   * Serialize an array of objects to an RFC-4180-ish CSV string.
   *
   * - The header row is the field list.
   * - Each cell is quoted if it contains a comma, double-quote, newline, or
   *   carriage return. Quotes are escaped by doubling. Null/undefined cells
   *   are emitted as empty strings. Objects/arrays are JSON-stringified.
   */
  private static toCsv(
    fields: string[],
    rows: Record<string, unknown>[],
  ): string {
    const needsQuoting = (s: string): boolean => /[",\n\r]/.test(s);

    const escapeCell = (s: string): string => {
      if (needsQuoting(s)) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };

    const formatCell = (value: unknown): string => {
      if (value === null || value === undefined) return '';
      if (typeof value === 'object') {
        try {
          return JSON.stringify(value);
        } catch {
          return String(value);
        }
      }
      return String(value);
    };

    const lines: string[] = [];
    // Header
    lines.push(fields.map((f) => escapeCell(f)).join(','));
    // Rows
    for (const row of rows) {
      const cells = fields.map((f) => escapeCell(formatCell(row[f])));
      lines.push(cells.join(','));
    }
    return lines.join('\n');
  }
}
