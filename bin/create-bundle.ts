#!/usr/bin/env -S npx tsx

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import * as os from 'os';

// ─── Paths ──────────────────────────────────────────────────────────────────
const ROOT = process.cwd();
const EXTENSIONS_DIR = path.join(ROOT, 'apps', 'back', 'src', 'extensions');
const FRONTEND_MODULES_DIR = path.join(ROOT, 'apps', 'front', 'modules');
const DIST_DIR = path.join(ROOT, 'dist');

// ─── Types ──────────────────────────────────────────────────────────────────

interface ExtensionMeta {
  name: string;
  version: string;
  parent: string | null;
  dirName: string;
  hasManifest: boolean;
}

interface BundleEntry {
  meta: ExtensionMeta;
  children: BundleEntry[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function ok(msg: string): void {
  console.log(`  ✅ ${msg}`);
}

function warn(msg: string): void {
  console.log(`  ⚠️  ${msg}`);
}

function fail(msg: string): void {
  console.log(`  ❌ ${msg}`);
  process.exit(1);
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyDir(src: string, dest: string): void {
  if (!fs.existsSync(src)) return;
  fs.cpSync(src, dest, { recursive: true });
}

// ─── ZIP Creation (reused from build-extension.js) ──────────────────────────

function createZip(zipPath: string, sourceDir: string): void {
  if (process.platform === 'win32') {
    execSync(
      `powershell -Command "Compress-Archive -Path '${sourceDir}\\*' -DestinationPath '${zipPath}' -Force"`,
      { stdio: 'inherit' },
    );
  } else {
    execSync(`cd "${sourceDir}" && zip -r "${zipPath}" .`, {
      stdio: 'inherit',
    });
  }
}

// ─── Manifest Parsing ───────────────────────────────────────────────────────

function parseManifest(extPath: string): ExtensionMeta | null {
  const manifestPath = path.join(extPath, 'extension.manifest.ts');
  if (!fs.existsSync(manifestPath)) {
    const dirName = path.basename(extPath);
    return {
      name: dirName,
      version: '?',
      parent: null,
      dirName,
      hasManifest: false,
    };
  }

  const content = fs.readFileSync(manifestPath, 'utf-8');
  const nameMatch = content.match(/name:\s*['"]([^'"]+)['"]/);
  const versionMatch = content.match(/version:\s*['"]([^'"]+)['"]/);
  const parentMatch = content.match(/parent:\s*['"]([^'"]+)['"]/);

  if (!nameMatch) {
    return null;
  }

  return {
    name: nameMatch[1],
    version: versionMatch?.[1] ?? '0.0.0',
    parent: parentMatch?.[1] ?? null,
    dirName: path.basename(extPath),
    hasManifest: true,
  };
}

// ─── Extension Discovery ────────────────────────────────────────────────────

function getAllExtensions(): Map<string, ExtensionMeta> {
  const result = new Map<string, ExtensionMeta>();

  if (!fs.existsSync(EXTENSIONS_DIR)) {
    return result;
  }

  const dirs = fs
    .readdirSync(EXTENSIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory());

  for (const d of dirs) {
    const extPath = path.join(EXTENSIONS_DIR, d.name);
    const meta = parseManifest(extPath);
    if (meta) {
      result.set(meta.name, meta);
    }
  }

  return result;
}

// ─── Child Resolution ───────────────────────────────────────────────────────

function findChildren(
  parentName: string,
  allExtensions: Map<string, ExtensionMeta>,
  visited: Set<string> = new Set(),
): ExtensionMeta[] {
  if (visited.has(parentName)) {
    warn(`Circular reference detected for: ${parentName}`);
    return [];
  }

  const newVisited = new Set(visited);
  newVisited.add(parentName);

  const directChildren: ExtensionMeta[] = [];

  for (const [, meta] of allExtensions) {
    if (meta.parent === parentName) {
      directChildren.push(meta);
    }
  }

  // Sort alphabetically
  directChildren.sort((a, b) => a.name.localeCompare(b.name));

  return directChildren;
}

function collectAllChildren(
  parentName: string,
  allExtensions: Map<string, ExtensionMeta>,
  visited: Set<string> = new Set(),
): ExtensionMeta[] {
  const results: ExtensionMeta[] = [];

  const direct = findChildren(parentName, allExtensions, visited);
  for (const child of direct) {
    results.push(child);
    const newVisited = new Set(visited);
    newVisited.add(parentName);
    const grandchildren = collectAllChildren(child.name, allExtensions, newVisited);
    results.push(...grandchildren);
  }

  return results;
}

// ─── Bundle Building ────────────────────────────────────────────────────────

function buildBundle(
  extName: string,
  parentMeta: ExtensionMeta,
  allExtensions: Map<string, ExtensionMeta>,
): string {
  const children = collectAllChildren(extName, allExtensions);
  const totalExtensions = 1 + children.length;

  console.log(`\n📦 Building bundle: ${extName}${children.length > 0 ? ` + ${children.length} child${children.length !== 1 ? 'ren' : ''}` : ''}\n`);

  // Create temp directory
  const tmpDir = fs.mkdtempSync(
    path.join(os.tmpdir(), `bundle-${extName}-`),
  );
  ensureDir(tmpDir);

  // Copy parent
  ok(`${parentMeta.name} (v${parentMeta.version}) — parent`);
  copyExtensionToBundle(parentMeta, tmpDir, 'parent');

  // Copy children
  for (const child of children) {
    ok(`${child.name} (v${child.version}) — child`);
    copyExtensionToBundle(child, tmpDir, 'child');
  }

  // Create bundle.json metadata
  const bundleMeta = {
    name: parentMeta.name,
    version: parentMeta.version,
    createdAt: new Date().toISOString(),
    parent: {
      name: parentMeta.name,
      version: parentMeta.version,
      dirName: parentMeta.dirName,
    },
    children: children.map((c) => ({
      name: c.name,
      version: c.version,
      dirName: c.dirName,
    })),
  };

  fs.writeFileSync(
    path.join(tmpDir, 'bundle.json'),
    JSON.stringify(bundleMeta, null, 2),
  );
  ok('bundle.json');

  // Package as ZIP
  ensureDir(DIST_DIR);
  const zipPath = path.join(
    DIST_DIR,
    `${extName}-bundle-v${parentMeta.version}.zip`,
  );
  createZip(zipPath, tmpDir);

  // Clean temp dir
  fs.rmSync(tmpDir, { recursive: true, force: true });

  console.log(`\n✅ Bundle created: ${path.relative(ROOT, zipPath)}\n`);

  return zipPath;
}

function copyExtensionToBundle(
  meta: ExtensionMeta,
  tmpDir: string,
  _role: string,
): void {
  const extDir = path.join(tmpDir, meta.name);
  ensureDir(extDir);

  // Copy manifest
  const manifestSrc = path.join(
    EXTENSIONS_DIR,
    meta.dirName,
    'extension.manifest.ts',
  );
  if (fs.existsSync(manifestSrc)) {
    fs.copyFileSync(manifestSrc, path.join(extDir, 'extension.manifest.ts'));
  }

  // Copy backend
  const backendSrc = path.join(EXTENSIONS_DIR, meta.dirName);
  if (fs.existsSync(backendSrc)) {
    const backendDest = path.join(extDir, 'backend');
    ensureDir(backendDest);
    copyDir(backendSrc, backendDest);
  }

  // Copy frontend
  const frontendSrc = path.join(FRONTEND_MODULES_DIR, meta.name);
  if (fs.existsSync(frontendSrc)) {
    const frontendDest = path.join(extDir, 'frontend');
    ensureDir(frontendDest);
    copyDir(frontendSrc, frontendDest);
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main(): void {
  const extName = process.argv[2];

  if (!extName) {
    fail(
      'Usage: node bin/create-bundle.ts <extension-name>\n\n  Bundles an extension and all its child extensions into a single ZIP.\n\n  Example:\n    node bin/create-bundle.ts stripe\n    node bin/create-bundle.ts cms',
    );
  }

  const allExtensions = getAllExtensions();

  // Find the target extension
  const targetExt = allExtensions.get(extName);
  if (!targetExt) {
    // Try by dir name too
    let found: ExtensionMeta | undefined;
    for (const [, meta] of allExtensions) {
      if (meta.dirName === extName) {
        found = meta;
        break;
      }
    }

    if (!found) {
      fail(
        `Extension not found: ${extName}\n\nInstalled extensions: ${[...allExtensions.keys()].join(', ') || 'none'}`,
      );
    }

    buildBundle(found.name, found, allExtensions);
    return;
  }

  buildBundle(extName, targetExt, allExtensions);
}

main();
