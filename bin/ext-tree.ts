#!/usr/bin/env -S npx tsx

import * as fs from 'fs';
import * as path from 'path';

// ─── Paths ──────────────────────────────────────────────────────────────────
const ROOT = process.cwd();
const EXTENSIONS_DIR = path.join(ROOT, 'apps', 'back', 'src', 'extensions');

// ─── Types ──────────────────────────────────────────────────────────────────

interface ExtensionInfo {
  name: string;
  version: string;
  parent: string | null;
  hasManifest: boolean;
  dirName: string;
}

interface TreeNode {
  ext: ExtensionInfo;
  children: TreeNode[];
  missingParent: boolean;
  hasCycle: boolean;
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
}

// ─── Manifest Parsing ───────────────────────────────────────────────────────

function parseManifest(filePath: string): {
  name: string | null;
  version: string | null;
  parent: string | null;
} {
  if (!fs.existsSync(filePath)) {
    return { name: null, version: null, parent: null };
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const nameMatch = content.match(/name:\s*['"]([^'"]+)['"]/);
  const versionMatch = content.match(/version:\s*['"]([^'"]+)['"]/);
  const parentMatch = content.match(/parent:\s*['"]([^'"]+)['"]/);

  return {
    name: nameMatch?.[1] ?? null,
    version: versionMatch?.[1] ?? null,
    parent: parentMatch?.[1] ?? null,
  };
}

// ─── Extension Discovery ────────────────────────────────────────────────────

function scanExtensions(): ExtensionInfo[] {
  if (!fs.existsSync(EXTENSIONS_DIR)) {
    return [];
  }

  const dirs = fs
    .readdirSync(EXTENSIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory());

  return dirs.map((d) => {
    const manifestPath = path.join(EXTENSIONS_DIR, d.name, 'extension.manifest.ts');
    const parsed = parseManifest(manifestPath);

    return {
      name: parsed.name ?? d.name,
      version: parsed.version ?? '?',
      parent: parsed.parent,
      hasManifest: fs.existsSync(manifestPath),
      dirName: d.name,
    };
  });
}

// ─── Tree Building ──────────────────────────────────────────────────────────

function buildTree(extensions: ExtensionInfo[]): {
  roots: TreeNode[];
  cycled: string[];
} {
  const extMap = new Map<string, ExtensionInfo>();
  for (const ext of extensions) {
    extMap.set(ext.name, ext);
  }

  // Detect cycles via DFS
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const cycled = new Set<string>();

  function detectCycle(name: string): boolean {
    if (recursionStack.has(name)) {
      cycled.add(name);
      return true;
    }
    if (visited.has(name)) return false;

    visited.add(name);
    recursionStack.add(name);

    const ext = extMap.get(name);
    if (ext?.parent && extMap.has(ext.parent)) {
      if (detectCycle(ext.parent)) {
        cycled.add(name);
        return true;
      }
    }

    recursionStack.delete(name);
    return false;
  }

  for (const ext of extensions) {
    if (!visited.has(ext.name)) {
      detectCycle(ext.name);
    }
  }

  // Build children groupings
  const childrenMap = new Map<string, ExtensionInfo[]>();
  for (const ext of extensions) {
    if (ext.parent) {
      const key = ext.parent;
      if (!childrenMap.has(key)) {
        childrenMap.set(key, []);
      }
      childrenMap.get(key)!.push(ext);
    }
  }

  // Sort children alphabetically
  for (const [, children] of childrenMap) {
    children.sort((a, b) => a.name.localeCompare(b.name));
  }

  // Recursive node builder
  function buildNode(
    ext: ExtensionInfo,
    ancestorChain: Set<string> = new Set(),
  ): TreeNode {
    const inCycle = cycled.has(ext.name);

    if (ancestorChain.has(ext.name)) {
      return { ext, children: [], missingParent: false, hasCycle: true };
    }

    const newChain = new Set(ancestorChain);
    newChain.add(ext.name);

    const childrenExts = childrenMap.get(ext.name) ?? [];
    const children = childrenExts.map((c) => buildNode(c, newChain));
    const missingParent = ext.parent !== null && !extMap.has(ext.parent);

    return { ext, children, missingParent, hasCycle: inCycle };
  }

  // Roots: extensions with no parent, or parent not installed
  const roots: TreeNode[] = [];
  for (const ext of extensions) {
    if (!ext.parent || !extMap.has(ext.parent)) {
      roots.push(buildNode(ext));
    }
  }

  // Sort roots alphabetically
  roots.sort((a, b) => a.ext.name.localeCompare(b.ext.name));

  return { roots, cycled: [...cycled] };
}

// ─── Tree Printing ──────────────────────────────────────────────────────────

function printTree(
  nodes: TreeNode[],
  prefix: string = '',
  isRoot: boolean = true,
): void {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const isLast = i === nodes.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const childPrefix = prefix + (isLast ? '    ' : '│   ');

    // Build line
    let line = prefix + connector + node.ext.name;
    line += ` (v${node.ext.version})`;

    // Child of someone
    if (node.ext.parent) {
      line += ` [parent: ${node.ext.parent}]`;
    }

    // Warnings
    if (!node.ext.hasManifest) {
      line += ' ⚠️ no manifest';
    }

    if (node.missingParent) {
      line += ` ⚠️ parent not found: ${node.ext.parent}`;
    }

    if (node.hasCycle) {
      line += ` ⚠️ circular parent reference`;
    }

    if (isRoot && !node.ext.parent) {
      line += ' ← orphan (no parent)';
    }

    console.log(line);

    // Print children recursively
    if (node.children.length > 0) {
      printTree(node.children, childPrefix, false);
    }
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main(): void {
  console.log('\n📦 Extension Tree\n');

  const extensions = scanExtensions();

  if (extensions.length === 0) {
    console.log('  No extensions installed.\n');
    process.exit(0);
  }

  const { roots, cycled } = buildTree(extensions);

  if (cycled.length > 0) {
    warn(`Circular parent reference(s) detected: ${cycled.join(', ')}`);
    console.log('');
  }

  printTree(roots);
  console.log('');
}

main();
