/**
 * Spec schema drift detection (design §12.2 / §12.3).
 *
 * Per extension, compute a stable sha256 hash over the canonical JSON of its
 * merged ExtensionSpec (recursive key sort → same hash regardless of YAML key
 * order) and persist it in the `spec_schema_version` table.
 *
 * Boot behavior — drift detection must NEVER block boot on its own internal
 * errors (fail open with a warning):
 *   - no stored row    → insert + info log (first boot).
 *   - hashes match     → nothing.
 *   - hash differs     → per SPEC_ENGINE_DRIFT (warn|block|off):
 *       'warn' (non-prod default): log a loud WARN telling the operator to
 *         run spec:generate-migration.
 *       'block' (prod default): throw so Nest aborts startup.
 *       'off': skip entirely.
 *
 * Table creation note: `spec_schema_version` is engine bookkeeping
 * (infrastructural, like typeorm_migrations — it describes spec state, not
 * business data). It is created lazily via `CREATE TABLE IF NOT EXISTS` at
 * drift-check time instead of adding a file under
 * src/infrastructure/database/migrations/ (which is out of scope here).
 * IF NOT EXISTS keeps repeated boots and concurrent boots safe.
 */

import { Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { DataSource } from 'typeorm';
import type { LoadedSpec } from './spec-loader';

export const SPEC_SCHEMA_VERSION_TABLE = 'spec_schema_version';

/** Valid values for the SPEC_ENGINE_DRIFT env override. */
export type DriftMode = 'warn' | 'block' | 'off';

const logger = new Logger('SpecSchemaDrift');

/** Env override for the drift reaction. Default: warn (non-prod) / block (prod). */
const DRIFT_ENV_VAR = 'SPEC_ENGINE_DRIFT';

/** Resolve the effective drift mode from env + NODE_ENV. */
export function resolveDriftMode(isProduction: boolean): DriftMode {
  const raw = process.env[DRIFT_ENV_VAR];
  if (raw === 'warn' || raw === 'block' || raw === 'off') {
    return raw;
  }
  if (raw !== undefined) {
    logger.warn(
      `Invalid ${DRIFT_ENV_VAR}="${raw}" — falling back to default (warn in non-prod, block in prod)`,
    );
  }
  return isProduction ? 'block' : 'warn';
}

/**
 * Deterministic JSON: keys sorted recursively, undefined values dropped.
 * Guarantees the same semantic spec always hashes identically.
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`)
    .join(',')}}`;
}

/** sha256 over the stable serialization of one extension's merged spec. */
export function computeSchemaHash(loaded: LoadedSpec): string {
  return createHash('sha256')
    .update(stableStringify(loaded.spec))
    .digest('hex');
}

/** Outcome of the drift check for one extension. */
export interface SchemaDriftOutcome {
  status: 'created' | 'unchanged' | 'drift' | 'off' | 'failed';
  extension: string;
  previousHash?: string;
  currentHash?: string;
}

/** Ensure the persistence table exists (idempotent, see module comment). */
async function ensureTable(dataSource: DataSource): Promise<void> {
  await dataSource.query(
    `CREATE TABLE IF NOT EXISTS ${SPEC_SCHEMA_VERSION_TABLE} (
       "extensionName" varchar NOT NULL PRIMARY KEY,
       "schemaHash" varchar NOT NULL,
       "updatedAt" timestamptz NOT NULL DEFAULT now()
     )`,
  );
}

/**
 * Run the drift check for every loaded extension. Resolves to per-extension
 * outcomes; throws ONLY when mode is 'block' and a drift is detected (to
 * abort boot). All other internal failures are swallowed with a WARN —
 * fail open, per the module contract.
 */
export async function runSchemaDriftCheck(
  loadedSpecs: LoadedSpec[],
  dataSource: DataSource,
): Promise<SchemaDriftOutcome[]> {
  if (loadedSpecs.length === 0) return [];
  const mode = resolveDriftMode(process.env.NODE_ENV === 'production');
  if (mode === 'off') {
    return [{ status: 'off', extension: '*' }];
  }

  try {
    await ensureTable(dataSource);
  } catch (err) {
    logger.warn(
      `Schema drift check skipped — could not ensure ${SPEC_SCHEMA_VERSION_TABLE} table: ${(err as Error).message}`,
    );
    return [{ status: 'failed', extension: '*' }];
  }

  const outcomes: SchemaDriftOutcome[] = [];
  for (const loaded of loadedSpecs) {
    const extension = loaded.spec?.name ?? '';
    try {
      const currentHash = computeSchemaHashForTest(loaded);
      const rows = (await dataSource.query(
        `SELECT "schemaHash" FROM ${SPEC_SCHEMA_VERSION_TABLE} WHERE "extensionName" = $1`,
        [extension],
      )) as Array<{ schemaHash?: string }>;
      const previousHash = rows[0]?.schemaHash;

      if (!previousHash) {
        await upsertHash(dataSource, extension, currentHash);
        logger.log(
          `Schema hash recorded for extension "${extension}" (first boot)`,
        );
        outcomes.push({ status: 'created', extension, currentHash });
        continue;
      }

      if (previousHash === currentHash) {
        outcomes.push({ status: 'unchanged', extension });
        continue;
      }

      outcomes.push({
        status: 'drift',
        extension,
        previousHash,
        currentHash,
      });
      if (mode === 'block') {
        throw new DriftDetectedError(extension, previousHash, currentHash);
      }
      logger.warn(
        `⚠️  Schema drift detected for extension "${extension}" — specs changed since last boot. ` +
          'Run `pnpm --filter back spec:generate-migration` and apply migrations before deploying.',
      );
    } catch (err) {
      if (err instanceof DriftDetectedError) throw err;
      logger.warn(
        `Schema drift check failed for extension "${extension}": ${(err as Error).message}`,
      );
      outcomes.push({ status: 'failed', extension });
    }
  }
  return outcomes;
}

export class DriftDetectedError extends Error {
  constructor(extension: string, previousHash: string, currentHash: string) {
    super(
      `Spec schema drift detected for extension "${extension}" — run spec:generate-migration and apply migrations before deploying.`,
    );
    this.name = 'DriftDetectedError';
  }
}

async function upsertHash(
  dataSource: DataSource,
  extension: string,
  hash: string,
): Promise<void> {
  await dataSource.query(
    `INSERT INTO ${SPEC_SCHEMA_VERSION_TABLE} ("extensionName", "schemaHash", "updatedAt")
     VALUES ($1, $2, now())
     ON CONFLICT ("extensionName") DO UPDATE SET "schemaHash" = $2, "updatedAt" = now()`,
    [extension, hash],
  );
}

/** Test seam — exported so tests can hash without going through run(). */
export function computeSchemaHashForTest(loaded: LoadedSpec): string {
  return createHash('sha256')
    .update(stableStringify(loaded.spec))
    .digest('hex');
}
