/**
 * DbBranchManager — schema-level PostgreSQL branching for agent-native testing.
 *
 * Each branch is an isolated Postgres schema (`branch_<name>`) inside the same
 * instance. Agents test migrations/seeds against a branch without risk to the
 * main (`public`) schema. If the change passes, merge re-applies migrations
 * against public. If it fails, discard drops the schema.
 *
 * Lifecycle: create → (runInBranch / apply migrations) → merge | discard.
 *
 * @see prds/agent-native/04-database-branching.md
 */
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';

export type DbBranchStatus =
  | 'active'
  | 'merging'
  | 'merged'
  | 'discarded'
  | 'failed';

export interface DbBranch {
  name: string;
  schema: string;
  createdAt: string;
  createdBy: string;
  status: DbBranchStatus;
  parentSchema: string;
  copyData: boolean;
}

interface CreateBranchOptions {
  name?: string;
  copyData?: boolean;
  parentSchema?: string;
}

interface BranchRow {
  name: string;
  schema: string;
  parent_schema: string;
  status: string;
  copy_data: boolean;
  created_by: string | null;
  created_at: string;
}

interface MigrationRow {
  timestamp: number | string;
  name: string;
}

const DEFAULT_MIGRATIONS_DIR =
  'apps/back/src/infrastructure/database/migrations';
const DEFAULT_PARENT_SCHEMA = 'public';

export class DbBranchManager {
  private readonly logger = new Logger('DbBranchManager');

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService?: ConfigService,
  ) {}

  async createBranch(options: CreateBranchOptions = {}): Promise<DbBranch> {
    const branchName = options.name || `branch_${randomUUID().slice(0, 8)}`;
    const schema = branchName.startsWith('branch_')
      ? branchName
      : `branch_${branchName}`;
    const parent = options.parentSchema || DEFAULT_PARENT_SCHEMA;
    const copyData = options.copyData !== false;
    const createdBy = this.getAgentId();

    // 1. Create schema
    await this.dataSource.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);

    // 2. Copy structure
    await this.copySchemaStructure(parent, schema);

    // 3. Copy data if requested
    if (copyData) {
      await this.copySchemaData(parent, schema);
    }

    // 4. Register branch in public._db_branches
    await this.dataSource.query(
      `INSERT INTO public._db_branches (name, schema, parent_schema, status, copy_data, created_by)
       VALUES ($1, $2, $3, 'active', $4, $5)`,
      [branchName, schema, parent, copyData, createdBy],
    );

    return {
      name: branchName,
      schema,
      createdAt: new Date().toISOString(),
      createdBy,
      status: 'active',
      parentSchema: parent,
      copyData,
    };
  }

  async runInBranch<T>(
    branch: DbBranch,
    fn: (dataSource: DataSource) => Promise<T>,
  ): Promise<T> {
    // Postgres-only: `schema` is a Postgres DataSourceOption. Cast options to
    // a permissive record so we can override it without fighting the union of
    // connector-specific option types (mysql, sqlite, etc. don't have schema).
    const baseOptions = this.dataSource.options as unknown as Record<
      string,
      unknown
    >;
    const branchDataSource = new DataSource({
      ...baseOptions,
      schema: branch.schema,
    } as ConstructorParameters<typeof DataSource>[0]);
    await branchDataSource.initialize();
    try {
      return await fn(branchDataSource);
    } finally {
      await branchDataSource.destroy();
    }
  }

  async mergeBranch(branch: DbBranch): Promise<void> {
    // 1. Identify migrations applied in the branch but not in public
    const branchMigrations = (await this.dataSource.query(
      `SELECT * FROM "${branch.schema}".typeorm_migrations
       WHERE timestamp NOT IN (
         SELECT timestamp FROM public.typeorm_migrations
       )
       ORDER BY timestamp`,
    )) as MigrationRow[];

    // 2. Snapshot count in public before
    const beforeRows = (await this.dataSource.query(
      `SELECT count(*)::int AS count FROM public.typeorm_migrations`,
    )) as Array<{ count: number }>;
    const beforeCount = beforeRows[0].count;

    // 3. Re-apply each new migration against public
    for (const migration of branchMigrations) {
      await this.runMigrationAgainstPublic(migration.name);
    }

    // 4. Verify count
    const afterRows = (await this.dataSource.query(
      `SELECT count(*)::int AS count FROM public.typeorm_migrations`,
    )) as Array<{ count: number }>;
    const afterCount = afterRows[0].count;
    const expected = beforeCount + branchMigrations.length;
    if (afterCount !== expected) {
      throw new Error(
        `Migration count mismatch: expected ${expected}, got ${afterCount}. Manual review needed.`,
      );
    }

    // 5. Drop the branch schema
    await this.dataSource.query(
      `DROP SCHEMA IF EXISTS "${branch.schema}" CASCADE`,
    );

    // 6. Mark merged
    await this.dataSource.query(
      `UPDATE public._db_branches SET status = 'merged', merged_at = NOW()
       WHERE schema = $1`,
      [branch.schema],
    );
  }

  async discardBranch(branch: DbBranch): Promise<void> {
    await this.dataSource.query(
      `DROP SCHEMA IF EXISTS "${branch.schema}" CASCADE`,
    );
    await this.dataSource.query(
      `UPDATE public._db_branches SET status = 'discarded', discarded_at = NOW()
       WHERE schema = $1`,
      [branch.schema],
    );
  }

  async listBranches(): Promise<DbBranch[]> {
    const rows = (await this.dataSource.query(
      `SELECT name, schema, parent_schema, status, copy_data, created_by, created_at
       FROM public._db_branches
       ORDER BY created_at DESC`,
    )) as BranchRow[];

    return rows.map((r) => ({
      name: r.name,
      schema: r.schema,
      parentSchema: r.parent_schema,
      status: r.status as DbBranchStatus,
      copyData: r.copy_data,
      createdBy: r.created_by ?? 'manual',
      createdAt: r.created_at,
    }));
  }

  async cleanupStale(maxAgeHours: number = 24): Promise<number> {
    const stale = (await this.dataSource.query(
      `SELECT name, schema FROM public._db_branches
       WHERE status = 'active'
         AND created_at < NOW() - ($1::text || ' hours')::interval`,
      [maxAgeHours],
    )) as Array<{ name: string; schema: string }>;

    for (const row of stale) {
      await this.dataSource.query(
        `DROP SCHEMA IF EXISTS "${row.schema}" CASCADE`,
      );
      await this.dataSource.query(
        `UPDATE public._db_branches SET status = 'discarded', discarded_at = NOW()
         WHERE schema = $1`,
        [row.schema],
      );
    }

    if (stale.length > 0) {
      this.logger.log(
        `Cleaned up ${stale.length} stale branches (>${maxAgeHours}h)`,
      );
    }
    return stale.length;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async copySchemaStructure(from: string, to: string): Promise<void> {
    // 1. Tables
    const tables = (await this.dataSource.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = $1 AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
      [from],
    )) as Array<{ table_name: string }>;

    for (const { table_name } of tables) {
      await this.dataSource.query(
        `CREATE TABLE "${to}"."${table_name}" (LIKE "${from}"."${table_name}" INCLUDING ALL)`,
      );

      // 2a. Drop FKs copied into target (they point to source schema)
      const fks = (await this.dataSource.query(
        `SELECT con.conname
         FROM pg_constraint con
         JOIN pg_class cls ON con.conrelid = cls.oid
         JOIN pg_namespace ns ON cls.relnamespace = ns.oid
         WHERE ns.nspname = $1 AND con.contype = 'f'`,
        [to],
      )) as Array<{ conname: string }>;

      for (const fk of fks) {
        await this.dataSource.query(
          `ALTER TABLE "${to}"."${table_name}" DROP CONSTRAINT IF EXISTS "${fk.conname}"`,
        );
      }

      // 2b. Recreate FKs pointing to target schema
      const originalFks = (await this.dataSource.query(
        `SELECT con.conname, pg_get_constraintdef(con.oid) AS def
         FROM pg_constraint con
         JOIN pg_class cls ON con.conrelid = cls.oid
         JOIN pg_namespace ns ON cls.relnamespace = ns.oid
         WHERE ns.nspname = $1 AND con.contype = 'f'
           AND cls.relname = $2`,
        [from, table_name],
      )) as Array<{ conname: string; def: string }>;

      for (const fk of originalFks) {
        const newDef = fk.def.replace(
          new RegExp(`"${from}"\\.`, 'g'),
          `"${to}".`,
        );
        await this.dataSource.query(
          `ALTER TABLE "${to}"."${table_name}" ADD CONSTRAINT "${fk.conname}" ${newDef}`,
        );
      }
    }

    // 3. Sequences (needed for SERIAL columns)
    const sequences = (await this.dataSource.query(
      `SELECT sequence_name FROM information_schema.sequences
       WHERE sequence_schema = $1`,
      [from],
    )) as Array<{ sequence_name: string }>;

    for (const { sequence_name } of sequences) {
      await this.dataSource.query(
        `CREATE SEQUENCE IF NOT EXISTS "${to}"."${sequence_name}"`,
      );
      const lastVal = (await this.dataSource.query(
        `SELECT last_value FROM "${from}"."${sequence_name}"`,
      )) as Array<{ last_value: number | null }>;
      if (lastVal[0]?.last_value) {
        await this.dataSource.query(
          `SELECT setval('"${to}"."${sequence_name}"', $1)`,
          [lastVal[0].last_value],
        );
      }
    }
  }

  private async copySchemaData(from: string, to: string): Promise<void> {
    const tables = (await this.dataSource.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = $1 AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
      [from],
    )) as Array<{ table_name: string }>;

    const sorted = await this.topologicalSort(
      tables.map((t) => t.table_name),
      from,
    );

    for (const table of sorted) {
      const columns = (await this.dataSource.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = $1 AND table_name = $2
         AND is_generated = 'NEVER'
         ORDER BY ordinal_position`,
        [from, table],
      )) as Array<{ column_name: string }>;

      const colList = columns.map((c) => `"${c.column_name}"`).join(', ');
      await this.dataSource.query(
        `INSERT INTO "${to}"."${table}" (${colList})
         SELECT ${colList} FROM "${from}"."${table}"`,
      );
    }
  }

  private async topologicalSort(
    tables: string[],
    schema: string,
  ): Promise<string[]> {
    const result: string[] = [];
    const remaining = new Set(tables);

    while (remaining.size > 0) {
      let progressed = false;
      for (const table of [...remaining]) {
        const deps = (await this.dataSource.query(
          `SELECT ccu.table_name AS dep_table
           FROM information_schema.table_constraints tc
           JOIN information_schema.constraint_column_usage ccu
             ON tc.constraint_name = ccu.constraint_name
           WHERE tc.table_schema = $1 AND tc.table_name = $2
           AND tc.constraint_type = 'FOREIGN KEY'
           AND ccu.table_name != $2`,
          [schema, table],
        )) as Array<{ dep_table: string }>;

        const allDepsProcessed = deps.every((d) =>
          result.includes(d.dep_table),
        );
        if (allDepsProcessed) {
          result.push(table);
          remaining.delete(table);
          progressed = true;
        }
      }
      if (!progressed) {
        // Cycle detected — append remaining without guaranteed order
        result.push(...remaining);
        remaining.clear();
      }
    }
    return result;
  }

  private async runMigrationAgainstPublic(
    migrationName: string,
  ): Promise<void> {
    const migrationsDir =
      this.configService?.get<string>('dbBranching.migrationsDir') ||
      this.configService?.get<string>('MIGRATIONS_DIR') ||
      DEFAULT_MIGRATIONS_DIR;
    const migrationFile = path.join(migrationsDir, `${migrationName}.ts`);
    if (!existsSync(migrationFile)) {
      throw new Error(`Migration file not found: ${migrationFile}`);
    }
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      const mod = await import(migrationFile);
      const MigrationClass = mod.default || mod[Object.keys(mod)[0]];
      const instance = new MigrationClass();
      await instance.up(queryRunner);
    } finally {
      await queryRunner.release();
    }
  }

  private getAgentId(): string {
    return (
      this.configService?.get<string>('dbBranching.agentId') ||
      process.env.AGENT_ID ||
      'manual'
    );
  }
}
