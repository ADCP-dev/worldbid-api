#!/usr/bin/env -S npx tsx
'use strict';

/**
 * ext-validate.ts — Validates extension parent relationship metadata.
 *
 * Usage:
 *   npx tsx bin/ext-validate.ts                  # validate ALL extensions
 *   npx tsx bin/ext-validate.ts <extension-name>  # validate specific extension
 *
 * Validates:
 *   a) parent_not_found   — parent declared but extension doesn't exist
 *   b) parent_not_in_deps — parent declared but NOT in dependencies.extensions
 *   c) parent_cycle       — circular parent chain detected
 *
 * Exit: 0 if no errors, 1 if any errors
 */

import * as fs from 'fs';
import * as path from 'path';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ExtensionManifest {
  name: string;
  version?: string;
  parent?: string;
  deps: string[];
}

// ─── Paths ───────────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, '..');
const EXTENSIONS_DIR = path.join(ROOT, 'apps', 'back', 'src', 'extensions');

// ─── State ───────────────────────────────────────────────────────────────────

const errors: string[] = [];
const warnings: string[] = [];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ok(msg: string): void {
  console.log(`  ✅ ${msg}`);
}

function warn(msg: string): void {
  console.log(`  ⚠️  ${msg}`);
  warnings.push(msg);
}

function fail(msg: string): void {
  console.log(`  ❌ ${msg}`);
  errors.push(msg);
}

// ─── Manifest Loading ────────────────────────────────────────────────────────

function loadAllManifests(): Map<string, ExtensionManifest> {
  const result = new Map<string, ExtensionManifest>();

  if (!fs.existsSync(EXTENSIONS_DIR)) {
    return result;
  }

  const dirs = fs
    .readdirSync(EXTENSIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory());

  for (const dir of dirs) {
    const manifestPath = path.join(EXTENSIONS_DIR, dir.name, 'extension.manifest.ts');
    if (!fs.existsSync(manifestPath)) {
      continue;
    }

    try {
      const content = fs.readFileSync(manifestPath, 'utf-8');

      const name = content.match(/name:\s*['"]([^'"]+)['"]/)?.[1];
      if (!name) {
        continue;
      }

      const version = content.match(/version:\s*['"]([^'"]+)['"]/)?.[1];
      const parent = content.match(/parent:\s*['"]([^'"]+)['"]/)?.[1];

      const depsMatch = content.match(
        /dependencies:\s*\{[\s\S]*?extensions:\s*\[([\s\S]*?)\]/,
      );

      const deps: string[] = [];
      if (depsMatch) {
        const depMatches = depsMatch[1].matchAll(/['"]([^'"]+)['"]/g);
        for (const m of depMatches) {
          deps.push(m[1]);
        }
      }

      result.set(dir.name, { name, version, parent, deps });
    } catch {
      // skip broken manifests
    }
  }

  return result;
}

// ─── Cycle Detection ─────────────────────────────────────────────────────────

function detectCycle(
  name: string,
  manifests: Map<string, ExtensionManifest>,
  visited: Set<string> = new Set(),
  chain: string[] = [],
): { cycle: string[] } | null {
  const ext = manifests.get(name);
  if (!ext || !ext.parent) {
    return null;
  }

  const parent = ext.parent;

  if (visited.has(parent)) {
    // Build the cycle chain for the error message
    const cycleStart = chain.indexOf(parent);
    const cycle = chain.slice(cycleStart).concat(parent);
    return { cycle };
  }

  visited.add(parent);
  chain.push(parent);

  const parentExt = manifests.get(parent);
  if (!parentExt) {
    return null; // parent not found — handled separately
  }

  if (!parentExt.parent) {
    return null; // parent has no parent — end of chain
  }

  return detectCycle(parent, manifests, visited, chain);
}

// ─── Validation ──────────────────────────────────────────────────────────────

function validateExtension(
  extDir: string,
  ext: ExtensionManifest,
  manifests: Map<string, ExtensionManifest>,
): void {
  if (!ext.parent) {
    return;
  }

  const parentName = ext.parent;

  // a) parent_not_found — parent declared but extension doesn't exist
  if (!manifests.has(parentName)) {
    fail(`Parent '${parentName}' not found (declared by '${extDir}')`);
  } else {
    ok(`Parent '${parentName}' exists`);

    // b) parent_not_in_deps — parent declared but NOT in dependencies.extensions
    if (!ext.deps.includes(parentName)) {
      fail(
        `Parent '${parentName}' not listed in dependencies.extensions (declared by '${extDir}')`,
      );
    } else {
      ok(`Parent '${parentName}' in dependencies`);
    }
  }

  // c) parent_cycle — circular parent chain detected (only if parent exists)
  if (manifests.has(parentName)) {
    const chain = [extDir, parentName];
    const visited = new Set<string>([extDir, parentName]);

    const cycleResult = detectCycle(parentName, manifests, visited, chain);
    if (cycleResult) {
      const cycleChain = [extDir, ...cycleResult.cycle];
      fail(
        `Parent cycle detected: ${cycleChain.join(' → ')}`,
      );
    }
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main(): void {
  const targetName = process.argv[2];

  if (targetName) {
    console.log(`\n🔍 Validating extension parent relationships: ${targetName}\n`);
  } else {
    console.log(`\n🔍 Validating extension parent relationships: ALL EXTENSIONS\n`);
  }

  const manifests = loadAllManifests();

  if (manifests.size === 0) {
    console.log('  No extensions found.\n');
    process.exit(0);
  }

  const targetList = targetName
    ? (() => {
        const ext = manifests.get(targetName);
        if (!ext) {
          fail(`Extension '${targetName}' not found in extensions directory`);
          return [] as [string, ExtensionManifest][];
        }
        return [[targetName, ext]] as [string, ExtensionManifest][];
      })()
    : [...manifests.entries()];

  for (const [extDir, ext] of targetList) {
    console.log(`\n  ── ${ext.name} (${extDir}) ──`);

    if (!ext.parent) {
      ok('No parent declared');
    }

    validateExtension(extDir, ext, manifests);
  }

  // ─── Result ───────────────────────────────────────────────────────────────
  console.log('');
  if (errors.length === 0 && warnings.length === 0) {
    console.log(`Result: ✅ PASSED — ${manifests.size} extension(s) validated\n`);
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
