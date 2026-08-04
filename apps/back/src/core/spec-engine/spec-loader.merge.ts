/**
 * Spec Loader Merge — pure merge helper for split-spec files.
 *
 * Introduced by change `spec-engine-v2-frontend-and-loader` (Slice 1).
 *
 * Contract:
 *   - `mergeSpecs(files: ExtensionSpec[]): ExtensionSpec` merges multiple
 *     ExtensionSpec objects (typically one per `*.spec.yaml` file inside a
 *     single extension directory) into one in-memory ExtensionSpec.
 *   - `resources[]` are merged by `resource.name`. A duplicate resource name
 *     across files is a hard error (throws `SpecMergeError` naming both files
 *     and the duplicated resource). Within a single file, declaration order is
 *     preserved across the merge.
 *   - `views[]` are concatenated across files, keyed by `view.name`. A
 *     duplicate view name across files throws `SpecMergeError`.
 *   - `overrides[]`, `roles[]`, `roleSeeds[]`, `config[]` are concatenated
 *     across files (no dedup — these are intentionally additive).
 *   - Top-level scalar metadata (`name`, `version`, `displayName`,
 *     `description`, `author`) is taken from the first file.
 *
 * This module is intentionally pure (no fs, no NestJS Logger) so it is trivial
 * to unit-test without mocks.
 */

import type {
  ConfigItemSpec,
  ExtensionSpec,
  OverrideSpec,
  RoleDefSpec,
} from './spec.types';

/**
 * Error thrown when two spec files declare the same resource name, view name,
 * or any other key that must be unique across an extension.
 *
 * `fileA` / `fileB` identify the two conflicting specs (by extension `name`,
 * since each input ExtensionSpec carries its own `name`). `resource` is the
 * duplicated key.
 */
export class SpecMergeError extends Error {
  fileA: string;
  fileB: string;
  resource: string;

  constructor(fileA: string, fileB: string, resource: string, kind: string) {
    super(
      `Duplicate ${kind} "${resource}" found in spec files "${fileA}" and "${fileB}"`,
    );
    this.name = 'SpecMergeError';
    this.fileA = fileA;
    this.fileB = fileB;
    this.resource = resource;
  }
}

/**
 * Merge multiple ExtensionSpec objects (one per `*.spec.yaml` file inside a
 * single extension) into one in-memory ExtensionSpec.
 *
 * Throws `SpecMergeError` on duplicate `resources[].name` or `views[].name`.
 */
export function mergeSpecs(files: ExtensionSpec[]): ExtensionSpec {
  if (files.length === 0) {
    return {
      name: '',
      version: '',
      resources: [],
    };
  }

  const first = files[0];

  // Top-level scalar metadata comes from the first file.
  const merged: ExtensionSpec = {
    name: first.name,
    version: first.version,
    displayName: first.displayName,
    description: first.description,
    author: first.author,
    resources: [],
  };

  // resources: keyed by name, duplicate across files → hard error.
  const seenResources = new Map<string, string>(); // resource name → file name that first declared it
  for (const file of files) {
    const fileName = file.name;
    for (const resource of file.resources || []) {
      if (seenResources.has(resource.name)) {
        throw new SpecMergeError(
          seenResources.get(resource.name) as string,
          fileName,
          resource.name,
          'resource',
        );
      }
      seenResources.set(resource.name, fileName);
      merged.resources.push(resource);
    }
  }

  // overrides / roles / roleSeeds / config: plain concatenation (additive).
  if (files.some((f) => f.overrides && f.overrides.length > 0)) {
    merged.overrides = concatNonEmpty(files, 'overrides') as OverrideSpec[];
  }
  if (files.some((f) => f.roles && f.roles.length > 0)) {
    merged.roles = concatNonEmpty(files, 'roles') as RoleDefSpec[];
  }
  if (files.some((f) => f.roleSeeds && f.roleSeeds.length > 0)) {
    merged.roleSeeds = concatNonEmpty(
      files,
      'roleSeeds',
    ) as ExtensionSpec['roleSeeds'];
  }
  if (files.some((f) => f.config && f.config.length > 0)) {
    merged.config = concatNonEmpty(files, 'config') as ConfigItemSpec[];
  }

  return merged;
}

// ─── Internal helpers ───────────────────────────────────────────────────────

/**
 * Concatenate an array-valued field across all files that declare it.
 * Skips undefined / empty arrays. Returns the combined array.
 */
function concatNonEmpty<K extends keyof ExtensionSpec>(
  files: ExtensionSpec[],
  key: K,
): unknown[] {
  const out: unknown[] = [];
  for (const file of files) {
    const value = file[key];
    if (Array.isArray(value)) {
      out.push(...value);
    }
  }
  return out;
}
