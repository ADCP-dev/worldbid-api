/**
 * ValidationFactory — creates Zod validation schemas from ResourceSpec fields.
 *
 * The engine uses these schemas to validate incoming request bodies at runtime,
 * replacing hand-written DTOs with class-validator decorators.
 */

import { z } from 'zod';
import type { ResourceSpec, FieldSpec } from './spec.types';

export class ValidationFactory {
  /**
   * Build a Zod schema for creating a resource (required fields are enforced)
   */
  static createCreateSchema(spec: ResourceSpec): z.ZodTypeAny {
    return this.buildSchema(spec, true);
  }

  /**
   * Build a Zod schema for updating a resource (all fields optional)
   */
  static createUpdateSchema(spec: ResourceSpec): z.ZodTypeAny {
    return this.buildSchema(spec, false);
  }

  /**
   * Build a Zod schema from field specs
   */
  private static buildSchema(
    spec: ResourceSpec,
    isCreate: boolean,
  ): z.ZodTypeAny {
    const shape: Record<string, z.ZodTypeAny> = {};

    for (const field of spec.fields) {
      const fieldSchema = this.buildFieldSchema(field);

      if (isCreate) {
        // Create: required fields are required, nullable fields are optional
        if (field.required && !field.nullable) {
          shape[field.name] = fieldSchema;
        } else {
          shape[field.name] = fieldSchema.optional().nullable();
        }
      } else {
        // Update: all fields optional
        shape[field.name] = fieldSchema.optional().nullable();
      }
    }

    return z.object(shape);
  }

  /**
   * Build a Zod schema for a single field
   */
  private static buildFieldSchema(field: FieldSpec): z.ZodTypeAny {
    let schema: z.ZodTypeAny;

    switch (field.type) {
      case 'string':
      case 'text':
      case 'enum':
        schema = z.string();
        if (field.type === 'enum' && field.enum) {
          schema = z.enum(field.enum as [string, ...string[]]);
        }
        if (field.validation?.min) {
          schema = (schema as z.ZodString).min(field.validation.min);
        }
        if (field.validation?.max) {
          schema = (schema as z.ZodString).max(field.validation.max);
        }
        if (field.validation?.pattern) {
          schema = (schema as z.ZodString).regex(
            new RegExp(field.validation.pattern),
          );
        }
        if (field.validation?.email) {
          schema = (schema as z.ZodString).email();
        }
        if (field.validation?.url) {
          schema = (schema as z.ZodString).url();
        }
        break;

      case 'integer':
        schema = z.number().int();
        if (field.validation?.min !== undefined) {
          schema = (schema as z.ZodNumber).min(field.validation.min);
        }
        if (field.validation?.max !== undefined) {
          schema = (schema as z.ZodNumber).max(field.validation.max);
        }
        break;

      case 'decimal':
        schema = z.number();
        if (field.validation?.min !== undefined) {
          schema = (schema as z.ZodNumber).min(field.validation.min);
        }
        break;

      case 'boolean':
        schema = z.boolean();
        break;

      case 'datetime':
        schema = z.coerce.date();
        break;

      case 'date':
        schema = z.string();
        break;

      case 'json':
        schema = z.record(z.unknown());
        break;

      case 'ref':
        schema = z.number().int().positive();
        break;

      case 'file':
        schema = z.string().uuid().nullable();
        break;

      default:
        schema = z.unknown();
    }

    return schema;
  }
}