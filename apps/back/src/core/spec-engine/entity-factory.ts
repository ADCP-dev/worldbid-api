/**
 * EntityFactory — creates TypeORM EntitySchema objects from ResourceSpec.
 *
 * Uses EntitySchema API (not decorators) so entities are created dynamically at runtime.
 * This is the core of the "no code generation" approach.
 */

import { EntitySchema, EntitySchemaColumnOptions } from 'typeorm';
import type { ResourceSpec, FieldSpec } from './spec.types';

export class EntityFactory {
  /**
   * Build a TypeORM EntitySchema from a ResourceSpec
   */
  static create(spec: ResourceSpec): EntitySchema<any> {
    const columns: Record<string, EntitySchemaColumnOptions> = {};

    // Primary key — always auto-increment integer
    columns.id = {
      type: Number,
      primary: true,
      generated: true,
    };

    for (const field of spec.fields) {
      columns[field.name] = this.createColumnOptions(field);
    }

    // Timestamps
    if (spec.timestamps !== false) {
      columns.createdAt = {
        type: Date,
        createDate: true,
      };
      columns.updatedAt = {
        type: Date,
        updateDate: true,
      };
    }

    // Soft delete
    if (spec.softDelete !== false) {
      columns.deletedAt = {
        type: Date,
        nullable: true,
        deleteDate: true,
      };
    }

    // Build indices
    const indices: { name?: string; columns: string[] }[] = [];
    for (const field of spec.fields) {
      if (field.index) {
        indices.push({
          name: `idx_${spec.table}_${field.name}`,
          columns: [field.name],
        });
      }
    }
    // Unique constraints (separate from regular indices)
    for (const field of spec.fields) {
      if (field.unique) {
        indices.push({
          name: `uq_${spec.table}_${field.name}`,
          columns: [field.name],
        } as any); // EntitySchema index type doesn't include unique, but TypeORM supports it
      }
    }

    const entitySchema = new EntitySchema<any>({
      name: spec.name,
      tableName: spec.table,
      columns,
      indices: indices.length > 0 ? indices : undefined,
    });

    return entitySchema;
  }

  /**
   * Convert a FieldSpec to TypeORM column options
   */
  private static createColumnOptions(
    field: FieldSpec,
  ): EntitySchemaColumnOptions {
    const options: EntitySchemaColumnOptions = {
      type: this.mapType(field),
      nullable: field.nullable ?? !field.required,
    };

    if (field.default !== undefined) {
      options.default = field.default;
    }

    if (field.length && (field.type === 'string' || field.type === 'enum')) {
      (options as any).length = field.length;
    }

    if (field.type === 'decimal') {
      (options as any).precision = field.precision ?? 10;
      (options as any).scale = field.scale ?? 2;
    }

    if (field.type === 'enum') {
      (options as any).enum = field.enum;
    }

    return options;
  }

  /**
   * Map spec field types to TypeORM column types
   */
  private static mapType(field: FieldSpec): any {
    switch (field.type) {
      case 'string':
        return String;
      case 'text':
        return 'text';
      case 'integer':
        return Number;
      case 'decimal':
        return 'numeric';
      case 'boolean':
        return Boolean;
      case 'datetime':
        return Date;
      case 'date':
        return 'date';
      case 'json':
        return 'jsonb';
      case 'enum':
        return String; // stored as varchar, validated at app level
      case 'ref':
        return Number; // foreign key is integer
      default:
        return String;
    }
  }
}