#!/usr/bin/env node
'use strict';

/**
 * build-core.js — Packages the Foundation core without extensions.
 *
 * Usage:
 *   node bin/build-core.js [version]
 *
 * Output:
 *   dist/foundation-core-v<version>.zip — core without extensions, landing, CMS
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

// ─── Paths ──────────────────────────────────────────────────────────────────
const ROOT = process.cwd();
const DIST_DIR = path.join(ROOT, 'dist');

// Directories/files to EXCLUDE from core build
const EXCLUDES = [
  // Extensions
  'apps/back/src/extensions',
  'apps/front/modules/landing',
  'apps/front/modules/cms',
  // Dev artifacts
  '.git',
  'node_modules',
  'dist',
  '.engram',
  'graphify-out',
  // OS junk
  '.DS_Store',
  'Thumbs.db',
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function log(msg) {
  console.log(`  ${msg}`);
}

function error(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function shouldExclude(relativePath) {
  for (const pattern of EXCLUDES) {
    if (relativePath === pattern || relativePath.startsWith(pattern + path.sep) || relativePath.startsWith(pattern + '/')) {
      return true;
    }
  }
  return false;
}

function copyFiltered(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const src = path.join(srcDir, entry.name);
    const rel = path.relative(ROOT, src);

    if (shouldExclude(rel)) continue;
    if (entry.name.startsWith('.')) continue;

    const dest = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      fs.mkdirSync(dest, { recursive: true });
      copyFiltered(src, dest);
    } else {
      fs.copyFileSync(src, dest);
    }
  }
}

function readPackageVersion() {
  const pkgPath = path.join(ROOT, 'apps', 'back', 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    return pkg.version || '0.0.0';
  }
  return '0.0.0';
}

function createZip(zipPath, sourceDir) {
  if (process.platform === 'win32') {
    execSync(`powershell -Command "Compress-Archive -Path '${sourceDir}\\*' -DestinationPath '${zipPath}' -Force"`, {
      stdio: 'inherit',
    });
  } else {
    execSync(`cd "${sourceDir}" && zip -r "${zipPath}" .`, {
      stdio: 'inherit',
    });
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  const version = process.argv[2] || readPackageVersion();

  console.log(`\n📦 Building Foundation Core v${version}\n`);

  // Create temp build directory
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'core-build-'));
  log(`Temp dir: ${tmpDir}`);

  // Copy all files except excluded directories
  log('Copying project files (excluding extensions, landing, CMS)...');
  copyFiltered(ROOT, tmpDir);

  // Package as ZIP
  ensureDir(DIST_DIR);
  const zipPath = path.join(DIST_DIR, `foundation-core-v${version}.zip`);
  createZip(zipPath, tmpDir);

  // Clean temp dir
  fs.rmSync(tmpDir, { recursive: true, force: true });

  console.log(`\n✅ Core packaged: ${path.relative(ROOT, zipPath)}\n`);
}

main();
