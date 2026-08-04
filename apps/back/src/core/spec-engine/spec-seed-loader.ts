/**
 * SpecSeedLoader — upserts resource seeds declared in spec YAMLs.
 *
 * Problem (BUG #9):
 *   Specs declare `seeds:` per resource, but no service ever inserted them.
 *   Tables were empty after migration. The test generator even assumed seeds
 *   existed but never ran them.
 *
 * Solution:
 *   A pure function `runSpecSeeds(specs, dataSource)` that iterates every
 *   resource with a `seeds` array and upserts each row by primary key.
 *   Called from `SpecEngineBootService.onModuleInit` AFTER RoleRegistry.build
 *   so custom-role-dependent default values (if any) resolve.
 *
 * Idempotency:
 *   Upsert by `id` when the seed carries an `id`; otherwise insert-or-skip
 *   (find by all non-auto columns → skip if exists). This makes `onModuleInit`
 *   safe to re-run on every boot without duplicating rows.
 *
 * Error handling:
 *   Per-resource try/catch — one failing seed (e.g. FK to missing parent)
 *   logs a warning and continues to the next resource. Never crashes boot.
 */

import { Logger } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import type { LoadedSpec } from './spec-loader';
import type { ResourceSpec } from './spec.types';

const logger = new Logger('SpecSeedLoader');

/**
 * Run all seeds declared across loaded specs.
 *
 * @param specs  Loaded specs (from SPEC_LOADED_SPECS token)
 * @param dataSource  The app DataSource (entities already registered via
 *   `autoLoadEntities` + `TypeOrmModule.forFeature`)
 */
export async function runSpecSeeds(
  specs: LoadedSpec[],
  dataSource: DataSource,
): Promise<void> {
  // Collect all resources across all specs, then sort by FK dependency:
  // resources that are referenced by others (via `ref`) are seeded first.
  // This is a simple topological-ish sort: a resource with a `ref` to
  // another spec-resource goes after its target.
  const allResources: Array<{ resource: ResourceSpec; spec: LoadedSpec }> = [];
  for (const loaded of specs) {
    for (const resource of loaded.spec.resources) {
      allResources.push({ resource, spec: loaded });
    }
  }

  // Build a set of all spec-resource names for quick lookup.
  const specResourceNames = new Set(allResources.map((r) => r.resource.name));

  // Sort: resources WITHOUT refs to other spec-resources come first.
  // This ensures parent records exist before children try to insert.
  allResources.sort((a, b) => {
    const aHasSpecRef = a.resource.fields.some(
      (f) => f.type === 'ref' && f.ref && specResourceNames.has(f.ref),
    );
    const bHasSpecRef = b.resource.fields.some(
      (f) => f.type === 'ref' && f.ref && specResourceNames.has(f.ref),
    );
    if (aHasSpecRef && !bHasSpecRef) return 1;
    if (!aHasSpecRef && bHasSpecRef) return -1;
    return 0;
  });

  for (const { resource } of allResources) {
    const seeds = resource.seeds;
    if (!seeds || seeds.length === 0) continue;

      try {
        const repo = dataSource.getRepository(resource.name);
        let inserted = 0;
        let skipped = 0;

        for (const seed of seeds) {
          // If the seed declares an explicit `id`, upsert by id.
          if (seed && typeof seed === 'object' && 'id' in seed) {
            const existing = await repo.findOne({
              where: { id: seed.id } as any,
            });
            if (existing) {
              skipped++;
              continue;
            }
            await repo.insert(seed);
            inserted++;
          } else {
            // No explicit id — dedup by matching ALL non-auto fields.
            // Build a where-clause from every key in the seed so re-runs
            // don't insert duplicates. If any field is null/undefined we
            // skip it from the where-clause (nulls match inconsistently).
            const where: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(seed as Record<string, unknown>)) {
              if (v !== null && v !== undefined) where[k] = v;
            }
            const existing = await repo.findOne({ where: where as any });
            if (existing) {
              skipped++;
              continue;
            }
            await repo.insert(seed);
            inserted++;
          }
        }

        if (inserted > 0 || skipped > 0) {
          logger.log(
            `Seeded "${resource.name}": ${inserted} inserted, ${skipped} skipped (already present).`,
          );
        }
      } catch (err) {
        logger.warn(
          `Could not seed "${resource.name}": ${(err as Error).message}`,
        );
      }
    }
}