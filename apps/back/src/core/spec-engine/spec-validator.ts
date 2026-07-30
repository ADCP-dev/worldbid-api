/**
 * SpecValidator — validates ExtensionSpec objects structurally and semantically.
 *
 * No external dependencies (no ajv). Uses a custom validator that checks:
 * 1. Structural correctness (required fields, types, enum values)
 * 2. Cross-references (ref targets exist, hook paths resolve)
 * 3. Conflict detection (table names unique, resource names unique)
 * 4. Permission validation (roles valid, rowLevel filters reference real fields)
 *
 * Returns structured errors so the AI can fix them.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '@nestjs/common';
import type {
  ExtensionSpec,
  ResourceSpec,
  FieldSpec,
  PermissionRole,
  LoadedSpec,
} from './spec.types';

const logger = new Logger('SpecValidator');

export interface ValidationError {
  level?: 'error' | 'warning';
  resource?: string;
  field?: string;
  message: string;
  suggestion?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

const VALID_FIELD_TYPES = [
  'string', 'text', 'integer', 'decimal', 'boolean',
  'datetime', 'date', 'json', 'enum', 'ref', 'file',
];

const VALID_ROLES: PermissionRole[] = ['admin', 'customer', 'affiliate', 'public'];

const VALID_REF_ON_DELETE = ['CASCADE', 'SET NULL', 'RESTRICT'];

const VALID_HOOK_TYPES = [
  'beforeCreate', 'afterCreate',
  'beforeUpdate', 'afterUpdate',
  'beforeDelete', 'afterDelete',
];

const VALID_CHANNELS = ['email', 'webhook', 'sms'];

const VALID_CHART_TYPES = ['stat', 'donut', 'bar', 'line', 'custom'];

const VALID_AGGREGATES = ['count', 'sum', 'avg', 'min', 'max'];

const VALID_INTERVALS = ['hour', 'day', 'week', 'month'];

export class SpecValidator {
  /**
   * Validate all loaded specs together (cross-reference checks)
   */
  static validateAll(loadedSpecs: LoadedSpec[]): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Build resource registry for cross-ref checks
    const resourceMap = new Map<string, { spec: ResourceSpec; loaded: LoadedSpec }>();
    const tableMap = new Map<string, string>(); // table → resource name

    for (const loaded of loadedSpecs) {
      // Validate extension-level
      if (!loaded.spec.name) {
        errors.push({ message: `Extension at ${loaded.specPath} missing name` });
      }
      if (!loaded.spec.version) {
        warnings.push({ message: `Extension "${loaded.spec.name}" missing version` });
      }
      if (!loaded.spec.resources || loaded.spec.resources.length === 0) {
        errors.push({
          message: `Extension "${loaded.spec.name}" has no resources`,
          suggestion: 'Add at least one resource to the resources array',
        });
      }

      for (const resource of loaded.spec.resources || []) {
        // Check resource name uniqueness
        if (resourceMap.has(resource.name)) {
          errors.push({
            resource: resource.name,
            message: `Duplicate resource name "${resource.name}" found in multiple extensions`,
          });
        }

        // Check table uniqueness
        if (tableMap.has(resource.table)) {
          errors.push({
            resource: resource.name,
            message: `Duplicate table name "${resource.table}" (also used by "${tableMap.get(resource.table)}")`,
          });
        }

        resourceMap.set(resource.name, { spec: resource, loaded });
        tableMap.set(resource.table, resource.name);
      }
    }

    // Validate each resource
    for (const [name, { spec, loaded }] of Array.from(resourceMap)) {
      const result = this.validateResource(spec, resourceMap, loaded.dir);
      errors.push(...result.errors);
      warnings.push(...result.warnings);
    }

    // Validate views
    for (const loaded of loadedSpecs) {
      if (loaded.spec.views) {
        for (const view of loaded.spec.views) {
          const viewResult = this.validateView(view, resourceMap);
          errors.push(...viewResult.errors);
          warnings.push(...viewResult.warnings);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate a single resource spec
   */
  static validateResource(
    spec: ResourceSpec,
    allResources: Map<string, { spec: ResourceSpec; loaded: LoadedSpec }>,
    extensionDir: string,
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Required fields
    if (!spec.name) {
      errors.push({ message: 'Resource missing name' });
    }
    if (!spec.table) {
      errors.push({ resource: spec.name, message: 'Resource missing table' });
    }
    if (!spec.table?.startsWith('ext_')) {
      warnings.push({
        resource: spec.name,
        message: `Table "${spec.table}" should start with "ext_" (convention)`,
      });
    }
    if (!spec.fields || spec.fields.length === 0) {
      errors.push({
        resource: spec.name,
        message: 'Resource has no fields',
        suggestion: 'Add at least one field to the fields array',
      });
    }

    // Validate fields
    const fieldNames = new Set<string>();
    for (const field of spec.fields || []) {
      // Check field name uniqueness
      if (fieldNames.has(field.name)) {
        errors.push({
          resource: spec.name,
          field: field.name,
          message: `Duplicate field name "${field.name}"`,
        });
      }
      fieldNames.add(field.name);

      // Validate field type
      if (!VALID_FIELD_TYPES.includes(field.type)) {
        errors.push({
          resource: spec.name,
          field: field.name,
          message: `Invalid field type "${field.type}"`,
          suggestion: `Valid types: ${VALID_FIELD_TYPES.join(', ')}`,
        });
      }

      // Enum validation
      if (field.type === 'enum' && (!field.enum || field.enum.length === 0)) {
        errors.push({
          resource: spec.name,
          field: field.name,
          message: 'Enum field has no enum values',
          suggestion: 'Add enum values: enum: [value1, value2, ...]',
        });
      }

      // Ref validation
      if (field.type === 'ref') {
        if (!field.ref) {
          errors.push({
            resource: spec.name,
            field: field.name,
            message: 'Ref field has no ref target',
            suggestion: 'Add: ref: <resource-name>',
          });
        } else if (allResources && !allResources.has(field.ref) && field.ref !== 'user') {
          // 'user' is a built-in Foundation entity
          warnings.push({
            resource: spec.name,
            field: field.name,
            message: `Ref target "${field.ref}" not found in specs (may be a Foundation entity)`,
          });
        }
        if (field.refOnDelete && !VALID_REF_ON_DELETE.includes(field.refOnDelete)) {
          errors.push({
            resource: spec.name,
            field: field.name,
            message: `Invalid refOnDelete "${field.refOnDelete}"`,
            suggestion: `Valid values: ${VALID_REF_ON_DELETE.join(', ')}`,
          });
        }
      }

      // File validation
      if (field.type === 'file') {
        if (field.allowedMimes && !Array.isArray(field.allowedMimes)) {
          errors.push({
            resource: spec.name,
            field: field.name,
            message: 'allowedMimes must be an array',
          });
        }
      }

      // Validation rules sanity
      if (field.validation) {
        if (field.validation.min !== undefined && field.validation.max !== undefined) {
          if (field.validation.min > field.validation.max) {
            errors.push({
              resource: spec.name,
              field: field.name,
              message: `validation.min (${field.validation.min}) > validation.max (${field.validation.max})`,
            });
          }
        }
      }
    }

    // Validate permissions
    if (spec.permissions) {
      const permErrors = this.validatePermissions(spec.permissions, fieldNames);
      errors.push(...permErrors);
    }

    // Validate hooks — check files exist
    if (spec.hooks) {
      for (const hookType of VALID_HOOK_TYPES) {
        const hookPath = (spec.hooks as any)[hookType] as string | undefined;
        if (hookPath) {
          const absolutePath = path.resolve(extensionDir, hookPath);
          if (!fs.existsSync(absolutePath)) {
            warnings.push({
              resource: spec.name,
              message: `Hook "${hookType}" file not found: ${hookPath}`,
              suggestion: 'Create the handler file or remove the hook from spec',
            });
          }
        }
      }
    }

    // Validate notifications
    if (spec.notifications) {
      for (const notif of spec.notifications) {
        if (!notif.name) {
          errors.push({ resource: spec.name, message: 'Notification missing name' });
        }
        if (!notif.trigger?.on) {
          errors.push({
            resource: spec.name,
            message: `Notification "${notif.name}" missing trigger.on`,
          });
        }
        if (!VALID_CHANNELS.includes(notif.channel)) {
          errors.push({
            resource: spec.name,
            message: `Notification "${notif.name}" invalid channel "${notif.channel}"`,
            suggestion: `Valid channels: ${VALID_CHANNELS.join(', ')}`,
          });
        }
        if (notif.channel === 'email' && !notif.template) {
          warnings.push({
            resource: spec.name,
            message: `Email notification "${notif.name}" has no template`,
          });
        }
        if (notif.channel === 'webhook' && !notif.url) {
          errors.push({
            resource: spec.name,
            message: `Webhook notification "${notif.name}" missing url`,
          });
        }
      }
    }

    // Validate jobs
    if (spec.jobs) {
      for (const job of spec.jobs) {
        if (!job.name) {
          errors.push({ resource: spec.name, message: 'Job missing name' });
        }
        if (job.schedule === 'cron' && !job.value) {
          errors.push({
            resource: spec.name,
            message: `Job "${job.name}" has cron schedule but no cron expression`,
          });
        }
        if (job.schedule === 'interval' && !this.isValidInterval(job.value)) {
          errors.push({
            resource: spec.name,
            message: `Job "${job.name}" invalid interval "${job.value}"`,
            suggestion: 'Format: <number><unit> where unit is ms, s, m, or h (e.g. 60s, 5m, 1h)',
          });
        }
        if (job.handler) {
          const handlerPath = path.resolve(extensionDir, job.handler);
          if (!fs.existsSync(handlerPath)) {
            warnings.push({
              resource: spec.name,
              message: `Job "${job.name}" handler not found: ${job.handler}`,
            });
          }
        }
      }
    }

    // Validate webhooks
    if (spec.webhooks) {
      for (const webhook of spec.webhooks) {
        if (!webhook.path) {
          errors.push({ resource: spec.name, message: `Webhook "${webhook.name}" missing path` });
        }
        if (!['none', 'hmac', 'jwt'].includes(webhook.auth)) {
          errors.push({
            resource: spec.name,
            message: `Webhook "${webhook.name}" invalid auth "${webhook.auth}"`,
          });
        }
      }
    }

    // Validate UI
    if (spec.ui?.sidebar) {
      for (const item of spec.ui.sidebar.items || []) {
        if (!item.title || !item.link) {
          errors.push({
            resource: spec.name,
            message: `Sidebar item missing title or link`,
          });
        }
        if (item.roles) {
          for (const role of item.roles) {
            if (!VALID_ROLES.includes(role)) {
              errors.push({
                resource: spec.name,
                message: `Sidebar item "${item.title}" invalid role "${role}"`,
              });
            }
          }
        }
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate permissions spec
   */
  private static validatePermissions(
    perms: NonNullable<ResourceSpec['permissions']>,
    fieldNames: Set<string>,
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    const checkRoles = (roles: PermissionRole[] | undefined, action: string) => {
      if (!roles) return;
      for (const role of roles) {
        if (!VALID_ROLES.includes(role)) {
          errors.push({
            message: `Invalid role "${role}" in permissions.${action}`,
            suggestion: `Valid roles: ${VALID_ROLES.join(', ')}`,
          });
        }
      }
    };

    // Warn about 'public' role — requires unguarding the route
    const allPermRoles = [
      ...(perms.list || []), ...(perms.read || []),
      ...(perms.create || []), ...(perms.update || []),
      ...(perms.delete || []),
    ];
    if (allPermRoles.includes('public')) {
      warnings.push({
        resource: spec.name,
        message: 'Permission "public" requires the route to be unguarded. ' +
          'Spec engine currently applies AuthGuard(jwt) on all routes. ' +
          'Use "admin" or "customer" instead, or write a manual controller.',
      });
    }

    checkRoles(perms.list, 'list');
    checkRoles(perms.read, 'read');
    checkRoles(perms.create, 'create');
    checkRoles(perms.update, 'update');
    checkRoles(perms.delete, 'delete');

    // Field-level permissions
    if (perms.fields) {
      for (const [fieldName, fieldPerm] of Object.entries(perms.fields)) {
        if (!fieldNames.has(fieldName)) {
          errors.push({
            message: `Field permission references non-existent field "${fieldName}"`,
          });
        }
        if (fieldPerm.read) checkRoles(fieldPerm.read, `fields.${fieldName}.read`);
        if (fieldPerm.write) checkRoles(fieldPerm.write, `fields.${fieldName}.write`);
      }
    }

    // Row-level filters
    if (perms.rowLevel) {
      for (const [role, rule] of Object.entries(perms.rowLevel)) {
        if (!VALID_ROLES.includes(role as PermissionRole)) {
          errors.push({
            message: `Row-level filter for invalid role "${role}"`,
          });
        }
        if (!rule.filter) {
          errors.push({
            message: `Row-level filter for role "${role}" missing filter expression`,
          });
        } else {
          // Check that the filter references a real field
          const fieldMatch = rule.filter.match(/^(\w+)\s*==/);
          if (fieldMatch && !fieldNames.has(fieldMatch[1])) {
            errors.push({
              message: `Row-level filter references non-existent field "${fieldMatch[1]}"`,
            });
          }
        }
      }
    }

    return errors;
  }

  /**
   * Validate a view spec
   */
  private static validateView(
    view: any,
    resourceMap: Map<string, { spec: ResourceSpec; loaded: LoadedSpec }>,
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    if (!view.name) {
      errors.push({ message: 'View missing name' });
    }
    if (!['dashboard', 'custom'].includes(view.type)) {
      errors.push({
        message: `View "${view.name}" invalid type "${view.type}"`,
        suggestion: 'Valid types: dashboard, custom',
      });
    }
    if (!view.roles || view.roles.length === 0) {
      warnings.push({
        message: `View "${view.name}" has no roles defined — will be admin-only by default`,
      });
    }

    if (view.panels) {
      for (const panel of view.panels) {
        if (!panel.name) {
          errors.push({ message: `Panel in view "${view.name}" missing name` });
        }
        if (!VALID_CHART_TYPES.includes(panel.chart)) {
          errors.push({
            message: `Panel "${panel.name}" invalid chart "${panel.chart}"`,
            suggestion: `Valid charts: ${VALID_CHART_TYPES.join(', ')}`,
          });
        }
        if (panel.query) {
          if (!resourceMap.has(panel.query.resource)) {
            errors.push({
              message: `Panel "${panel.name}" references unknown resource "${panel.query.resource}"`,
            });
          }
          if (!VALID_AGGREGATES.includes(panel.query.aggregate)) {
            errors.push({
              message: `Panel "${panel.name}" invalid aggregate "${panel.query.aggregate}"`,
            });
          }
          if (panel.query.groupByInterval && !VALID_INTERVALS.includes(panel.query.groupByInterval)) {
            errors.push({
              message: `Panel "${panel.name}" invalid groupByInterval "${panel.query.groupByInterval}"`,
            });
          }
        }
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Check if an interval string is valid (e.g. "60s", "5m", "1h", "500ms")
   */
  private static isValidInterval(value: string): boolean {
    return /^\d+(ms|s|m|h)$/.test(value);
  }
}