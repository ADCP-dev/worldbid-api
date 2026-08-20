/**
 * MigrationIntrospector — lists applied and pending migrations.
 *
 * Applied: rows in the `typeorm_migrations` table (via injected query fn).
 * Pending: files in the migrations dir not present in applied (by name).
 */

import { readdirSync } from 'node:fs';
import path from 'node:path';
import { IntrospectionCache } from '../introspection-cache';
import type { MigrationView } from '../types';

export interface MigrationQueryFn {
  queryAppliedMigrations(): Promise<MigrationView[]>;
}

export class MigrationIntrospector {
  constructor(
    private readonly cache: IntrospectionCache,
    private readonly queryFn: MigrationQueryFn,
    private readonly migrationsDir: string,
  ) {}

  async listMigrations(): Promise<{ applied: MigrationView[]; pending: MigrationView[] }> {
    const cached = this.cache.get<{ applied: MigrationView[]; pending: MigrationView[] }>('mig:list');
    if (cached) return cached;
    const applied = await this.queryFn.queryAppliedMigrations();
    const appliedNames = new Set(applied.map((m) => m.name));
    const pending: MigrationView[] = [];
    try {
      const files = readdirSync(this.migrationsDir).filter((f) => f.endsWith('.ts'));
      for (const f of files) {
        // Convention: <timestamp>-<Name>.ts → name is <Name> without extension
        const base = f.replace(/\.ts$/, '');
        const dashIdx = base.indexOf('-');
        const name = dashIdx >= 0 ? base.slice(dashIdx + 1) : base;
        if (!appliedNames.has(name)) {
          pending.push({ name, file: path.join(this.migrationsDir, f) });
        }
      }
    } catch {
      // migrations dir missing → no pending
    }
    const result = { applied, pending };
    this.cache.set('mig:list', result);
    return result;
  }
}