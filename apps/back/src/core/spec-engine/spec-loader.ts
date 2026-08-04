/**
 * SpecLoader — reads .spec.yaml files from extensions/ directory
 *
 * Scans extensions dir for .spec.yaml files and parses them into ExtensionSpec objects.
 *
 * spec-engine-v2: supports split-spec files. The loader globs `*.spec.yaml`
 * in each extension root AND its immediate subdirectories (depth ≤ 1), skips
 * `node_modules`, `dist`, and hidden (dot-prefixed) directories, and merges all
 * files belonging to the same extension into a single in-memory ExtensionSpec
 * via `mergeSpecs`. A single root `*.spec.yaml` (monolith) continues to load
 * unchanged when no split files are present. When both a monolith and split
 * files exist, the split files are merged on top of the monolith (duplicate
 * resource name across files is a hard error — see `SpecMergeError`).
 */

import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import type { ExtensionSpec, ResourceSpec } from './spec.types';
import { mergeSpecs, SpecMergeError } from './spec-loader.merge';

const logger = new Logger('SpecLoader');

/** Directories that are never traversed when globbing for spec files. */
const SKIP_DIR_NAMES = new Set(['node_modules', 'dist']);

export interface LoadedSpec {
  spec: ExtensionSpec;
  dir: string; // absolute path to extension directory
  specPath: string; // absolute path to the primary .spec.yaml file (monolith or first split)
}

export class SpecLoader {
  /**
   * Scan extensions/ for *.spec.yaml files.
   *
   * For each extension directory:
   *   1. Find all `*.spec.yaml` in the extension root (non-recursive).
   *   2. Find all `*.spec.yaml` in immediate subdirectories (depth ≤ 1),
   *      skipping `node_modules`, `dist`, and hidden (dot-prefixed) dirs.
   *   3. If only one root file exists and no subdir files exist → load it as
   *      a monolith (backward compatible, byte-identical shape).
   *   4. Otherwise → parse every file and `mergeSpecs` them into one
   *      ExtensionSpec. Duplicate resource/view names across files throw
   *      `SpecMergeError`.
   */
  static load(extensionsDir: string): LoadedSpec[] {
    if (!fs.existsSync(extensionsDir)) {
      return [];
    }

    const results: LoadedSpec[] = [];
    const dirs = fs.readdirSync(extensionsDir, { withFileTypes: true });

    for (const dir of dirs) {
      if (!dir.isDirectory()) continue;

      const extDir = path.join(extensionsDir, dir.name);
      const rootFiles = this.findRootSpecFiles(extDir);
      const subdirFiles = this.findSubdirSpecFiles(extDir);

      // Backward-compatible path: single root file, no subdir files.
      if (rootFiles.length === 1 && subdirFiles.length === 0) {
        const specFile = rootFiles[0];
        const loaded = this.parseFile(specFile, extDir);
        if (loaded) {
          results.push(loaded);
        }
        continue;
      }

      // No files at all → skip.
      if (rootFiles.length === 0 && subdirFiles.length === 0) {
        continue;
      }

      // Split-spec path: parse every file and merge.
      // Root files come first (monolith baseline), then subdir files.
      const allFiles = [...rootFiles, ...subdirFiles];
      const parsed: ExtensionSpec[] = [];
      let primaryPath = rootFiles[0] ?? allFiles[0];

      for (const specFile of allFiles) {
        try {
          const raw = fs.readFileSync(specFile, 'utf-8');
          const spec = yaml.load(raw) as ExtensionSpec;
          if (!spec || !spec.name || !Array.isArray(spec.resources)) {
            logger.warn(
              `⚠️  Invalid spec in ${specFile}: missing name or resources`,
            );
            continue;
          }
          parsed.push(spec);
          if (primaryPath === undefined) {
            primaryPath = specFile;
          }
        } catch (err) {
          logger.error(
            `❌ Failed to parse ${specFile}: ${(err as Error).message}`,
          );
        }
      }

      if (parsed.length === 0) {
        continue;
      }

      try {
        const merged = mergeSpecs(parsed);
        results.push({
          spec: merged,
          dir: extDir,
          specPath: primaryPath,
        });
        logger.log(
          `📖 Loaded spec: ${merged.name} (${merged.resources.length} resources from ${parsed.length} file${parsed.length === 1 ? '' : 's'})`,
        );
      } catch (err) {
        if (err instanceof SpecMergeError) {
          logger.error(
            `❌ Merge conflict in extension "${dir.name}": ${(err as Error).message}`,
          );
          throw err;
        }
        throw err;
      }
    }

    return results;
  }

  /**
   * Find all *.spec.yaml files in the extension root (non-recursive).
   */
  private static findRootSpecFiles(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];

    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isFile() && d.name.endsWith('.spec.yaml'))
      .map((d) => path.join(dir, d.name));
  }

  /**
   * Find all *.spec.yaml files in immediate subdirectories (depth ≤ 1).
   * Skips `node_modules`, `dist`, and hidden (dot-prefixed) directories.
   * Does NOT recurse beyond depth 1.
   */
  private static findSubdirSpecFiles(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];

    const out: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      // Skip node_modules, dist, and hidden (dot-prefixed) directories.
      if (SKIP_DIR_NAMES.has(entry.name)) continue;
      if (entry.name.startsWith('.')) continue;

      const subdir = path.join(dir, entry.name);
      // Non-recursive: only files directly inside this subdir.
      const subEntries = fs.readdirSync(subdir, { withFileTypes: true });
      for (const subEntry of subEntries) {
        if (subEntry.isFile() && subEntry.name.endsWith('.spec.yaml')) {
          out.push(path.join(subdir, subEntry.name));
        }
      }
    }

    return out;
  }

  /**
   * Parse a single spec file. Returns null on invalid spec (warns).
   */
  private static parseFile(
    specFile: string,
    extDir: string,
  ): LoadedSpec | null {
    try {
      const raw = fs.readFileSync(specFile, 'utf-8');
      const parsed = yaml.load(raw) as ExtensionSpec;

      if (!parsed || !parsed.name || !Array.isArray(parsed.resources)) {
        logger.warn(
          `⚠️  Invalid spec in ${specFile}: missing name or resources`,
        );
        return null;
      }

      logger.log(
        `📖 Loaded spec: ${parsed.name} (${parsed.resources.length} resources)`,
      );
      return {
        spec: parsed,
        dir: extDir,
        specPath: specFile,
      };
    } catch (err) {
      logger.error(`❌ Failed to parse ${specFile}: ${(err as Error).message}`);
      return null;
    }
  }

  /**
   * Validate a resource spec for common errors
   */
  static validateResource(
    spec: ResourceSpec,
    allResources: Map<string, ResourceSpec>,
  ): string[] {
    const errors: string[] = [];

    if (!spec.name) errors.push('Resource missing name');
    if (!spec.table) errors.push(`Resource ${spec.name} missing table`);
    if (!spec.fields || spec.fields.length === 0)
      errors.push(`Resource ${spec.name} has no fields`);

    for (const field of spec.fields || []) {
      if (field.type === 'ref' && !field.ref) {
        errors.push(`Field ${field.name} is type ref but has no ref target`);
      }
      if (field.type === 'enum' && (!field.enum || field.enum.length === 0)) {
        errors.push(`Field ${field.name} is type enum but has no enum values`);
      }
    }

    return errors;
  }
}
