import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

const logger = new Logger('ConfigLoader');

/**
 * Discovers extension config factories from src/extensions/<name>/config/*.config.ts
 *
 * Convention: any file matching `*.config.ts` (compiled to `*.config.js`)
 * inside `extensions/<ext>/config/` that exports a default `registerAs(...)` factory
 * will be automatically loaded into `ConfigModule.forRoot({ load: [...] })`.
 *
 * Usage in AppModule:
 *   ConfigModule.forRoot({ load: [...coreConfigs, ...discoverExtensionConfigs()] })
 */
export function discoverExtensionConfigs(): Array<(...args: any[]) => any> {
  const extensionsDir = path.join(__dirname, '..', 'extensions');
  const configs: Array<(...args: any[]) => any> = [];

  if (!fs.existsSync(extensionsDir)) {
    return configs;
  }

  const dirs = fs
    .readdirSync(extensionsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory());

  for (const dir of dirs) {
    const configDir = path.join(extensionsDir, dir.name, 'config');

    if (!fs.existsSync(configDir)) {
      continue;
    }

    try {
      const configFiles = fs
        .readdirSync(configDir)
        .filter((f) => f.match(/\.config\.(ts|js)$/));

      for (const file of configFiles) {
        const configPath = path.join(configDir, file.replace(/\.(ts|js)$/, ''));

        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const mod = require(configPath);
          const configFactory = mod.default || mod;

          if (typeof configFactory === 'function') {
            configs.push(configFactory);
            logger.log(`✅ Loaded config: ${dir.name}/${file}`);
          } else {
            logger.warn(
              `⚠️  Config file "${dir.name}/${file}" does not export a config factory`,
            );
          }
        } catch (err) {
          logger.warn(`⚠️  Error loading config "${dir.name}/${file}": ${err}`);
        }
      }
    } catch (err) {
      logger.warn(
        `⚠️  Error reading config dir for extension "${dir.name}": ${err}`,
      );
    }
  }

  if (configs.length > 0) {
    logger.log(`Loaded ${configs.length} extension config(s)`);
  }

  return configs;
}
