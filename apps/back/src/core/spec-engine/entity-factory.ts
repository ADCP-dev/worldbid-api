/**
 * EntityFactory — creates TypeORM EntitySchema objects from ResourceSpec.
 *
 * Uses EntitySchema API (not decorators) so entities are created dynamically
 * at runtime. Supports field types including ref (many-to-one relations),
 * file, enum, and all standard types.
 *
 * Relations: ref fields are created as real FK columns with EntitySchema
 * relations (many-to-one). The engine resolves refs after loading all specs
 * so cross-resource references work correctly.
 */

import {
  EntitySchema,
  EntitySchemaColumnOptions,
  EntitySchemaRelationOptions,
} from 'typeorm';
import type { ResourceSpec, FieldSpec } from './spec.types';

export class EntityFactory {
  /**
   * Build a TypeORM EntitySchema from a ResourceSpec.
   * @param spec The resource specification
   * @param allResources Map of all resource specs (for resolving ref targets)
   */
  static create(
    spec: ResourceSpec,
    allResources?: Map<string, ResourceSpec>,
  ): EntitySchema<any> {
    const columns: Record<string, EntitySchemaColumnOptions> = {};
    const relations: Record<string, EntitySchemaRelationOptions> = {};

    // Primary key — always auto-increment integer
    columns.id = {
      type: Number,
      primary: true,
      generated: true,
    };

    for (const field of spec.fields) {
      if (field.type === 'ref') {
        // ref field: create both the FK column AND the relation
        columns[field.name] = {
          type: Number,
          nullable: field.nullable ?? !field.required,
        };

        if (field.default !== undefined) {
          columns[field.name].default = field.default;
        }

        // Create the relation (many-to-one)
        // The relation target is the resource name, which maps to
        // an EntitySchema with that name
        const relationName = this.fieldToRelationName(field.name);
        relations[relationName] = {
          type: 'many-to-one',
          target: () => field.ref!,
          joinColumn: { name: field.name },
          onDelete: field.refOnDelete || 'RESTRICT',
          nullable: field.nullable ?? !field.required,
        };
      } else if (field.type === 'file') {
        // file field: stored as varchar (file ID is a string UUID)
        columns[field.name] = {
          type: 'varchar',
          nullable: field.nullable ?? !field.required,
        };
      } else {
        columns[field.name] = this.createColumnOptions(field);
      }
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
    // Unique constraints
    for (const field of spec.fields) {
      if (field.unique) {
        indices.push({
          name: `uq_${spec.table}_${field.name}`,
          columns: [field.name],
        } as any);
      }
    }

    const entitySchema = new EntitySchema<any>({
      name: spec.name,
      tableName: spec.table,
      columns,
      indices: indices.length > 0 ? indices : undefined,
      relations: Object.keys(relations).length > 0 ? relations : undefined,
    });

    return entitySchema;
  }

  /**
   * Convert a FieldSpec to TypeORM column options (non-ref, non-file types)
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
        return String;
      case 'ref':
        return Number;
      case 'file':
        return 'varchar';
      default:
        return String;
    }
  }

  /**
   * Convert a field name to a relation name.
   * 'assigneeId' → 'assignee'
   * 'clientId' → 'client'
   * 'task' → 'task' (no change if doesn't end in 'Id')
   */
  private static fieldToRelationName(fieldName: string): string {
    if (fieldName.endsWith('Id')) {
      return fieldName.slice(0, -2);
    }
    return fieldName;
  }
}