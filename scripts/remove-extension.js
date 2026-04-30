#!/usr/bin/env node
'use strict';

/**
 * remove-extension.js — Uninstalls a Foundation extension.
 *
 * Usage:
 *   node scripts/remove-extension.js <extension-name>
 *
 * Example:
 *   node scripts/remove-extension.js blog
 *
 * Flow:
 *   1. Check extension exists in backend or frontend
 *   2. Read manifest and verify no OTHER extension depends on it
 *   3. Delete apps/back/src/extensions/<name>/
 *   4. Delete apps/front/modules/<name>/
 *   5. Generate migration (Remove<Name>Extension)
 *   6. Remove from apps/front/nuxt.config.ts
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ─── Paths ──────────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, '..');
const BACK_EXTENSIONS = path.join(ROOT, 'apps', 'back', 'src', 'extensions');
const FRONT_MODULES = path.join(ROOT, 'apps', 'front', 'modules');
const BACK_WORKDIR = path.join(ROOT, 'apps', 'back');
const NUXT_CONFIG = path.join(ROOT, 'apps', 'front', 'nuxt.config.ts');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Load an extension manifest from a directory.
 * Returns { name, version, dependencies } or null if no manifest exists.
 */
function loadManifest(extPath) {
  var manifestFile = path.join(extPath, 'extension.manifest.ts');
  if (!fs.existsSync(manifestFile)) return null;

  var content = fs.readFileSync(manifestFile, 'utf-8');

  var nameMatch = content.match(/\bname:\s*['"]([^'"]+)['"]/);
  var versionMatch = content.match(/\bversion:\s*['"]([^'"]+)['"]/);

  var extensionDeps = [];
  var depsSection = content.match(
    /dependencies:\s*\{[^}]*?extensions:\s*\[([^\]]*)\]/s,
  );
  if (depsSection) {
    extensionDeps = depsSection[1]
      .split(',')
      .map(function (s) { return s.trim().replace(/['"]/g, ''); })
      .filter(Boolean);
  }

  return {
    name: nameMatch ? nameMatch[1] : null,
    version: versionMatch ? versionMatch[1] : null,
    dependencies:
      extensionDeps.length > 0 ? { extensions: extensionDeps } : undefined,
  };
}

/**
 * Scan all installed extensions and return Map<name, manifest|null>.
 */
function getInstalledExtensions() {
  var installed = new Map();

  if (!fs.existsSync(BACK_EXTENSIONS)) {
    return installed;
  }

  var dirs = fs.readdirSync(BACK_EXTENSIONS, { withFileTypes: true });
  for (var i = 0; i < dirs.length; i++) {
    var dir = dirs[i];
    if (!dir.isDirectory()) continue;
    var manifest = loadManifest(path.join(BACK_EXTENSIONS, dir.name));
    installed.set(dir.name, manifest || { name: dir.name, version: null });
  }

  return installed;
}

/**
 * Find extensions that depend on extName.
 * Returns array of extension names.
 */
function findDependents(extName, installed) {
  var dependents = [];

  installed.forEach(function (manifest, name) {
    if (!manifest || !manifest.dependencies) return;
    var deps = manifest.dependencies.extensions || [];
    if (deps.indexOf(extName) !== -1) {
      dependents.push(name);
    }
  });

  return dependents;
}

/**
 * Remove a module entry from apps/front/nuxt.config.ts.
 * Removes from extends array and alias map.
 */
function updateNuxtExtends(moduleName) {
  var content = fs.readFileSync(NUXT_CONFIG, 'utf-8');
  var original = content;

  // ── Remove from extends array ──────────────────────────────────────────
  content = content.replace(
    /(extends:\s*\[)([^\]]*)(\])/,
    function (match, open, inner, close) {
      var entries = inner
        .split(',')
        .map(function (s) { return s.trim(); })
        .filter(Boolean);
      var filtered = entries.filter(function (e) {
        return e.indexOf("'./modules/" + moduleName + "'") === -1 &&
               e.indexOf('"./modules/' + moduleName + '"') === -1;
      });

      if (filtered.length === entries.length) {
        console.log('→ Entry not found in extends array');
        return match;
      }

      return open + ' ' + filtered.join(', ') + ' ' + close;
    },
  );

  // ── Remove alias ───────────────────────────────────────────────────────
  content = content.replace(
    /(alias:\s*\{)([^}]*)(\})/,
    function (match, open, inner, close) {
      var entries = inner
        .split(',')
        .map(function (s) { return s.trim(); })
        .filter(Boolean);
      var filtered = entries.filter(function (e) {
        return e.indexOf("'@" + moduleName + "'") === -1 &&
               e.indexOf('"@' + moduleName + '"') === -1;
      });

      if (filtered.length === entries.length) return match;
      if (filtered.length === 0) return ''; // Remove empty alias block

      return open + '\n    ' + filtered.join(',\n    ') + ',\n  ' + close;
    },
  );

  if (content !== original) {
    fs.writeFileSync(NUXT_CONFIG, content, 'utf-8');
    console.log('✅ nuxt.config.ts updated (remove)');
  } else {
    console.log('→ No changes needed in nuxt.config.ts');
  }
}

/**
 * Generate a TypeORM migration.
 * Returns true if successful, false on failure (non-fatal).
 */
function generateMigration(migrationName) {
  console.log('\n🗄️  Generating migration: ' + migrationName + '...');

  try {
    execSync(
      'npx env-cmd -f .env ts-node --project tsconfig.json -r tsconfig-paths/register ./node_modules/typeorm/cli.js' +
        ' --dataSource=src/infrastructure/database/data-source.ts' +
        ' migration:generate src/infrastructure/database/migrations/' +
        migrationName,
      { cwd: BACK_WORKDIR, stdio: 'inherit', timeout: 120000 },
    );
    console.log('✅ Migration generated: ' + migrationName);
    return true;
  } catch (err) {
    console.warn('⚠️  Migration generation failed (non-fatal): ' + err.message);
    console.warn(
      '   You can generate it manually with: pnpm migration:generate ' +
        migrationName,
    );
    return false;
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  var args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: node scripts/remove-extension.js <extension-name>');
    console.error('');
    console.error('  <extension-name>  Name of the extension (e.g., "blog")');
    console.error('');
    process.exit(1);
  }

  var extName = args[0];

  console.log('');
  console.log('🗑️  Removing extension: ' + extName);
  console.log('');

  // ── Step 1: Check if extension exists ──────────────────────────────────
  var backPath = path.join(BACK_EXTENSIONS, extName);
  var frontPath = path.join(FRONT_MODULES, extName);
  var backExists = fs.existsSync(backPath);
  var frontExists = fs.existsSync(frontPath);

  if (!backExists && !frontExists) {
    console.error('❌ Extension "' + extName + '" not found');
    console.error('   Checked:');
    console.error('   - ' + backPath);
    console.error('   - ' + frontPath);
    process.exit(1);
  }

  // ── Step 2: Check for dependents ───────────────────────────────────────
  var installed = getInstalledExtensions();
  var dependents = findDependents(extName, installed);

  if (dependents.length > 0) {
    console.error(
      '❌ Cannot remove "' + extName + '": other extensions depend on it',
    );
    for (var d = 0; d < dependents.length; d++) {
      console.error('   - "' + dependents[d] + '" depends on this extension');
    }
    console.error('   Remove dependent extensions first');
    process.exit(1);
  }

  // ── Step 3: Delete backend ─────────────────────────────────────────────
  if (backExists) {
    fs.rmSync(backPath, { recursive: true, force: true });
    console.log('✅ Deleted apps/back/src/extensions/' + extName + '/');
  } else {
    console.log('→ No backend extension found — skipping');
  }

  // ── Step 4: Delete frontend ────────────────────────────────────────────
  if (frontExists) {
    fs.rmSync(frontPath, { recursive: true, force: true });
    console.log('✅ Deleted apps/front/modules/' + extName + '/');
  } else {
    console.log('→ No frontend module found — skipping');
  }

  // ── Step 5: Generate migration ─────────────────────────────────────────
  var capName = extName.charAt(0).toUpperCase() + extName.slice(1);
  var migrationName = 'Remove' + capName + 'Extension';
  generateMigration(migrationName);

  // ── Step 6: Update nuxt.config.ts ──────────────────────────────────────
  console.log('\n⚙️  Updating nuxt.config.ts...');
  updateNuxtExtends(extName);

  // ── Success ────────────────────────────────────────────────────────────
  console.log('');
  console.log('✅ Extension "' + extName + '" removed successfully!');
  console.log('');
  console.log('📋 Next steps:');
  console.log(
    '  1. Review generated migration in apps/back/src/infrastructure/database/migrations/',
  );
  console.log('  2. Run: cd apps/back && pnpm migration:run');
  console.log('  3. Start the app and verify everything works');
  console.log('');
}

main();
