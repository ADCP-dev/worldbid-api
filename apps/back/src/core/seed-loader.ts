import { INestApplicationContext, Logger, Module } from '@nestjs/common';
import { DynamicModule } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

const logger = new Logger('SeedLoader');

interface ExtensionSeedInfo {
  name: string;
  seedModule: any;
  seedServices: any[];
}

/**
 * Discovers extension seed modules from src/extensions/<extension-name>/seeds/.
 *
 * Convention:
 *   - seed.module.ts - NestJS module registering seed services + TypeORM entities
 *   - seed.service.ts - Injectable service with a run() method
 */
function discoverExtensionSeeds(): ExtensionSeedInfo[] {
  const extensionsDir = path.join(__dirname, '..', 'extensions');
  const results: ExtensionSeedInfo[] = [];

  if (!fs.existsSync(extensionsDir)) {
    return results;
  }

  const dirs = fs
    .readdirSync(extensionsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory());

  for (const dir of dirs) {
    const seedsDir = path.join(extensionsDir, dir.name, 'seeds');

    if (!fs.existsSync(seedsDir)) {
      continue;
    }

    try {
      const seedFiles = fs
        .readdirSync(seedsDir)
        .filter((f) => f.endsWith('.ts') || f.endsWith('.js'));

      const seedModuleFile = seedFiles.find((f) =>
        f.match(/seed\.module\.(ts|js)$/),
      );

      if (!seedModuleFile) {
        logger.warn(
          `Extension "${dir.name}" has seeds/ dir but no seed module file`,
        );
        continue;
      }

      const seedModulePath = path.join(
        seedsDir,
        seedModuleFile.replace(/\.(ts|js)$/, ''),
      );
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const seedModuleExports = require(seedModulePath);
      const seedModuleClass = Object.values(seedModuleExports).find(
        (v: any) =>
          typeof v === 'function' &&
          v.name &&
          v.name.toLowerCase().includes('seedmodule'),
      );

      if (!seedModuleClass) {
        logger.warn(
          `Extension "${dir.name}" seed module found but no SeedModule class exported`,
        );
        continue;
      }

      // Find seed service(s)
      const seedServiceFiles = seedFiles.filter((f) =>
        f.match(/seed\.service\.(ts|js)$/),
      );

      const seedServices: any[] = [];

      for (const serviceFile of seedServiceFiles) {
        const servicePath = path.join(
          seedsDir,
          serviceFile.replace(/\.(ts|js)$/, ''),
        );
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const serviceExports = require(servicePath);
        const serviceClass = Object.values(serviceExports).find(
          (v: any) =>
            typeof v === 'function' &&
            v.name &&
            v.name.toLowerCase().includes('seedservice'),
        );

        if (serviceClass) {
          seedServices.push(serviceClass);
        }
      }

      if (seedServices.length > 0) {
        results.push({
          name: dir.name,
          seedModule: seedModuleClass,
          seedServices,
        });
        logger.log(
          `Found ${seedServices.length} seed service(s) for extension: ${dir.name}`,
        );
      }
    } catch (err) {
      logger.warn(
        `Error discovering seeds for extension "${dir.name}": ${err}`,
      );
    }
  }

  return results;
}

/**
 * Returns all extension seed modules for use in SeedModule imports.
 */
export function getExtensionSeedModules(): any[] {
  return discoverExtensionSeeds().map((s) => s.seedModule);
}

/**
 * Runs all extension seed services discovered from extensions/.
 * Call this after core seeds have been executed.
 */
export async function runExtensionSeeds(
  app: INestApplicationContext,
): Promise<void> {
  const seeds = discoverExtensionSeeds();

  if (seeds.length === 0) {
    logger.log('No extension seeds found');
    return;
  }

  for (const extSeed of seeds) {
    logger.log(`Running seeds for extension: ${extSeed.name}`);

    for (const ServiceClass of extSeed.seedServices) {
      try {
        const service = app.get(ServiceClass);
        if (service && typeof service.run === 'function') {
          await service.run();
          logger.log(`  ✅ ${ServiceClass.name} completed`);
        }
      } catch (err) {
        logger.error(`  ❌ Failed to run ${ServiceClass.name}: ${err}`);
      }
    }
  }
}

/**
 * Dynamic module that collects all extension seed modules.
 * Usage in SeedModule: ExtensionSeedLoaderModule.register()
 */
@Module({})
export class ExtensionSeedLoaderModule {
  static register(): DynamicModule {
    const seedModules = getExtensionSeedModules();
    return {
      module: ExtensionSeedLoaderModule,
      imports: seedModules,
    };
  }
}
