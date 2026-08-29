#!/usr/bin/env node
/**
 * spec-validate.ts — CLI to validate spec YAML files without running the app.
 *
 * Usage:
 *   node src/core/spec-engine/spec-validate.ts [extension] [--verbose]
 *   node src/core/spec-engine/spec-validate.ts tasks --verbose
 *   node src/core/spec-engine/spec-validate.ts          # validates ALL
 *
 * Exits:
 *   0 — all valid
 *   1 — errors
 *   2 — file/parse errors
 */

const fs = require('fs');
const path = require('path');

// js-yaml from pnpm store
let yaml;
try {
  yaml = require('js-yaml');
} catch {
  const pnpmBase = path.resolve(process.cwd(), '../../node_modules/.pnpm');
  if (!fs.existsSync(pnpmBase)) {
    console.error('js-yaml not found. Run from apps/back/: pnpm install');
    process.exit(2);
  }
  const jsYamlDir = fs
    .readdirSync(pnpmBase)
    .find((d) => d.startsWith('js-yaml@'));
  if (!jsYamlDir) {
    console.error('js-yaml not found in pnpm store.');
    process.exit(2);
  }
  yaml = require(path.join(pnpmBase, jsYamlDir, 'node_modules/js-yaml'));
}

const extensionName = process.argv.slice(2).find((a) => !a.startsWith('--'));
const verbose =
  process.argv.includes('--verbose') || process.argv.includes('-v');

const extensionsDir = path.resolve(process.cwd(), 'src/extensions');
const customDir = path.resolve(process.cwd(), 'src/custom');

// ─── Collect spec files ──────────────────────────────────────────────────

let specFiles = [];

function collectSpecsFromDir(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  for (const ext of fs.readdirSync(dir)) {
    const extDir = path.join(dir, ext);
    if (fs.statSync(extDir).isDirectory()) {
      const extFiles = fs
        .readdirSync(extDir)
        .filter((f) => f.endsWith('.spec.yaml'))
        .map((f) => path.join(extDir, f));
      files.push(...extFiles);
    }
  }
  return files;
}

if (extensionName) {
  const extDir = path.join(extensionsDir, extensionName);
  const customExtDir = path.join(customDir, extensionName);
  if (fs.existsSync(extDir)) {
    specFiles = specFiles.concat(
      fs
        .readdirSync(extDir)
        .filter((f) => f.endsWith('.spec.yaml'))
        .map((f) => path.join(extDir, f)),
    );
  }
  if (fs.existsSync(customExtDir)) {
    specFiles = specFiles.concat(
      fs
        .readdirSync(customExtDir)
        .filter((f) => f.endsWith('.spec.yaml'))
        .map((f) => path.join(customExtDir, f)),
    );
  }
  if (specFiles.length === 0) {
    console.error(`Extension not found: ${extensionName}`);
    process.exit(2);
  }
} else {
  specFiles = [
    ...collectSpecsFromDir(extensionsDir),
    ...collectSpecsFromDir(customDir),
  ];
}

if (specFiles.length === 0) {
  console.log('No .spec.yaml files found.');
  process.exit(0);
}

// ─── Parse + validate ────────────────────────────────────────────────────

const errors = [];
const warnings = [];
const allResources = [];

for (const file of specFiles) {
  try {
    const content = fs.readFileSync(file, 'utf-8');
    const spec = yaml.load(content);

    // Extension format: { name, version, resources: [{ name, table, fields, ... }] }
    // Or flat format: { name, table, fields, ... }
    const resources = spec.resources || [spec];
    const extName = spec.name || path.basename(file, '.spec.yaml');

    for (const resource of resources) {
      const rName = resource.name || extName;
      const rTable = resource.table;

      // ─── Required fields ─────────────────────────────────────────────
      if (!resource.name && !spec.name) {
        errors.push({ file, message: 'Missing required field: name' });
        continue;
      }

      if (!rTable) {
        errors.push({
          file,
          message: `${rName}: missing table`,
        });
        continue;
      }

      if (!resource.fields || !Array.isArray(resource.fields)) {
        errors.push({
          file,
          message: `${rName}: missing or invalid fields (must be array)`,
        });
        continue;
      }

      // ─── Field validation ────────────────────────────────────────────
      for (const field of resource.fields) {
        if (!field.name) {
          errors.push({
            file,
            message: `${rName}: field missing name`,
          });
          continue;
        }
        if (!field.type) {
          errors.push({
            file,
            message: `${rName}.${field.name}: missing type`,
          });
        }
        // Enum needs values
        if (
          field.type === 'enum' &&
          (!field.enum || !Array.isArray(field.enum) || field.enum.length === 0)
        ) {
          errors.push({
            file,
            message: `${rName}.${field.name}: enum type requires non-empty enum array`,
          });
        }
        // Ref needs target
        if (field.type === 'ref' && !field.ref) {
          errors.push({
            file,
            message: `${rName}.${field.name}: ref type requires ref target`,
          });
        }
        // Validation must be valid numbers
        if (field.validation) {
          if (
            field.validation.min !== undefined &&
            typeof field.validation.min !== 'number'
          ) {
            errors.push({
              file,
              message: `${rName}.${field.name}: validation.min must be number`,
            });
          }
          if (
            field.validation.max !== undefined &&
            typeof field.validation.max !== 'number'
          ) {
            errors.push({
              file,
              message: `${rName}.${field.name}: validation.max must be number`,
            });
          }
        }
      }

      // ─── Permissions ─────────────────────────────────────────────────
      if (!resource.permissions) {
        errors.push({
          file,
          message: `${rName}: missing permissions block`,
        });
      } else {
        const requiredActions = ['list', 'read', 'create', 'update', 'delete'];
        for (const action of requiredActions) {
          if (!(action in resource.permissions)) {
            errors.push({
              file,
              message: `${rName}: missing permission for action '${action}'`,
            });
          }
        }
      }

      // ─── Hooks file exists? ──────────────────────────────────────────
      const dir = path.dirname(file);
      if (resource.hooks) {
        for (const [hookType, hookName] of Object.entries(resource.hooks)) {
          const hookFile = path.join(dir, 'hooks', `${hookName}.ts`);
          if (!fs.existsSync(hookFile)) {
            warnings.push({
              file,
              message: `${rName}: hook '${hookName}' (${hookType}) — file not found`,
            });
          }
        }
      }

      // ─── Actions handler exists? ─────────────────────────────────────
      if (resource.actions) {
        for (const action of resource.actions) {
          if (action.handler) {
            const handlerFile = path.join(
              dir,
              'handlers',
              `${action.handler}.ts`,
            );
            if (!fs.existsSync(handlerFile)) {
              warnings.push({
                file,
                message: `${rName}: action '${action.name}' handler '${action.handler}' — file not found`,
              });
            }
          }
        }
      }

      // ─── Template files exist? ──────────────────────────────────────
      if (resource.notifications) {
        for (const notif of resource.notifications) {
          if (notif.template) {
            const tplFile = path.join(dir, notif.template);
            if (!fs.existsSync(tplFile)) {
              warnings.push({
                file,
                message: `${rName}: notification '${notif.name}' template '${notif.template}' — file not found`,
              });
            }
          }
        }
      }

      allResources.push({ name: rName, table: rTable, file, resource });
    }
  } catch (err) {
    errors.push({
      file,
      message: `Parse error: ${err.message}`,
    });
  }
}

// ─── Cross-reference validation ──────────────────────────────────────────

const resourceNames = new Set(allResources.map((r) => r.name));
const tableNames = new Map();

for (const r of allResources) {
  if (tableNames.has(r.table)) {
    errors.push({
      file: r.file,
      message: `${r.name}: table '${r.table}' already used by '${tableNames.get(r.table)}'`,
    });
  }
  tableNames.set(r.table, r.name);
}

// Check ref targets
for (const r of allResources) {
  for (const field of r.resource.fields || []) {
    if (field.type === 'ref' && field.ref) {
      const knownTargets = new Set([...resourceNames, 'user', 'role', 'file']);
      if (!knownTargets.has(field.ref)) {
        warnings.push({
          file: r.file,
          message: `${r.name}.${field.name}: ref target '${field.ref}' not found in any spec (may be external)`,
        });
      }
    }
  }
}

// ─── Output ──────────────────────────────────────────────────────────────

console.log(
  `\n📋 Spec Validator — ${allResources.length} resources in ${specFiles.length} files\n`,
);

if (errors.length > 0) {
  console.log(`❌ ${errors.length} error(s):\n`);
  for (const err of errors) {
    console.log(`  ${path.basename(err.file)}: ${err.message}`);
  }
  console.log('');
}

if (warnings.length > 0) {
  console.log(`⚠️  ${warnings.length} warning(s):\n`);
  for (const warn of warnings) {
    console.log(`  ${path.basename(warn.file)}: ${warn.message}`);
  }
  console.log('');
}

if (errors.length === 0 && warnings.length === 0) {
  console.log('✅ All specs valid — no errors, no warnings.\n');
}

// Summary
console.log('Summary:');
console.log(`  Resources: ${allResources.length}`);
console.log(`  Errors:    ${errors.length}`);
console.log(`  Warnings:  ${warnings.length}`);

// Verbose: list all resources with details
if (verbose) {
  console.log('\nResources:');
  for (const r of allResources) {
    console.log(`\n  ${r.name} (${r.table}):`);

    // Fields
    for (const field of r.resource.fields || []) {
      const req = field.required ? '*' : ' ';
      const ref = field.ref ? ` → ${field.ref}` : '';
      const enumValues = field.enum ? ` [${field.enum.join(', ')}]` : '';
      const val = field.validation
        ? ` (min:${field.validation.min ?? '-'}, max:${field.validation.max ?? '-'})`
        : '';
      console.log(
        `    ${req} ${field.name}: ${field.type}${ref}${enumValues}${val}`,
      );
    }

    // Permissions
    if (r.resource.permissions) {
      console.log(`    Permissions:`);
      for (const [action, roles] of Object.entries(r.resource.permissions)) {
        if (action !== 'rowLevel' && action !== 'fields') {
          console.log(
            `      ${action}: ${Array.isArray(roles) ? roles.join(', ') : roles}`,
          );
        }
      }
      if (r.resource.permissions.rowLevel) {
        console.log(
          `      rowLevel: ${Object.keys(r.resource.permissions.rowLevel).join(', ')}`,
        );
      }
    }

    // Hooks
    if (r.resource.hooks && Object.keys(r.resource.hooks).length > 0) {
      console.log(
        `    Hooks: ${Object.entries(r.resource.hooks)
          .map(([t, n]) => `${t}=${n}`)
          .join(', ')}`,
      );
    }

    // Actions
    if (r.resource.actions && r.resource.actions.length > 0) {
      console.log(
        `    Actions: ${r.resource.actions.map((a) => `${a.method} ${a.path}`).join(', ')}`,
      );
    }

    // Jobs
    if (r.resource.jobs && r.resource.jobs.length > 0) {
      console.log(
        `    Jobs: ${r.resource.jobs.map((j) => `${j.name} (${j.type}: ${j.schedule})`).join(', ')}`,
      );
    }

    // Notifications
    if (r.resource.notifications && r.resource.notifications.length > 0) {
      console.log(
        `    Notifications: ${r.resource.notifications.map((n) => `${n.name} (${n.trigger} → ${n.channel})`).join(', ')}`,
      );
    }

    // Seeds
    if (r.resource.seeds && r.resource.seeds.length > 0) {
      console.log(`    Seeds: ${r.resource.seeds.length} entries`);
    }
  }
}

process.exit(errors.length > 0 ? 1 : 0);
