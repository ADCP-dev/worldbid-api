#!/usr/bin/env node
'use strict';

/**
 * validate-extension.js — Validates a Foundation extension against all rules.
 *
 * Usage:
 *   node bin/validate-extension.js <extension-name>
 *
 * Validates:
 *   a) Manifest exists and has required fields
 *   b) Module entry (extension.module.ts)
 *   c) Table naming convention (ext_<name>_ prefix)
 *   d) Frontend counterpart (nuxt.config.ts)
 *   e) Route conflicts with other extensions
 *   f) Table conflicts with other extensions
 *   g) Dependencies satisfied
 *   h) Seeds structure (if present)
 *   i) Migration:generate entity discovery
 *
 * Exit: 0 if all pass, 1 if any errors
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ─── Paths ──────────────────────────────────────────────────────────────────
const ROOT = process.cwd();
const EXTENSIONS_DIR = path.join(ROOT, 'apps', 'back', 'src', 'extensions');
const FRONTEND_MODULES_DIR = path.join(ROOT, 'apps', 'front', 'modules');
const DATA_SOURCE_PATH = path.join(
  ROOT,
  'apps',
  'back',
  'src',
  'infrastructure',
  'database',
  'data-source.ts',
);

// ─── State ──────────────────────────────────────────────────────────────────
const errors = [];
const warnings = [];

// ─── Helpers ────────────────────────────────────────────────────────────────

function ok(msg) {
  console.log(`  ✅ ${msg}`);
}

function warn(msg) {
  console.log(`  ⚠️  ${msg}`);
  warnings.push(msg);
}

function fail(msg) {
  console.log(`  ❌ ${msg}`);
  errors.push(msg);
}

function getInstalledExtensions() {
  const result = new Map();
  if (!fs.existsSync(EXTENSIONS_DIR)) return result;

  const dirs = fs.readdirSync(EXTENSIONS_DIR, { withFileTypes: true }).filter((d) => d.isDirectory());

  for (const dir of dirs) {
    const manifestPath = path.join(EXTENSIONS_DIR, dir.name, 'extension.manifest.ts');
    if (!fs.existsSync(manifestPath)) continue;

    try {
      const content = fs.readFileSync(manifestPath, 'utf-8');
      const name = content.match(/name:\s*['"]([^'"]+)['"]/)?.[1];
      const version = content.match(/version:\s*['"]([^'"]+)['"]/)?.[1];
      const routesMatch = content.match(/routes:\s*\[([\s\S]*?)\]/);
      const entitiesMatch = content.match(/entities:\s*\[([\s\S]*?)\]/);
      const depsMatch = content.match(/dependencies:\s*\{[\s\S]*?extensions:\s*\[([\s\S]*?)\]/);

      const routes = [];
      if (routesMatch) {
        const methodMatches = routesMatch[1].matchAll(/method:\s*['"]([^'"]+)['"],\s*path:\s*['"]([^'"]+)['"]/g);
        for (const m of methodMatches) {
          routes.push({ method: m[1], path: m[2] });
        }
      }

      const entities = [];
      if (entitiesMatch) {
        const tableMatches = entitiesMatch[1].matchAll(/table:\s*['"]([^'"]+)['"]/g);
        for (const m of tableMatches) {
          entities.push(m[1]);
        }
      }

      const deps = [];
      if (depsMatch) {
        const depMatches = depsMatch[1].matchAll(/['"]([^'"]+)['"]/g);
        for (const m of depMatches) {
          deps.push(m[1]);
        }
      }

      result.set(dir.name, { name, version, routes, entities, deps });
    } catch {
      // skip broken manifests
    }
  }

  return result;
}

function scanEntityTables(extPath) {
  const tables = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('.entity.ts')) {
        const content = fs.readFileSync(full, 'utf-8');
        // Match @Entity('table_name') or @Entity({ name: 'table_name' })
        const match =
          content.match(/@Entity\s*\(\s*['"]([^'"]+)['"]/) ||
          content.match(/@Entity\s*\(\s*\{\s*name:\s*['"]([^'"]+)['"]/);
        if (match) {
          tables.push({ file: path.relative(extPath, full), table: match[1] });
        }
      }
    }
  };
  walk(extPath);
  return tables;
}

function checkMigrationGlob() {
  if (!fs.existsSync(DATA_SOURCE_PATH)) {
    warn(`data-source.ts not found at expected path: ${path.relative(ROOT, DATA_SOURCE_PATH)}`);
    return;
  }

  const content = fs.readFileSync(DATA_SOURCE_PATH, 'utf-8');
  // globs like src/**/* or src/**/*.entity cover extensions/ via **
  if (content.includes('extensions') || content.match(/src\/\*\*\/\*\.entity/)) {
    ok(`data-source.ts entity glob covers extensions/ directory`);
  } else {
    warn(`data-source.ts entity glob may not cover extensions/ — check manually`);
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  const extName = process.argv[2];
  if (!extName) {
    console.error('Usage: node bin/validate-extension.js <extension-name>');
    process.exit(1);
  }

  const extPath = path.join(EXTENSIONS_DIR, extName);
  const manifestPath = path.join(extPath, 'extension.manifest.ts');
  const modulePath = path.join(extPath, 'extension.module.ts');
  const frontendPath = path.join(FRONTEND_MODULES_DIR, extName);
  const seedsPath = path.join(extPath, 'seeds');

  console.log(`\n🔍 Validating extension: ${extName}\n`);

  // a) Manifest exists
  if (!fs.existsSync(manifestPath)) {
    fail('Manifest not found (extension.manifest.ts)');
  } else {
    ok('Manifest exists');

    // b) Required fields
    const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
    const nameMatch = manifestContent.match(/name:\s*['"]([^'"]+)['"]/);
    const versionMatch = manifestContent.match(/version:\s*['"]([^'"]+)['"]/);

    if (!nameMatch) {
      fail("Missing required field: name");
    } else if (nameMatch[1] !== extName) {
      fail(`Name mismatch: manifest says "${nameMatch[1]}" but directory is "${extName}"`);
    } else {
      ok(`Required fields (name: ${nameMatch[1]}, version: ${versionMatch?.[1] || '?'})`);
    }

    if (!versionMatch) {
      warn('Missing recommended field: version');
    }
  }

  // c) Module entry
  if (!fs.existsSync(modulePath)) {
    fail('Module entry not found (extension.module.ts)');
  } else {
    ok('Module entry (extension.module.ts)');
  }

  // d) Table naming convention
  if (fs.existsSync(extPath)) {
    const tables = scanEntityTables(extPath);
    if (tables.length === 0) {
      warn('No entities found — may not have database tables');
    } else {
      let tableErrors = 0;
      for (const { file, table } of tables) {
        if (!table.startsWith(`ext_${extName}_`)) {
          fail(`Table naming: '${table}' should be 'ext_${extName}_${table.replace(/^ext_/, '')}' (in ${file})`);
          tableErrors++;
        }
      }
      if (tableErrors === 0) {
        ok(`Table naming: ${tables.length} entity(s) with correct ext_${extName}_ prefix`);
      }
    }
  }

  // e) Frontend counterpart
  if (fs.existsSync(frontendPath)) {
    const frontendNuxt = path.join(frontendPath, 'nuxt.config.ts');
    if (fs.existsSync(frontendNuxt)) {
      ok('Frontend counterpart (nuxt.config.ts)');
    } else {
      warn(`Frontend directory exists but no nuxt.config.ts found`);
    }
  } else {
    warn('No frontend counterpart (modules/<name>/)');
  }

  // f & g) Route and table conflicts
  const installed = getInstalledExtensions();
  const extManifest = installed.get(extName);
  if (extManifest) {
    // Check route conflicts
    let routeConflicts = 0;
    for (const [otherName, other] of installed) {
      if (otherName === extName) continue;
      for (const route of extManifest.routes) {
        const key = `${route.method}:${route.path}`;
        for (const otherRoute of other.routes) {
          if (`${otherRoute.method}:${otherRoute.path}` === key) {
            fail(`Route conflict: ${key} also registered by '${otherName}'`);
            routeConflicts++;
          }
        }
      }
    }
    if (routeConflicts === 0 && extManifest.routes.length > 0) {
      ok(`No route conflicts (${extManifest.routes.length} routes)`);
    }

    // Check table conflicts
    let tableConflicts = 0;
    for (const [otherName, other] of installed) {
      if (otherName === extName) continue;
      for (const table of extManifest.entities) {
        if (other.entities.includes(table)) {
          fail(`Table conflict: '${table}' also used by '${otherName}'`);
          tableConflicts++;
        }
      }
    }
    if (tableConflicts === 0 && extManifest.entities.length > 0) {
      ok(`No table conflicts (${extManifest.entities.length} entities)`);
    }

    // h) Dependencies satisfied
    let missingDeps = 0;
    for (const dep of extManifest.deps) {
      if (!installed.has(dep)) {
        fail(`Missing dependency: '${dep}' (required by '${extName}')`);
        missingDeps++;
      }
    }
    if (missingDeps === 0 && extManifest.deps.length > 0) {
      ok(`Dependencies satisfied (${extManifest.deps.join(', ')})`);
    } else if (extManifest.deps.length === 0) {
      ok('No dependencies declared');
    }
  } else {
    warn('Could not parse manifest for conflict detection');
  }

  // i) Seeds structure
  if (fs.existsSync(seedsPath)) {
    const seedFiles = fs.readdirSync(seedsPath);
    const hasModule = seedFiles.some((f) => f.includes('seed.module'));
    const hasService = seedFiles.some((f) => f.includes('seed.service'));

    if (hasModule && hasService) {
      ok('Seeds structure valid (module + service)');
    } else {
      if (!hasModule) fail('Seeds directory exists but no seed module found (*-seed.module.ts)');
      if (!hasService) fail('Seeds directory exists but no seed service found (*-seed.service.ts)');
    }
  } else {
    warn('No seeds directory');
  }

  // j) Migration:generate entity discovery
  console.log('');
  checkMigrationGlob();

  // ─── Result ───────────────────────────────────────────────────────────────
  console.log('');
  if (errors.length === 0 && warnings.length === 0) {
    console.log(`Result: ✅ PASSED — ${extName} is valid\n`);
    process.exit(0);
  } else if (errors.length === 0) {
    console.log(`Result: ⚠️  PASSED with ${warnings.length} warning(s)\n`);
    process.exit(0);
  } else {
    const w = warnings.length > 0 ? `, ${warnings.length} warning(s)` : '';
    console.log(`Result: ❌ FAILED — ${errors.length} error(s)${w}\n`);
    process.exit(1);
  }
}

main();
