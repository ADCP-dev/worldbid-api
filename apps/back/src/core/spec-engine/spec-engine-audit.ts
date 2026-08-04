/**
 * SpecAuditLogger — persists field-level change audits for spec resources.
 *
 * For any resource whose `audit` spec is enabled, the controller factory
 * compares old vs. new values for each changed field after a successful
 * update and writes one audit row per changed field to a per-resource
 * `ext_<resource>_audit` table.
 *
 * The audit table is created lazily on first write: we build an EntitySchema
 * dynamically and let TypeORM's `DataSource.manager` save a plain object
 * against it. The table itself must already exist in the database (created
 * by the migration generator); the logger never runs DDL — it only inserts
 * rows.
 *
 * Why lazy ModuleRef?
 *   DataSource lives in the TypeORM module graph and is only resolvable
 *   after the spec engine module has booted. SpecEngineBootService exposes
 *   the ModuleRef via a static accessor; SpecAuditLogger pulls DataSource
 *   from it on the first `log()` call (and re-resolves if not yet bound).
 *   This mirrors the pattern used by SpecErrorReporter.
 *
 * This logger NEVER throws — auditing is strictly best-effort. Any failure
 * (missing table, missing DataSource, serialization error) is caught and
 * logged via the NestJS Logger so the caller's update path is unaffected.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { DataSource, EntitySchema, Repository } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SpecAuditLogParams {
  /** Resource name (matches ResourceSpec.name) — used to derive the audit table. */
  resource: string;
  /** ID of the entity that was changed. */
  entityId: number;
  /** Operation that triggered the audit: 'create' | 'update' | 'delete'. */
  operation: string;
  /** Name of the field that changed. */
  field: string;
  /** Previous value of the field (serialized to text). */
  oldValue: unknown;
  /** New value of the field (serialized to text). */
  newValue: unknown;
  /** ID of the user who performed the operation (nullable for system jobs). */
  userId: number | null;
}

// ─── Schema cache ─────────────────────────────────────────────────────────────

/**
 * Cached per-resource EntitySchema for the audit table. Building an
 * EntitySchema on every write is wasteful, so we memoize by resource name.
 */
const auditSchemaCache = new Map<string, EntitySchema<any>>();

/**
 * Build (and cache) a TypeORM EntitySchema for `ext_<resource>_audit`.
 *
 * Columns:
 *   - id          serial PK
 *   - entityId    int
 *   - operation   varchar
 *   - field       varchar
 *   - oldValue    text (nullable)
 *   - newValue    text (nullable)
 *   - userId      int (nullable)
 *   - timestamp   timestamptz default now()
 */
export function getAuditSchema(resource: string): EntitySchema<any> {
  const cached = auditSchemaCache.get(resource);
  if (cached) return cached;

  const tableName = `ext_${resource}_audit`;
  const schemaName = `SpecAudit_${resource}`;

  const schema = new EntitySchema<any>({
    name: schemaName,
    tableName,
    columns: {
      id: {
        type: Number,
        primary: true,
        generated: true,
      },
      entityId: {
        type: Number,
        name: 'entityId',
      },
      operation: {
        type: 'varchar',
        name: 'operation',
      },
      field: {
        type: 'varchar',
        name: 'field',
      },
      oldValue: {
        type: 'text',
        name: 'oldValue',
        nullable: true,
      },
      newValue: {
        type: 'text',
        name: 'newValue',
        nullable: true,
      },
      userId: {
        type: Number,
        name: 'userId',
        nullable: true,
      },
      timestamp: {
        type: 'timestamptz',
        name: 'timestamp',
        default: () => 'now()',
      },
    },
  });

  auditSchemaCache.set(resource, schema);
  return schema;
}

/**
 * Serialize a field value to a text-safe string for the audit columns.
 * Objects/arrays become JSON; null/undefined become null; everything else
 * is stringified.
 */
function serializeValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class SpecAuditLogger {
  private readonly logger = new Logger('SpecAuditLogger');

  /**
   * ModuleRef is injected lazily to avoid circular module dependencies —
   * the spec engine module is built before the TypeORM module graph is
   * guaranteed to be resolvable. The host (SpecEngineBootService.onModuleInit)
   * resolves ModuleRef and calls setModuleRef() once it is available.
   */
  private moduleRef: ModuleRef | null = null;

  constructor() {}

  /**
   * Bind the ModuleRef after the DI container has finished bootstrapping.
   * Safe to call multiple times — the last call wins.
   */
  setModuleRef(moduleRef: ModuleRef): void {
    this.moduleRef = moduleRef;
    this.logger.debug('ModuleRef bound');
  }

  /**
   * Resolve the default DataSource from the DI container.
   * Returns null if ModuleRef isn't bound yet or DataSource can't be resolved.
   */
  private getDataSource(): DataSource | null {
    if (!this.moduleRef) return null;
    try {
      // The default DataSource is registered under the DataSource class
      // token (getDataSourceToken() returns DataSource for the default name).
      const token = getDataSourceToken();
      return this.moduleRef.get(token, { strict: false }) as DataSource;
    } catch {
      return null;
    }
  }

  /**
   * Persist a single audit entry for a changed field.
   *
   * NEVER throws — all errors are caught and logged. The caller (controller
   * factory) invokes this fire-and-forget, so a throw here would surface as
   * an unhandled rejection. We guard against that too.
   */
  async log(params: SpecAuditLogParams): Promise<void> {
    try {
      const dataSource = this.getDataSource();
      if (!dataSource) {
        this.logger.warn(
          `DataSource not available — audit for ${params.resource}#${params.entityId} ` +
            `(${params.operation}/${params.field}) dropped.`,
        );
        return;
      }

      const schema = getAuditSchema(params.resource);

      // Build a plain row object matching the schema columns.
      const row = {
        entityId: params.entityId,
        operation: params.operation,
        field: params.field,
        oldValue: serializeValue(params.oldValue),
        newValue: serializeValue(params.newValue),
        userId: params.userId,
      };

      // Use the DataSource manager to insert. We create a transient repository
      // from the cached schema — this avoids needing the schema to be
      // registered in the connection's entity map (it isn't), while still
      // using TypeORM's query builder for parameterized inserts.
      const repo: Repository<any> = dataSource.getRepository(schema as any);
      await repo.insert(row);
    } catch (err) {
      this.logger.error(
        `Failed to write audit log for ${params.resource}#${params.entityId} ` +
          `(${params.operation}/${params.field}): ${(err as Error).message}`,
      );
    }
  }
}
