import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

/**
 * SqlQueryTool — read-only SQL over the app database.
 *
 * Security hardening (defense in depth):
 *   1. Statement allow-list: only SELECT / WITH (CTE) entrypoints.
 *   2. Token block-list: no DML/DDL keywords (INSERT/UPDATE/DELETE/ALTER/
 *      CREATE/DROP/TRUNCATE/GRANT/COPY/CALL/DO/SET) as standalone words.
 *   3. Single statement: semicolons inside string literals are allowed, but
 *      a statement-terminating semicolon followed by content is rejected.
 *   4. Enforced read-only TRANSACTION: `BEGIN TRANSACTION READ ONLY` — even
 *      if a check slips through, Postgres itself refuses writes.
 *   5. Hard row cap + timeout (AbortSignal on the query runner).
 *
 * The agent gets this tool to answer questions the KB tools can't (counts,
 * aggregates, joins across tables like ext_ka_notes ↔ chat sessions).
 */
@Injectable()
export class SqlQueryService {
  private static readonly MAX_ROWS = 200;
  private static readonly TIMEOUT_MS = 10_000;

  private readonly logger = new Logger(SqlQueryService.name);

  /** Standalone DML/DDL words — rejected anywhere in the statement. */
  private static readonly FORBIDDEN =
    /\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|call|do|set|reset| vacuum |reindex|listen|notify)\b/i;

  constructor(
    // The app-wide DataSource (same DB as TypeORM entities).
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /** True when the statement starts with SELECT or WITH. */
  private isReadOnlyStatement(sql: string): boolean {
    const trimmed = sql.trim().replace(/;+\s*$/, '');
    return /^(select|with)\b/i.test(trimmed);
  }

  /** Reject hidden DML inside CTEs / subqueries / comments. */
  private containsForbiddenKeyword(sql: string): boolean {
    // Strip string literals and quoted identifiers before keyword scanning.
    const stripped = sql
      .replace(/'(?:[^']|'')*'/g, "''")
      .replace(/"(?:[^"]|"")*"/g, '""')
      .replace(/--[^\n]*/g, ' ')
      .replace(/\/\*[\s\S]*?\*\//g, ' ');
    return SqlQueryService.FORBIDDEN.test(stripped);
  }

  /** Reject multi-statement input (trailing semicolon + more content). */
  private isSingleStatement(sql: string): boolean {
    const body = sql.trim().replace(/;+\s*$/, '');
    return !body.includes(';');
  }

  /**
   * Execute a read-only query. Throws a descriptive Error for anything
   * not SELECT/WITH, containing DML keywords, multi-statement, or over the
   * row cap.
   */
  async run(userSql: string): Promise<{
    columns: string[];
    rows: Array<Record<string, unknown>>;
    rowCount: number;
    truncated: boolean;
  }> {
    const sql = userSql.trim();
    if (!sql) throw new Error('Empty SQL statement');

    if (!this.isReadOnlyStatement(sql)) {
      throw new Error('Only SELECT (or WITH … SELECT) statements are allowed');
    }
    if (this.containsForbiddenKeyword(sql)) {
      throw new Error(' statement contains a forbidden DML/DDL keyword — read-only tool');
    }
    if (!this.isSingleStatement(sql)) {
      throw new Error('Only a single statement is allowed (no semicolons chaining)');
    }

    const wrapped = `
      SELECT * FROM (
        ${sql.replace(/;+\s*$/, '')}
      ) AS ka_readonly_query
      LIMIT ${SqlQueryService.MAX_ROWS + 1}
    `;

    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      SqlQueryService.TIMEOUT_MS,
    );

    try {
      const runner = this.dataSource.createQueryRunner('slave');
      try {
        await runner.startTransaction('READ ONLY');
        const raw = await runner.query(wrapped, [], controller.signal);
        await runner.commitTransaction();
        const rows = raw as Array<Record<string, unknown>>;
        const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
        return {
          columns,
          rows: rows.slice(0, SqlQueryService.MAX_ROWS),
          rowCount: rows.length,
          truncated: rows.length > SqlQueryService.MAX_ROWS,
        };
      } finally {
        await runner.release();
      }
    } finally {
      clearTimeout(timer);
    }
  }

  /** LangChain tool factory bound to this service. */
  createTool() {
    return tool(
      async ({ sql }) => {
        try {
          const result = await this.run(sql);
          return JSON.stringify(result, null, 2);
        } catch (err) {
          return JSON.stringify({
            error: err instanceof Error ? err.message : String(err),
          });
        }
      },
      {
        name: 'sql_query_readonly',
        description:
          'Run a READ-ONLY SQL query (SELECT or WITH … SELECT) against the app database. Use for counts, aggregates, cross-table lookups the KB tools cannot answer (notes, chats, configs, users). Returns { columns, rows, rowCount }. Rejects any statement that is not a single SELECT/WITH — no INSERT/UPDATE/DELETE/DDL.',
        schema: z.object({
          sql: z
            .string()
            .describe(
              'A single read-only SQL statement. Tables use ext_ka_* prefixes for the knowledge agent (e.g. SELECT category_path, count(*) FROM ext_ka_notes WHERE deleted_at IS NULL GROUP BY 1)',
            ),
        }),
      },
    );
  }
}