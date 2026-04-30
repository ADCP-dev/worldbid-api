#!/usr/bin/env node
'use strict';

/**
 * add-extension.js — Installs a Foundation extension from a ZIP or local source.
 *
 * Usage:
 *   node bin/add-extension.js <extension-name> [zip-path]
 *
 * Examples:
 *   node bin/add-extension.js blog ./downloads/blog-v1.0.0.zip
 *   node bin/add-extension.js cms   # extension already in extensions/cms/
 *
 * Flow:
 *   1. Extract ZIP (if provided) or use local extensions/<name>/ dir
 *   2. Read & validate extension.manifest.ts
 *   3. Check extension dependencies
 *   4. Copy backend/ → apps/back/src/extensions/<name>/
 *   5. Copy frontend/ → apps/front/modules/<name>/
 *   6. Generate migration (Add<Name>Extension)
 *   7. Run seeds if present
 *   8. Update apps/front/nuxt.config.ts
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

// ─── Paths ──────────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, '..');
const EXT_SRC_DIR = path.join(ROOT, 'extensions');
const BACK_EXTENSIONS = path.join(ROOT, 'apps', 'back', 'src', 'extensions');
const FRONT_MODULES = path.join(ROOT, 'apps', 'front', 'modules');
const BACK_WORKDIR = path.join(ROOT, 'apps', 'back');
const NUXT_CONFIG = path.join(ROOT, 'apps', 'front', 'nuxt.config.ts');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Load extension manifest from a directory.
 * Reads extension.manifest.ts and extracts fields via regex.
 * Returns { name, version, dependencies } or exits on error.
 */
function loadManifest(extPath) {
  const manifestFile = path.join(extPath, 'extension.manifest.ts');

  if (!fs.existsSync(manifestFile)) {
    console.error('❌ extension.manifest.ts not found in ' + extPath);
    process.exit(1);
  }

  const content = fs.readFileSync(manifestFile, 'utf-8');

  // Extract scalar fields: name, version
  const nameMatch = content.match(/\bname:\s*['"]([^'"]+)['"]/);
  const versionMatch = content.match(/\bversion:\s*['"]([^'"]+)['"]/);

  // Extract dependencies.extensions array
  let extensionDeps = [];
  const depsSection = content.match(
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
 * Scan installed extensions in apps/back/src/extensions/.
 * Returns Map<name, manifest>.
 */
function getInstalledExtensions() {
  const installed = new Map();

  if (!fs.existsSync(BACK_EXTENSIONS)) {
    return installed;
  }

  const dirs = fs.readdirSync(BACK_EXTENSIONS, { withFileTypes: true });
  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    const manifestPath = path.join(BACK_EXTENSIONS, dir.name, 'extension.manifest.ts');
    if (fs.existsSync(manifestPath)) {
      // Use a lighter version of loadManifest that doesn't exit on missing
      try {
        const content = fs.readFileSync(manifestPath, 'utf-8');
        const n = content.match(/\bname:\s*['"]([^'"]+)['"]/);
        const v = content.match(/\bversion:\s*['"]([^'"]+)['"]/);
        installed.set(dir.name, { name: n ? n[1] : dir.name, version: v ? v[1] : null });
      } catch {
        installed.set(dir.name, { name: dir.name, version: null });
      }
    } else {
      installed.set(dir.name, { name: dir.name, version: null });
    }
  }

  return installed;
}

/**
 * Returns list of declared extension dependencies that are NOT installed.
 */
function checkDependencies(manifest, installed) {
  const deps = (manifest.dependencies && manifest.dependencies.extensions) || [];
  return deps.filter(function (dep) { return !installed.has(dep); });
}

/**
 * Add or remove a module entry from apps/front/nuxt.config.ts.
 */
function updateNuxtExtends(action, moduleName) {
  var content = fs.readFileSync(NUXT_CONFIG, 'utf-8');
  const entry = "'./modules/" + moduleName + "'";

  if (action === 'add') {
    // Already exists?
    if (content.indexOf(entry) !== -1) {
      console.log('→ ' + entry + ' already in nuxt.config.ts extends');
      return;
    }

    // Add to extends array
    content = content.replace(
      /(extends:\s*\[)([^\]]*)(\])/,
      function (match, open, inner, close) {
        var trimmed = inner.trim();
        if (trimmed.length === 0) return open + ' ' + entry + ' ' + close;
        if (!trimmed.endsWith(',')) {
          return open + inner + ', ' + entry + close;
        }
        return open + inner + ' ' + entry + close;
      },
    );

    // Also add alias
    var aliasEntry = "'@" + moduleName + "': '~/modules/" + moduleName + "'";
    if (content.indexOf(aliasEntry) === -1) {
      content = content.replace(
        /(alias:\s*\{)([^}]*)(\})/,
        function (match, open, inner, close) {
          var trimmed = inner.trim();
          if (trimmed.length === 0) {
            return open + '\n    ' + aliasEntry + ',\n  ' + close;
          }
          return open + inner + '\n    ' + aliasEntry + ',' + close;
        },
      );
    }
  }

  fs.writeFileSync(NUXT_CONFIG, content, 'utf-8');
  console.log('✅ nuxt.config.ts updated (' + action + ')');
}

/**
 * Extract a ZIP or tar.gz archive to destDir.
 */
function extractArchive(zipPath, destDir) {
  var ext = path.extname(zipPath).toLowerCase();

  if (ext === '.zip') {
    if (process.platform === 'win32') {
      var absZip = path.resolve(zipPath);
      var absDest = path.resolve(destDir);
      execSync(
        'powershell -NoProfile -Command "Expand-Archive -Path \'' +
          absZip.replace(/'/g, "''") +
          '\' -DestinationPath \'' +
          absDest.replace(/'/g, "''") +
          '\' -Force"',
        { stdio: 'pipe', timeout: 60000 },
      );
    } else {
      execSync('unzip -o "' + zipPath + '" -d "' + destDir + '"', {
        stdio: 'pipe',
        timeout: 60000,
      });
    }
  } else if (ext === '.gz' || ext === '.tgz') {
    execSync('tar -xzf "' + zipPath + '" -C "' + destDir + '"', {
      stdio: 'pipe',
      timeout: 60000,
    });
  } else {
    console.error('❌ Unsupported archive format: ' + ext);
    console.error('   Supported: .zip, .tar.gz, .tgz');
    process.exit(1);
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

/**
 * Run seed scripts from the extension.
 * Returns true if successful or no seeds, false on failure.
 */
function runSeeds(backSrc) {
  var seedsDir = path.join(backSrc, 'seeds');
  if (!fs.existsSync(seedsDir)) {
    console.log('\n🌱 No seeds directory found — skipping');
    return true;
  }

  console.log('\n🌱 Running seeds...');
  try {
    execSync(
      'npx ts-node -r tsconfig-paths/register ./src/infrastructure/database/seeds/run-seed.ts',
      { cwd: BACK_WORKDIR, stdio: 'inherit', timeout: 120000 },
    );
    console.log('✅ Seeds executed');
    return true;
  } catch (err) {
    console.warn('⚠️  Seed execution failed (non-fatal): ' + err.message);
    return false;
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  var args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: node bin/add-extension.js <extension-name> [zip-path]');
    console.error('');
    console.error('  <extension-name>  Name of the extension (e.g., "blog")');
    console.error('  [zip-path]        Optional path to extension ZIP file');
    console.error('');
    process.exit(1);
  }

  var extName = args[0];
  var zipPath = args[1] || null;
  var sourceDir;
  var cleanup = null;

  console.log('');
  console.log('📦 Adding extension: ' + extName);
  console.log('');

  // ── Determine source directory ──────────────────────────────────────────

  if (zipPath) {
    if (!fs.existsSync(zipPath)) {
      console.error('❌ ZIP file not found: ' + zipPath);
      process.exit(1);
    }

    var tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ext-'));
    console.log('📂 Extracting ' + path.basename(zipPath) + '...');

    try {
      extractArchive(zipPath, tempDir);
    } catch (err) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      console.error('❌ Failed to extract archive: ' + err.message);
      process.exit(1);
    }

    // Handle nested top-level directory (common in ZIPs)
    var entries = fs.readdirSync(tempDir);
    if (
      entries.length === 1 &&
      fs.statSync(path.join(tempDir, entries[0])).isDirectory()
    ) {
      sourceDir = path.join(tempDir, entries[0]);
    } else {
      sourceDir = tempDir;
    }

    cleanup = function () {
      fs.rmSync(tempDir, { recursive: true, force: true });
    };
  } else {
    sourceDir = path.join(EXT_SRC_DIR, extName);
    if (!fs.existsSync(sourceDir)) {
      console.error('❌ Extension source not found at ' + sourceDir);
      console.error(
        '   Provide a ZIP path or place the extension in ' +
          path.join(EXT_SRC_DIR, extName) +
          '/',
      );
      console.error(
        '   Expected structure: extension.manifest.ts, backend/, frontend/',
      );
      process.exit(1);
    }
  }

  try {
    // ── Step 1-2: Read and validate manifest ──────────────────────────────
    console.log('🔍 Reading manifest...');
    var manifest = loadManifest(sourceDir);

    if (!manifest.name || !manifest.version) {
      console.error('❌ Invalid manifest: name and version are required');
      process.exit(1);
    }

    if (manifest.name !== extName) {
      console.error(
        '❌ Extension name mismatch: manifest says "' +
          manifest.name +
          '", expected "' +
          extName +
          '"',
      );
      process.exit(1);
    }

    console.log('   Name:    ' + manifest.name);
    console.log('   Version: ' + manifest.version);

    // ── Step 3: Check dependencies ────────────────────────────────────────
    var depList =
      (manifest.dependencies && manifest.dependencies.extensions) || [];
    if (depList.length > 0) {
      var installed = getInstalledExtensions();
      var missing = checkDependencies(manifest, installed);

      if (missing.length > 0) {
        console.error('❌ Missing dependencies: ' + missing.join(', '));
        console.error('   Install required extensions first');
        process.exit(1);
      }
      console.log('   Dependencies: ' + depList.join(', ') + ' ✓');
    } else {
      console.log('   Dependencies: none');
    }

    // ── Step 4: Copy backend ──────────────────────────────────────────────
    var backSrc = path.join(sourceDir, 'backend');
    var backDest = path.join(BACK_EXTENSIONS, extName);

    if (fs.existsSync(backSrc)) {
      if (fs.existsSync(backDest)) {
        console.log(
          '⚠️  Backend directory already exists at apps/back/src/extensions/' +
            extName + '/',
        );
        console.log(
          '   Skipping backend copy (remove first if you want to reinstall)',
        );
      } else {
        fs.mkdirSync(BACK_EXTENSIONS, { recursive: true });
        fs.cpSync(backSrc, backDest, { recursive: true });
        console.log(
          '✅ Backend copied to apps/back/src/extensions/' +
            extName + '/',
        );
      }
    } else {
      console.log('   No backend/ directory found — skipping');
    }

    // ── Step 5: Copy frontend ─────────────────────────────────────────────
    var frontSrc = path.join(sourceDir, 'frontend');
    var frontDest = path.join(FRONT_MODULES, extName);

    if (fs.existsSync(frontSrc)) {
      if (fs.existsSync(frontDest)) {
        console.log(
          '⚠️  Frontend directory already exists at apps/front/modules/' +
            extName + '/',
        );
        console.log(
          '   Skipping frontend copy (remove first if you want to reinstall)',
        );
      } else {
        fs.mkdirSync(FRONT_MODULES, { recursive: true });
        fs.cpSync(frontSrc, frontDest, { recursive: true });
        console.log(
          '✅ Frontend copied to apps/front/modules/' + extName + '/',
        );
      }
    } else {
      console.log('   No frontend/ directory found — skipping');
    }

    // ── Step 6: Generate migration ───────────────────────────────────────
    var capName =
      extName.charAt(0).toUpperCase() + extName.slice(1);
    var migrationName = 'Add' + capName + 'Extension';
    generateMigration(migrationName);

    // ── Step 7: Run seeds ─────────────────────────────────────────────────
    runSeeds(backSrc);

    // ── Step 8: Update nuxt.config.ts ─────────────────────────────────────
    console.log('\n⚙️  Updating nuxt.config.ts...');
    updateNuxtExtends('add', extName);

    // ── Success ───────────────────────────────────────────────────────────
    console.log('');
    console.log(
      '✅ Extension "' + extName + '" v' + manifest.version + ' added successfully!',
    );
    console.log('');
    console.log('📋 Next steps:');
    console.log(
      '  1. Review generated migration in apps/back/src/infrastructure/database/migrations/',
    );
    console.log('  2. Run: cd apps/back && pnpm migration:run');
    console.log('  3. Start the app and verify the extension loads');
    console.log('  4. Create documentation in docs/ if needed');
    console.log('');
  } finally {
    if (cleanup) cleanup();
  }
}

main();
