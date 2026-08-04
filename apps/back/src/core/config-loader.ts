import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

const logger = new Logger('ConfigLoader');

/**
 * Discovers extension config factories automatically.
 *
 * Scans two locations per extension (in order):
 *   1. `extensions/<ext>/extension.config.ts`  — root convention (preferred)
 *   2. `extensions/<ext>/config/*.config.ts`   — legacy/secondary convention
 *
 * Any file exporting a default `registerAs(...)` factory is loaded into
 * `ConfigModule.forRoot({ load: [...] })`.
 *
 * This keeps core decoupled from extensions: deleting an extension folder
 * never breaks the build — the loader simply finds nothing.
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
    const extDir = path.join(extensionsDir, dir.name);

    // 1. Root convention: extensions/<ext>/extension.config.ts
    const rootConfigPath = path.join(extDir, 'extension.config');
    loadConfigFactory(
      rootConfigPath,
      `${dir.name}/extension.config.ts`,
      configs,
    );

    // 2. Secondary convention: extensions/<ext>/config/*.config.ts
    const configDir = path.join(extDir, 'config');
    if (fs.existsSync(configDir)) {
      try {
        const configFiles = fs
          .readdirSync(configDir)
          .filter((f) => f.match(/\.config\.(ts|js)$/));

        for (const file of configFiles) {
          const configPath = path.join(
            configDir,
            file.replace(/\.(ts|js)$/, ''),
          );
          loadConfigFactory(configPath, `${dir.name}/config/${file}`, configs);
        }
      } catch (err) {
        logger.warn(
          `⚠️  Error reading config dir for extension "${dir.name}": ${err}`,
        );
      }
    }
  }

  if (configs.length > 0) {
    logger.log(`Loaded ${configs.length} extension config(s)`);
  }

  return configs;
}

/**
 * Loads a single config factory from a module path (no extension).
 * Silently skips when the file does not exist.
 */
function loadConfigFactory(
  modulePath: string,
  label: string,
  configs: Array<(...args: any[]) => any>,
): void {
  // Skip if neither .ts nor .js exists at this path.
  if (
    !fs.existsSync(`${modulePath}.ts`) &&
    !fs.existsSync(`${modulePath}.js`)
  ) {
    return;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(modulePath);
    const configFactory = mod.default || mod;

    if (typeof configFactory === 'function') {
      configs.push(configFactory);
      logger.log(`✅ Loaded config: ${label}`);
    } else {
      logger.warn(
        `⚠️  Config file "${label}" does not export a config factory`,
      );
    }
  } catch (err) {
    logger.warn(`⚠️  Error loading config "${label}": ${err}`);
  }
}
