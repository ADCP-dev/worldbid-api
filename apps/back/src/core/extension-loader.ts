import { DynamicModule, Logger, Module } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

const logger = new Logger('ExtensionLoader');

/**
 * ExtensionLoaderModule
 *
 * Automatically discovers and registers NestJS modules from the `src/extensions/` directory.
 *
 * Convention: Any folder inside `extensions/` that contains an `extension.module.ts`
 * (compiled to `extension.module.js`) will be auto-imported into the application.
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

    for (const dir of dirs) {
      const modulePath = path.join(extensionsDir, dir.name, 'extension.module');

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
          extensionModules.push(moduleClass);
          logger.log(`✅ Loaded extension: ${dir.name}`);
        } else {
          logger.warn(
            `⚠️  Extension "${dir.name}" has extension.module but no module class found`,
          );
        }
      } catch {
        // Folder exists but has no extension.module — skip silently
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
}
