#!/usr/bin/env ts-node
/**
 * spec-list — CLI that lists all loaded spec extensions and their resources.
 *
 * Usage:
 *   pnpm spec:list                      # lists all extensions
 *   pnpm spec:list --json               # machine-readable JSON output
 *
 * Reads the same spec files that the SpecEngineModule loads at runtime,
 * using SpecLoader to honor the split-merge behavior (multiple *.spec.yaml
 * per extension directory merged into one ExtensionSpec).
 */

import path from 'path';
import { SpecLoader } from './spec-loader';

function main(): void {
  const asJson = process.argv.includes('--json');
  const extensionsDir = path.resolve(process.cwd(), 'src/extensions');

  try {
    const specs = SpecLoader.load(extensionsDir);

    if (asJson) {
      const payload = specs.map((s) => ({
        name: s.spec.name,
        displayName: s.spec.displayName,
        version: s.spec.version,
        resources: s.spec.resources.map((r) => ({
          name: r.name,
          table: r.table,
          fields: r.fields.length,
        })),
      }));
      console.log(JSON.stringify(payload, null, 2));
      return;
    }

    if (specs.length === 0) {
      console.log('No spec extensions found in', extensionsDir);
      return;
    }

    for (const loaded of specs) {
      const { spec } = loaded;
      console.log(`\n📦 ${spec.name} (${spec.displayName ?? spec.name})`);
      console.log(`   dir: ${loaded.dir}`);
      console.log(`   resources (${spec.resources.length}):`);
      for (const r of spec.resources) {
        console.log(`     • ${r.name} → table ${r.table} (${r.fields.length} fields)`);
      }
    }
    console.log('');
  } catch (err) {
    console.error(`\n❌ Failed to list specs: ${(err as Error).message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}