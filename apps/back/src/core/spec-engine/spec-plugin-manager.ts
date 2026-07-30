/**
 * SpecPluginManager — installs, removes, and lists spec plugins, and merges
 * override specs into a base ExtensionSpec.
 *
 * A plugin is a reusable spec package (spec YAML + handlers + templates).
 * The manager:
 *   1. `install(pluginName, pluginsDir, extensionsDir)` — copies the plugin
 *      directory into extensions/ and records it in spec-registry.json.
 *   2. `uninstall(pluginName, extensionsDir)` — deletes the plugin from
 *      extensions/ and removes its registry entry.
 *   3. `list(extensionsDir)` — returns the installed plugins from the registry.
 *   4. `applyOverrides(extensionSpec, overrides)` — merges override specs into
 *      a base spec: add/remove fields, replace permissions, replace hooks.
 *
 * spec-registry.json format:
 * {
 *   "plugins": [
 *     { "name": "stripe", "version": "1.0.0", "source": "local", "installedAt": "2026-07-30T..." }
 *   ]
 * }
 *
 * The registry file lives at <extensionsDir>/spec-registry.json.
 */

import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import type { ExtensionSpec, OverrideSpec, FieldSpec } from './spec.types';

const logger = new Logger('SpecPluginManager');

// ─── Registry Types ─────────────────────────────────────────────────────────

export type PluginSource = 'local' | 'npm';

export interface PluginInfo {
  name: string;
  version: string;
  source: PluginSource;
  installedAt: string;
}

interface SpecRegistry {
  plugins: PluginInfo[];
}

// ─── Plugin Spec Manifest ──────────────────────────────────────────────────
// A plugin directory is expected to contain a `plugin.manifest.json` (or
// `package.json` fallback) that declares name + version. If neither exists,
// we attempt to read version from the .spec.yaml.

interface PluginManifest {
  name: string;
  version: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const REGISTRY_FILENAME = 'spec-registry.json';
const MANIFEST_FILENAME = 'plugin.manifest.json';
const PACKAGE_FILENAME = 'package.json';

// ─── SpecPluginManager ─────────────────────────────────────────────────────

export class SpecPluginManager {
  // ─── install ─────────────────────────────────────────────────────────────

  /**
   * Install a plugin by copying it from <pluginsDir>/<pluginName>/ (or an
   * npm package in the future) into <extensionsDir>/<pluginName>/, then
   * register it in spec-registry.json.
   *
   * @param pluginName    The plugin directory name.
   * @param pluginsDir    Directory containing source plugin packages
   *                      (typically ./plugins).
   * @param extensionsDir Directory where installed extensions live.
   * @throws If the source plugin directory does not exist, the destination
   *         already exists, or copy/registry operations fail.
   */
  static async install(
    pluginName: string,
    pluginsDir: string,
    extensionsDir: string,
  ): Promise<void> {
    if (!pluginName || !pluginName.trim()) {
      throw new Error('Plugin name is required');
    }

    // Guard against path traversal: pluginName must be a simple directory name.
    this.validatePluginName(pluginName);

    const sourceDir = path.resolve(pluginsDir, pluginName);
    const destDir = path.resolve(extensionsDir, pluginName);

    logger.log(`📦 Installing plugin "${pluginName}" from ${sourceDir} → ${destDir}`);

    if (!fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) {
      throw new Error(
        `Plugin source directory not found: ${sourceDir}. ` +
          'Place plugins under ./plugins/<name>/ or check the pluginsDir argument.',
      );
    }

    if (fs.existsSync(destDir)) {
      throw new Error(
        `Plugin "${pluginName}" is already installed at ${destDir}. ` +
          'Uninstall it first (spec:remove) or choose a different name.',
      );
    }

    // Ensure extensions directory exists.
    await fs.promises.mkdir(extensionsDir, { recursive: true });

    // Copy the entire plugin directory recursively.
    try {
      await this.copyDir(sourceDir, destDir);
    } catch (err) {
      // Best-effort cleanup of partial copy.
      await this.safeRemove(destDir);
      throw new Error(
        `Failed to copy plugin "${pluginName}": ${(err as Error).message}`,
      );
    }

    // Resolve version + source for the registry entry.
    const manifest = this.readManifest(destDir, pluginName);

    // Update the registry.
    try {
      await this.registryAdd(extensionsDir, {
        name: pluginName,
        version: manifest.version,
        source: 'local',
        installedAt: new Date().toISOString(),
      });
    } catch (err) {
      // Roll back the copy if registry update fails.
      await this.safeRemove(destDir);
      throw new Error(
        `Failed to update spec-registry.json for "${pluginName}": ${(err as Error).message}`,
      );
    }

    logger.log(`✅ Plugin "${pluginName}" v${manifest.version} installed successfully`);
  }

  // ─── uninstall ──────────────────────────────────────────────────────────

  /**
   * Remove a plugin by deleting <extensionsDir>/<pluginName>/ and removing
   * its entry from spec-registry.json.
   *
   * @param pluginName    The plugin directory name.
   * @param extensionsDir Directory where installed extensions live.
   * @throws If the plugin is not installed or deletion fails.
   */
  static async uninstall(pluginName: string, extensionsDir: string): Promise<void> {
    if (!pluginName || !pluginName.trim()) {
      throw new Error('Plugin name is required');
    }

    this.validatePluginName(pluginName);

    const destDir = path.resolve(extensionsDir, pluginName);

    logger.log(`🗑️  Removing plugin "${pluginName}" from ${destDir}`);

    if (!fs.existsSync(destDir)) {
      throw new Error(
        `Plugin "${pluginName}" is not installed (directory not found: ${destDir}).`,
      );
    }

    // Delete the plugin directory.
    try {
      await this.safeRemove(destDir);
    } catch (err) {
      throw new Error(
        `Failed to delete plugin directory for "${pluginName}": ${(err as Error).message}`,
      );
    }

    // Remove the registry entry.
    try {
      await this.registryRemove(extensionsDir, pluginName);
    } catch (err) {
      logger.warn(
        `Plugin directory removed, but failed to update registry for "${pluginName}": ` +
          `${(err as Error).message}`,
      );
    }

    logger.log(`✅ Plugin "${pluginName}" removed successfully`);
  }

  // ─── list ───────────────────────────────────────────────────────────────

  /**
   * List all installed plugins from spec-registry.json.
   *
   * @param extensionsDir Directory where installed extensions live.
   * @returns Array of PluginInfo entries (empty if no registry exists).
   */
  static async list(extensionsDir: string): Promise<PluginInfo[]> {
    const registry = this.readRegistry(extensionsDir);
    return registry.plugins;
  }

  // ─── applyOverrides ─────────────────────────────────────────────────────

  /**
   * Merge override specs into a base ExtensionSpec.
   *
   * For each OverrideSpec:
   *   - Add fields listed in `override.fields.add` (deduping by field name).
   *   - Remove fields listed in `override.fields.remove` (by name).
   *   - If `override.permissions` is present, replace the resource's
   *     permissions wholesale.
   *   - If `override.hooks` is present, replace the resource's hooks
   *     wholesale.
   *
   * The resource targeted by the override is identified by
   * `override.resource` (matched against `ExtensionSpec.resources[].name`).
   *
   * @param extensionSpec  The base spec to mutate (a deep copy is returned;
   *                       the input is not mutated).
   * @param overrides      Override specs to apply.
   * @returns A new ExtensionSpec with overrides applied.
   */
  static async applyOverrides(
    extensionSpec: ExtensionSpec,
    overrides: OverrideSpec[],
  ): Promise<ExtensionSpec> {
    // Note: after applying overrides, the merged spec should be
    // re-validated via SpecValidator.validateAll() by the caller
    // to ensure no invalid fields, permissions, or hooks were introduced.
    // Deep clone so the caller's object is never mutated.
    const result: ExtensionSpec = JSON.parse(JSON.stringify(extensionSpec));

    if (!overrides || overrides.length === 0) {
      return result;
    }

    for (const override of overrides) {
      if (!override.resource) {
        logger.warn('⚠️  Override spec missing `resource` — skipping');
        continue;
      }

      const resource = result.resources.find((r) => r.name === override.resource);
      if (!resource) {
        logger.warn(
          `⚠️  Override targets resource "${override.resource}" which does not exist ` +
            `in spec "${result.name}" — skipping`,
        );
        continue;
      }

      // ── Fields: remove then add ───────────────────────────────────────
      if (override.fields) {
        if (Array.isArray(override.fields.remove) && override.fields.remove.length > 0) {
          const removeSet = new Set(override.fields.remove);
          const beforeCount = resource.fields.length;
          resource.fields = resource.fields.filter((f) => !removeSet.has(f.name));
          const removed = beforeCount - resource.fields.length;
          if (removed > 0) {
            logger.log(
              `🔧 Override: removed ${removed} field(s) from "${resource.name}"`,
            );
          }
        }

        if (Array.isArray(override.fields.add) && override.fields.add.length > 0) {
          // Deduplicate: if an added field shares a name with an existing
          // one, replace it (add wins).
          const addByName = new Map<string, FieldSpec>();
          for (const f of override.fields.add) {
            addByName.set(f.name, f);
          }

          resource.fields = resource.fields.filter(
            (f) => !addByName.has(f.name),
          );
          resource.fields.push(...Array.from(addByName.values()));

          logger.log(
            `🔧 Override: added ${override.fields.add.length} field(s) to "${resource.name}"`,
          );
        }
      }

      // ── Permissions: replace wholesale ────────────────────────────────
      if (override.permissions) {
        resource.permissions = override.permissions;
        logger.log(`🔧 Override: replaced permissions on "${resource.name}"`);
      }

      // ── Hooks: replace wholesale ─────────────────────────────────────
      if (override.hooks) {
        resource.hooks = override.hooks;
        logger.log(`🔧 Override: replaced hooks on "${resource.name}"`);
      }
    }

    return result;
  }

  // ─── Internal: Registry I/O ─────────────────────────────────────────────

  /**
   * Read spec-registry.json from <extensionsDir>. Returns an empty registry
   * (no plugins) if the file does not exist.
   */
  private static readRegistry(extensionsDir: string): SpecRegistry {
    const registryPath = path.resolve(extensionsDir, REGISTRY_FILENAME);

    if (!fs.existsSync(registryPath)) {
      return { plugins: [] };
    }

    try {
      const raw = fs.readFileSync(registryPath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<SpecRegistry>;

      if (!parsed || !Array.isArray(parsed.plugins)) {
        logger.warn(
          `⚠️  spec-registry.json is malformed (missing "plugins" array) — treating as empty`,
        );
        return { plugins: [] };
      }

      return { plugins: parsed.plugins };
    } catch (err) {
      logger.error(
        `❌ Failed to parse ${registryPath}: ${(err as Error).message} — treating as empty`,
      );
      return { plugins: [] };
    }
  }

  /**
   * Write spec-registry.json atomically (write to temp, then rename).
   */
  private static async writeRegistry(
    extensionsDir: string,
    registry: SpecRegistry,
  ): Promise<void> {
    const registryPath = path.resolve(extensionsDir, REGISTRY_FILENAME);
    const tmpPath = registryPath + '.tmp';

    await fs.promises.mkdir(extensionsDir, { recursive: true });

    const content = JSON.stringify(registry, null, 2) + '\n';
    await fs.promises.writeFile(tmpPath, content, 'utf-8');
    await fs.promises.rename(tmpPath, registryPath);
  }

  /**
   * Add a plugin entry to the registry. If an entry with the same name
   * already exists, it is replaced (re-install scenario).
   */
  private static async registryAdd(
    extensionsDir: string,
    info: PluginInfo,
  ): Promise<void> {
    const registry = this.readRegistry(extensionsDir);
    const existingIdx = registry.plugins.findIndex((p) => p.name === info.name);

    if (existingIdx >= 0) {
      registry.plugins[existingIdx] = info;
    } else {
      registry.plugins.push(info);
    }

    await this.writeRegistry(extensionsDir, registry);
  }

  /**
   * Remove a plugin entry from the registry by name.
   */
  private static async registryRemove(
    extensionsDir: string,
    pluginName: string,
  ): Promise<void> {
    const registry = this.readRegistry(extensionsDir);
    const before = registry.plugins.length;
    registry.plugins = registry.plugins.filter((p) => p.name !== pluginName);

    if (registry.plugins.length === before) {
      logger.warn(`⚠️  No registry entry found for plugin "${pluginName}"`);
    }

    await this.writeRegistry(extensionsDir, registry);
  }

  // ─── Internal: Manifest Resolution ───────────────────────────────────────

  /**
   * Read the plugin's manifest (plugin.manifest.json preferred, package.json
   * fallback). If neither exists, attempt to read the version from the
   * .spec.yaml file. Defaults to "0.0.0" if nothing is found.
   */
  private static readManifest(pluginDir: string, fallbackName: string): PluginManifest {
    // 1. plugin.manifest.json
    const manifestPath = path.join(pluginDir, MANIFEST_FILENAME);
    if (fs.existsSync(manifestPath)) {
      try {
        const raw = fs.readFileSync(manifestPath, 'utf-8');
        const parsed = JSON.parse(raw) as Partial<PluginManifest>;
        return {
          name: parsed.name || fallbackName,
          version: parsed.version || '0.0.0',
        };
      } catch (err) {
        logger.warn(
          `⚠️  Failed to parse ${MANIFEST_FILENAME}: ${(err as Error).message}`,
        );
      }
    }

    // 2. package.json
    const packagePath = path.join(pluginDir, PACKAGE_FILENAME);
    if (fs.existsSync(packagePath)) {
      try {
        const raw = fs.readFileSync(packagePath, 'utf-8');
        const parsed = JSON.parse(raw) as Partial<PluginManifest>;
        return {
          name: parsed.name || fallbackName,
          version: parsed.version || '0.0.0',
        };
      } catch (err) {
        logger.warn(
          `⚠️  Failed to parse ${PACKAGE_FILENAME}: ${(err as Error).message}`,
        );
      }
    }

    // 3. .spec.yaml version
    try {
      const specVersion = this.readVersionFromSpecYaml(pluginDir);
      if (specVersion) {
        return { name: fallbackName, version: specVersion };
      }
    } catch {
      // ignore — fall through to default
    }

    logger.warn(
      `⚠️  No manifest found for plugin "${fallbackName}" — defaulting version to 0.0.0`,
    );
    return { name: fallbackName, version: '0.0.0' };
  }

  /**
   * Attempt to read the `version` field from any *.spec.yaml in the plugin
   * directory. Returns null if not found.
   */
  private static readVersionFromSpecYaml(pluginDir: string): string | null {
    if (!fs.existsSync(pluginDir)) return null;

    const entries = fs.readdirSync(pluginDir, { withFileTypes: true });
    const specFile = entries.find(
      (e) => e.isFile() && e.name.endsWith('.spec.yaml'),
    );

    if (!specFile) return null;

    const fullPath = path.join(pluginDir, specFile.name);
    const raw = fs.readFileSync(fullPath, 'utf-8');
    const parsed = yaml.load(raw) as Partial<ExtensionSpec> | null;

    return parsed?.version ?? null;
  }

  // ─── Internal: Filesystem Helpers ────────────────────────────────────────

  /**
   * Recursively copy a directory (like `cp -r`).
   */
  private static async copyDir(src: string, dest: string): Promise<void> {
    await fs.promises.mkdir(dest, { recursive: true });
    const entries = await fs.promises.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        await this.copyDir(srcPath, destPath);
      } else if (entry.isFile()) {
        await fs.promises.copyFile(srcPath, destPath);
      }
      // Symlinks and other types are skipped for safety.
    }
  }

  /**
   * Safely remove a directory, ignoring "not found" errors.
   */
  private static async safeRemove(dir: string): Promise<void> {
    try {
      await fs.promises.rm(dir, { recursive: true, force: true });
    } catch (err) {
      // Only re-throw if it's not a "not found" error.
      const code = (err as NodeJS.ErrnoException).code;
      if (code !== 'ENOENT') {
        throw err;
      }
    }
  }

  /**
   * Validate that a plugin name is a simple directory name (no path
   * separators, no traversal). This prevents `../` attacks.
   */
  private static validatePluginName(pluginName: string): void {
    if (
      pluginName.includes('/') ||
      pluginName.includes('\\') ||
      pluginName.includes('..') ||
      pluginName !== path.basename(pluginName)
    ) {
      throw new Error(
        `Invalid plugin name "${pluginName}": must be a simple directory name ` +
          'with no path separators or traversal sequences.',
      );
    }
  }
}

// ─── CLI Entry Point ───────────────────────────────────────────────────────
//
// Usage:
//   npx ts-node src/core/spec-engine/spec-plugin-manager.ts spec:add <name>
//   npx ts-node src/core/spec-engine/spec-plugin-manager.ts spec:remove <name>
//   npx ts-node src/core/spec-engine/spec-plugin-manager.ts spec:list
//
// The CLI resolves the extensions directory and plugins directory from the
// current working directory (or via EXTENSIONS_DIR / PLUGINS_DIR env vars).

async function main(): Promise<void> {
  const command = process.argv[2];
  const arg = process.argv[3];

  const extensionsDir =
    process.env.EXTENSIONS_DIR || path.resolve(process.cwd(), 'extensions');
  const pluginsDir =
    process.env.PLUGINS_DIR || path.resolve(process.cwd(), 'plugins');

  try {
    switch (command) {
      case 'spec:add':
      case 'add':
        if (!arg) {
          console.error('Usage: spec:add <pluginName>');
          process.exit(1);
        }
        await SpecPluginManager.install(arg, pluginsDir, extensionsDir);
        break;

      case 'spec:remove':
      case 'remove':
        if (!arg) {
          console.error('Usage: spec:remove <pluginName>');
          process.exit(1);
        }
        await SpecPluginManager.uninstall(arg, extensionsDir);
        break;

      case 'spec:list':
      case 'list': {
        const plugins = await SpecPluginManager.list(extensionsDir);
        if (plugins.length === 0) {
          console.log('No plugins installed.');
        } else {
          console.log('Installed plugins:');
          for (const p of plugins) {
            console.log(`  ${p.name} v${p.version} (${p.source}) — installed ${p.installedAt}`);
          }
        }
        break;
      }

      default:
        console.error(
          'Unknown command. Use one of: spec:add <name>, spec:remove <name>, spec:list',
        );
        process.exit(1);
    }
  } catch (err) {
    console.error(`❌ ${(err as Error).message}`);
    process.exit(1);
  }
}

// Run CLI only when executed directly (not when imported).
if (require.main === module) {
  main();
}