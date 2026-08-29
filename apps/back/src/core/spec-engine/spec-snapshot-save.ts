#!/usr/bin/env ts-node
/**
 * spec-snapshot-save — persists the current spec snapshot to the DB.
 *
 * Run AFTER `pnpm migration:run` so the snapshot reflects what's in the DB.
 * The next `pnpm spec:generate-migration` will diff against this snapshot.
 *
 * Usage:
 *   pnpm spec:snapshot-save <extensionName>
 */

import path from 'path';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import {
  readSpecFile,
  buildFullSnapshot,
  writeSnapshotToDb,
  getDataSource,
} from './migration-generator';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const extensionName = args.find((a) => !a.startsWith('--'));
  if (!extensionName) {
    console.error('Usage: ts-node spec-snapshot-save.ts <extensionName>');
    process.exit(1);
  }

  const extensionsDir = path.resolve(process.cwd(), 'src/extensions');
  const ds = getDataSource();
  await ds.initialize();

  try {
    const spec = readSpecFile(extensionName, extensionsDir);
    const snapshot = buildFullSnapshot(extensionName, spec);
    await writeSnapshotToDb(ds, snapshot);
    console.log(
      `✅ Snapshot saved for "${extensionName}" (version ${snapshot.version}).`,
    );
  } catch (err) {
    console.error(`❌ Failed: ${(err as Error).message}`);
    process.exit(1);
  } finally {
    await ds.destroy();
  }
}

if (require.main === module) {
  main();
}
