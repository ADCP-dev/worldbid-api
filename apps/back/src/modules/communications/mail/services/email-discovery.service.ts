import { Injectable, Logger } from '@nestjs/common';
import { glob } from 'node:fs/promises';
import { resolve } from 'node:path';

/**
 * EmailDiscoveryService — scans three roots for .vue email templates and
 * returns a Map of templateName to absolutePath (D-02).
 *
 * Roots (in precedence order — most specific first):
 *   1. extension-level emails directories
 *   2. module-level emails directories
 *   3. shared packages emails directory
 *
 * Convention: NO templates subfolder required. Drop a folder with .vue
 * files in any extension or module and they are discovered automatically.
 *
 * Name collision: extension-level takes precedence over packages-level
 * (most specific wins). A warning is logged for duplicates.
 */
@Injectable()
export class EmailDiscoveryService {
  private readonly logger = new Logger(EmailDiscoveryService.name);
  private cache: Map<string, string> | null = null;

  /**
   * Scan all three roots and return a Map<name, absolutePath>.
   * Results are cached; pass force=true to re-scan.
   */
  async findAll(force = false): Promise<Map<string, string>> {
    if (this.cache && !force) return this.cache;

    const found = new Map<string, string>();
    const cwd = process.cwd();

    // Root paths relative to cwd. Extension-level first (most specific).
    // Module glob uses ** to handle nested module paths (e.g.
    // modules/communications/mail/emails/).
    const roots = [
      'apps/back/src/extensions/*/emails/*.vue',
      'apps/back/src/modules/**/emails/*.vue',
      'packages/emails/emails/*.vue',
    ];

    for (const pattern of roots) {
      try {
        for await (const entry of glob(pattern, { cwd })) {
          const absolute = resolve(cwd, entry);
          const name = entry
            .replace(/\.vue$/, '')
            .split('/')
            .pop()!;

          if (found.has(name)) {
            this.logger.warn(
              `Duplicate template name: ${name} (paths: ${found.get(name)}, ${absolute}) — first wins`,
            );
            continue;
          }
          found.set(name, absolute);
          this.logger.debug(`Discovered: ${name} -> ${absolute}`);
        }
      } catch (err) {
        this.logger.debug(
          `Glob pattern ${pattern} failed: ${(err as Error).message}`,
        );
      }
    }

    this.cache = found;
    this.logger.log(`Discovered ${found.size} email template(s)`);
    return found;
  }

  /**
   * Resolve a template name to its absolute path.
   * Returns null if not found.
   */
  async resolveByName(name: string): Promise<string | null> {
    const all = await this.findAll();
    return all.get(name) ?? null;
  }

  /**
   * Clear the cache. Next findAll() will re-scan.
   */
  clear(): void {
    this.cache = null;
  }
}