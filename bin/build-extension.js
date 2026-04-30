#!/usr/bin/env node
'use strict';

/**
 * build-extension.js — Packages a Foundation extension into a distributable ZIP.
 *
 * Usage:
 *   node bin/build-extension.js <extension-name> [version]
 *
 * Examples:
 *   node bin/build-extension.js blog
 *   node bin/build-extension.js cms 1.2.0
 *
 * Output:
 *   dist/<name>-v<version>.zip containing extension.manifest.ts, backend/, frontend/
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

// ─── Paths ──────────────────────────────────────────────────────────────────
const ROOT = process.cwd();
const EXTENSIONS_DIR = path.join(ROOT, 'apps', 'back', 'src', 'extensions');
const FRONTEND_MODULES_DIR = path.join(ROOT, 'apps', 'front', 'modules');
const DOCS_EXTENSIONS_DIR = path.join(ROOT, 'docs', 'extensions');
const DIST_DIR = path.join(ROOT, 'dist');

// ─── Helpers ────────────────────────────────────────────────────────────────

function log(msg) {
  console.log(`  ${msg}`);
}

function error(msg) {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

function readManifest(extPath) {
  const manifestPath = path.join(extPath, 'extension.manifest.ts');
  if (!fs.existsSync(manifestPath)) {
    error(`Manifest not found: ${manifestPath}`);
  }

  const content = fs.readFileSync(manifestPath, 'utf-8');
  // Extract the manifest object using regex (same approach as add-extension)
  const match = content.match(/=\s*({[\s\S]*?});/);
  if (!match) {
    error(`Could not parse manifest from ${manifestPath}`);
  }

  try {
    // Basic extraction of name and version using regex
    const nameMatch = match[1].match(/name:\s*['"]([^'"]+)['"]/);
    const versionMatch = match[1].match(/version:\s*['"]([^'"]+)['"]/);

    if (!nameMatch || !versionMatch) {
      error(`Manifest missing required 'name' or 'version' fields`);
    }

    return { name: nameMatch[1], version: versionMatch[1] };
  } catch (e) {
    error(`Failed to parse manifest: ${e.message}`);
  }
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.cpSync(src, dest, { recursive: true });
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
  const extName = process.argv[2];
  if (!extName) {
    error('Usage: node bin/build-extension.js <extension-name> [version]');
  }

  const extPath = path.join(EXTENSIONS_DIR, extName);
  if (!fs.existsSync(extPath)) {
    error(`Extension not found: ${extPath}`);
  }

  // Read manifest for version
  const manifest = readManifest(extPath);
  const version = process.argv[3] || manifest.version;

  console.log(`\n📦 Building extension: ${extName} v${version}\n`);

  // Create temp build directory
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `ext-build-${extName}-`));
  log(`Temp dir: ${tmpDir}`);

  // 1. Copy manifest
  const manifestSrc = path.join(extPath, 'extension.manifest.ts');
  if (fs.existsSync(manifestSrc)) {
    fs.copyFileSync(manifestSrc, path.join(tmpDir, 'extension.manifest.ts'));
    log('Copied extension.manifest.ts');
  }

  // 2. Create extension.json (machine-readable)
  const content = fs.readFileSync(manifestSrc, 'utf-8');
  const match = content.match(/=\s*({[\s\S]*?});/);
  if (match) {
    try {
      // Write the manifest object as JSON (wrapped for eval safety)
      const manifestJson = { name: manifest.name, version };
      fs.writeFileSync(
        path.join(tmpDir, 'extension.json'),
        JSON.stringify(manifestJson, null, 2),
      );
      log('Created extension.json');
    } catch { /* skip */ }
  }

  // 3. Copy backend
  const backendDest = path.join(tmpDir, 'backend');
  ensureDir(backendDest);
  copyDir(extPath, backendDest);
  log(`Copied backend/ (${extName})`);

  // 4. Copy frontend
  const frontendSrc = path.join(FRONTEND_MODULES_DIR, extName);
  if (fs.existsSync(frontendSrc)) {
    const frontendDest = path.join(tmpDir, 'frontend');
    ensureDir(frontendDest);
    copyDir(frontendSrc, frontendDest);
    log(`Copied frontend/ (${extName})`);
  }

  // 5. Copy README if exists
  const readmePath = path.join(DOCS_EXTENSIONS_DIR, extName, 'README.md');
  if (fs.existsSync(readmePath)) {
    fs.copyFileSync(readmePath, path.join(tmpDir, 'README.md'));
    log('Copied README.md');
  }

  // 6. Package as ZIP
  ensureDir(DIST_DIR);
  const zipPath = path.join(DIST_DIR, `${extName}-v${version}.zip`);
  createZip(zipPath, tmpDir);

  // Clean temp dir
  fs.rmSync(tmpDir, { recursive: true, force: true });

  console.log(`\n✅ Extension packaged: ${path.relative(ROOT, zipPath)}\n`);
}

main();
