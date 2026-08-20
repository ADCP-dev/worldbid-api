/**
 * EntityIntrospector — derives DB entity views from loaded specs.
 *
 * Spec-engine entities: columns and indexes derived from FieldSpec.
 * Traditional entities: optional DataSource metadata (Mode B); empty when absent.
 */

import { specLoaderEvents } from '@core/spec-engine/spec-loader';
import type { LoadedSpec } from '@core/spec-engine/spec-loader';
import type { FieldSpec, ResourceSpec } from '@core/spec-engine/spec.types';
import { IntrospectionCache } from '../introspection-cache';
import type { EntityView, ColumnView, IndexView } from '../types';

export interface TraditionalEntityContributor {
  listTraditionalEntities(): EntityView[];
}

const FIELD_TYPE_TO_SQL: Record<string, string> = {
  string: 'varchar',
  text: 'text',
  integer: 'int',
  decimal: 'decimal',
  boolean: 'boolean',
  datetime: 'timestamp',
  date: 'date',
  json: 'json',
  enum: 'varchar',
  ref: 'int',
  file: 'varchar',
  computed: 'int',
  'many-to-many': 'int',
  password: 'varchar',
  secret: 'varchar',
};

export class EntityIntrospector {
  constructor(
    private readonly loadedSpecs: LoadedSpec[],
    private readonly cache: IntrospectionCache,
    private readonly traditional?: TraditionalEntityContributor,
  ) {
    specLoaderEvents.on('reload', () => this.cache.clearAll());
  }

  listEntities(): EntityView[] {
    const cached = this.cache.get<EntityView[]>('entity:list');
    if (cached) return cached;
    const entities: EntityView[] = [];
    for (const loaded of this.loadedSpecs) {
      for (const res of loaded.spec.resources) {
        entities.push(this.resourceEntity(loaded.spec.name, res));
      }
    }
    if (this.traditional) {
      entities.push(...this.traditional.listTraditionalEntities());
    }
    this.cache.set('entity:list', entities);
    return entities;
  }

  private resourceEntity(ext: string, res: ResourceSpec): EntityView {
    const columns: ColumnView[] = [
      { name: 'id', type: 'uuid', primary: true, generated: true, nullable: false },
    ];
    const indexes: IndexView[] = [];
    for (const f of res.fields) {
      columns.push(this.fieldColumn(f));
      if (f.index) {
        indexes.push({ name: `idx_${res.table}_${f.name}`, columns: [f.name] });
      }
    }
    if (res.timestamps) {
      columns.push({ name: 'createdAt', type: 'timestamp', nullable: false });
      columns.push({ name: 'updatedAt', type: 'timestamp', nullable: false });
    }
    if (res.softDelete) {
      columns.push({ name: 'deletedAt', type: 'timestamp', nullable: true });
    }
    return {
      name: res.name,
      table: res.table,
      source: 'spec_engine',
      extension: ext,
      columns,
      indexes,
    };
  }

  private fieldColumn(f: FieldSpec): ColumnView {
    const col: ColumnView = {
      name: f.name,
      type: FIELD_TYPE_TO_SQL[f.type] ?? 'varchar',
      nullable: f.nullable ?? !f.required,
    };
    if (f.length) col.length = f.length;
    if (f.type === 'ref' && f.ref) {
      col.references = { table: f.ref, column: 'id', onDelete: f.refOnDelete };
    }
    return col;
  }
}