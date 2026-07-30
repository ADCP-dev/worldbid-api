/**
 * SpecLoader — reads .spec.yaml files from extensions/ directory
 *
 * Scans extensions dir for .spec.yaml files and parses them into ExtensionSpec objects.
 */

import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import type { ExtensionSpec, ResourceSpec } from './spec.types';

const logger = new Logger('SpecLoader');

export interface LoadedSpec {
  spec: ExtensionSpec;
  dir: string; // absolute path to extension directory
  specPath: string; // absolute path to the .spec.yaml file
}

export class SpecLoader {
  /**
   * Scan extensions/ for *.spec.yaml files
   */
  static load(extensionsDir: string): LoadedSpec[] {
    if (!fs.existsSync(extensionsDir)) {
      return [];
    }

    const results: LoadedSpec[] = [];
    const dirs = fs.readdirSync(extensionsDir, { withFileTypes: true });

    for (const dir of dirs) {
      if (!dir.isDirectory()) continue;

      // Look for any *.spec.yaml in the extension dir (non-recursive)
      const specFiles = this.findSpecFiles(
        path.join(extensionsDir, dir.name),
      );

      for (const specFile of specFiles) {
        try {
          const raw = fs.readFileSync(specFile, 'utf-8');
          const parsed = yaml.load(raw) as ExtensionSpec;

          if (!parsed || !parsed.name || !Array.isArray(parsed.resources)) {
            logger.warn(
              `⚠️  Invalid spec in ${specFile}: missing name or resources`,
            );
            continue;
          }

          results.push({
            spec: parsed,
            dir: path.join(extensionsDir, dir.name),
            specPath: specFile,
          });

          logger.log(`📖 Loaded spec: ${parsed.name} (${parsed.resources.length} resources)`);
        } catch (err) {
          logger.error(`❌ Failed to parse ${specFile}: ${(err as Error).message}`);
        }
      }
    }

    return results;
  }

  /**
   * Find all *.spec.yaml files in a directory (non-recursive)
   */
  private static findSpecFiles(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];

    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isFile() && d.name.endsWith('.spec.yaml'))
      .map((d) => path.join(dir, d.name));
  }

  /**
   * Validate a resource spec for common errors
   */
  static validateResource(spec: ResourceSpec, allResources: Map<string, ResourceSpec>): string[] {
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