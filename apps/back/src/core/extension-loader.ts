import { DynamicModule, Logger, Module } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import type { ExtensionManifest } from './extension-manifest.types';
import { detectConflicts } from './extension-conflict-detector';
import { resolveDependencies } from './extension-dependency-resolver';

const logger = new Logger('ExtensionLoader');

/**
 * ExtensionLoaderModule
 *
 * Automatically discovers and registers NestJS modules from the `src/extensions/` directory.
 *
 * Convention: Any folder inside `extensions/` that contains an `extension.module.ts`
 * (compiled to `extension.module.js`) will be auto-imported into the application.
 *
 * Extensions may also provide an `extension.manifest.ts` (compiled to `extension.manifest.js`)
 * which declares routes, entities, dependencies, and other metadata. The manifest system
 * validates conflicts and resolves load order automatically.
 *
 * Backward compatibility: extensions WITHOUT a manifest are still loaded with a warning.
 *
 * Usage in AppModule:
 *   imports: [ExtensionLoaderModule.register()]
 */
@Module({})
export class ExtensionLoaderModule {
  static register(): DynamicModule {
    const extensionsDir = path.join(__dirname, '..', 'extensions');
    const extensionModules: any[] = [];

    if (!fs.existsSync(extensionsDir)) {
      logger.log('No extensions directory found — skipping');
      return {
        module: ExtensionLoaderModule,
        imports: [],
      };
    }

    const dirs = fs
      .readdirSync(extensionsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory());

    // Phase 1: Load manifests from all extension dirs
    const manifests = this.loadManifests(extensionsDir, dirs);

    // Phase 2: Run conflict detection
    const conflicts = detectConflicts(manifests);

    // Phase 3: Error-level conflicts block registration
    const errors = conflicts.filter((c) => c.severity === 'error');
    if (errors.length > 0) {
      logger.error(`❌ ${errors.length} conflict(s) prevent extension loading`);
      for (const err of errors) {
        logger.error(`   ${err.detail}`);
      }
      // Still return an empty module — don't crash, but don't load anything
      return {
        module: ExtensionLoaderModule,
        imports: [],
      };
    }

    // Phase 3b: Collect extensions with missing dependencies (warnings) — skip them
    const missingDepConflicts = conflicts.filter(
      (c) => c.type === 'missing_dependency' && c.severity === 'warning',
    );
    const skipDueToMissingDeps = new Set<string>();
    for (const c of missingDepConflicts) {
      // Use structured `extension` field if available; fall back to regex for backward compat
      const extName = c.extension ?? c.detail.match(/Extension "([^"]+)"/)?.[1];
      if (extName) {
        skipDueToMissingDeps.add(extName);
        logger.warn(`⏭️  Skipping extension "${extName}" due to missing dependency`);
      }
    }

    // Phase 4: Resolve dependency order (topological sort)
    const { ordered: orderedManifests } = resolveDependencies(manifests);

    // Phase 5: Load extension modules in resolved order
    const loadedNames = new Set<string>();

    // First: load extensions that have manifests (in resolved order)
    for (const manifest of orderedManifests) {
      const extName = manifest.name;

      // Skip extensions with missing dependencies
      if (skipDueToMissingDeps.has(extName)) {
        continue;
      }

      const dirEntry = dirs.find((d) => d.name === extName);
      if (!dirEntry) continue;

      const mod = this.loadModule(extensionsDir, dirEntry.name);
      if (mod) {
        extensionModules.push(mod);
        loadedNames.add(dirEntry.name);
        logger.log(
          `✅ Loaded extension: ${dirEntry.name} v${manifest.version}`,
        );
      }
    }

    // Second: load remaining extensions that have NO manifest (backward compat)
    for (const dir of dirs) {
      if (loadedNames.has(dir.name)) continue;

      const mod = this.loadModule(extensionsDir, dir.name);
      if (mod) {
        extensionModules.push(mod);
        loadedNames.add(dir.name);
        logger.log(`✅ Loaded extension (legacy): ${dir.name}`);
      }
    }

    // Also check for extensions that have manifests but no module
    for (const [extName] of manifests) {
      if (!loadedNames.has(extName)) {
        logger.warn(
          `⚠️  Extension "${extName}" has manifest but no extension.module — skipped`,
        );
      }
    }

    if (extensionModules.length === 0) {
      logger.log('No extensions found');
    } else {
      logger.log(
        `Loaded ${extensionModules.length} extension(s): ${extensionModules.map((m) => m.name).join(', ')}`,
      );
    }

    return {
      module: ExtensionLoaderModule,
      imports: extensionModules,
    };
  }

  /**
   * Load `extension.manifest.ts` from each extension directory.
   * Returns a Map of extension name → ExtensionManifest.
   * Extensions without a manifest are not included in the map.
   */
  static loadManifests(
    extensionsDir: string,
    dirs: fs.Dirent[],
  ): Map<string, ExtensionManifest> {
    const manifests = new Map<string, ExtensionManifest>();

    for (const dir of dirs) {
      const manifestPath = path.join(
        extensionsDir,
        dir.name,
        'extension.manifest',
      );

      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mod = require(manifestPath);

        const manifest = Object.values(mod).find(
          (v: any) =>
            v !== null &&
            typeof v === 'object' &&
            typeof v.name === 'string' &&
            typeof v.version === 'string',
        ) as ExtensionManifest | undefined;

        if (manifest) {
          manifests.set(manifest.name, manifest);
        } else {
          logger.warn(
            `⚠️  "${dir.name}/extension.manifest.ts" exists but exports no valid manifest object`,
          );
        }
      } catch {
        // No manifest or error reading it — skip silently (backward compat)
      }
    }

    if (manifests.size > 0) {
      logger.log(`Found ${manifests.size} extension manifest(s)`);
    }

    return manifests;
  }

  /**
   * Try to load an extension.module from a given extension directory.
   * Returns the module class or null if not found.
   */
  private static loadModule(
    extensionsDir: string,
    dirName: string,
  ): any | null {
    const modulePath = path.join(extensionsDir, dirName, 'extension.module');

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require(modulePath);

      const moduleClass = Object.values(mod).find(
        (v: any) =>
          typeof v === 'function' &&
          v.name &&
          v.name.toLowerCase().includes('module'),
      ) as any;

      if (moduleClass) {
        return moduleClass;
      }

      logger.warn(
        `⚠️  Extension "${dirName}" has extension.module but no module class found`,
      );
      return null;
    } catch {
      return null;
    }
  }
}
