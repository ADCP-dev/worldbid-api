/**
 * ErrorIntrospector — queries the error_logs table with optional filters.
 *
 * Returns recent rows with ActionableError fields (PRD 01).
 */

import { IntrospectionCache } from '../introspection-cache';
import type { ErrorView } from '../types';

export interface ErrorQueryFn {
  queryErrors(filter: ErrorFilter): Promise<ErrorView[]>;
}

export interface ErrorFilter {
  category?: string;
  extension?: string;
  resolved?: boolean;
  limit?: number;
}

export class ErrorIntrospector {
  constructor(
    private readonly cache: IntrospectionCache,
    private readonly queryFn: ErrorQueryFn,
  ) {}

  async getErrors(filter: ErrorFilter = {}): Promise<ErrorView[]> {
    const limit = filter.limit ?? 10;
    const key = `err:get:${filter.category ?? ''}:${filter.extension ?? ''}:${filter.resolved ?? ''}:${limit}`;
    const cached = this.cache.get<ErrorView[]>(key);
    if (cached) return cached;
    const rows = await this.queryFn.queryErrors({ ...filter, limit });
    this.cache.set(key, rows);
    return rows;
  }
}