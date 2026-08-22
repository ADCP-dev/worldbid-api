import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

/**
 * Render result returned by TemplateRenderer.render().
 */
export interface RenderResult {
  html: string;
  plaintext?: string;
}

interface CacheEntry {
  html: string;
  plaintext?: string;
  ts: number;
}

/**
 * TemplateRenderer — wraps Maizzle v6 top-level render() (C-02).
 *
 * Uses the top-level render() function which runs the FULL pipeline:
 * SSR (Vue → HTML) + transformers (CSS inlining, purging) + doctype +
 * plaintext generation. This is the correct way to get fully inlined
 * HTML emails with Tailwind CSS.
 *
 * Results are cached by `path + sha256(stableStringify(config))` so cache
 * hits return in <5ms (NFR-001). First render is ~5-30s (cold Vite SSR).
 *
 * DEVIATION 1 (plaintext): render() returns plaintext as a string when
 * usePlaintext() is called in the SFC.
 *
 * DEVIATION 2 (perf): Raw first render is ~5-30s (cold Vite SSR server).
 * The cache layer meets the <5ms cache-hit target.
 *
 * DEVIATION 3 (moduleResolution): apps/back compiles to CJS via SWC, which
 * transforms `await import()` into `require()`. @maizzle/framework v6 is
 * ESM-only — require() fails with ERR_PACKAGE_PATH_NOT_EXPORTED. We bypass
 * SWC's static analysis with new Function() to use Node's native import().
 *
 * DEVIATION 4 (CSS inlining): createRenderer().render() only does SSR —
 * it does NOT inline CSS. The top-level render() runs the full transformer
 * pipeline including CSS inlining. This is why we use render() instead of
 * createRenderer().render().
 *
 * DEVIATION 5 (@emails alias): Extension templates import Layout via
 * `@emails/Layout.vue`. We pass a Vite resolve.alias config via the
 * config object's `vite` field so Maizzle's Vite SSR can resolve it.
 */
@Injectable()
export class TemplateRenderer implements OnModuleDestroy {
  private readonly logger = new Logger(TemplateRenderer.name);
  private readonly cache = new Map<string, CacheEntry>();
  private renderFn:
    | ((
        template: string,
        config: Record<string, unknown>,
      ) => Promise<{ html: string; plaintext?: string }>)
    | null = null;
  private renderer: Awaited<
    ReturnType<typeof import('@maizzle/framework')['createRenderer']>
  > | null = null;

  private readonly MAX_ENTRIES = 500;

  /**
   * Render a .vue template with the given config object.
   * The config is accessed via useConfig() inside the SFC (C-01).
   * Results are cached by path + config hash.
   */
  async render(
    templatePath: string,
    config: Record<string, unknown>,
  ): Promise<RenderResult> {
    const key = this.cacheKey(templatePath, config);
    const cached = this.cache.get(key);
    if (cached) {
      this.logger.debug(`Cache hit: ${templatePath}`);
      return { html: cached.html, plaintext: cached.plaintext };
    }

    this.logger.log(`Rendering: ${templatePath}`);
    const renderFn = await this.getRenderFn();

    let result: { html: string; plaintext?: string };
    try {
      // Merge the Vite alias config into the template config so Maizzle's
      // Vite SSR server can resolve @emails/* imports in extension templates.
      const configWithVite = {
        ...config,
        vite: {
          resolve: {
            alias: {
              '@emails': this.emailsPkgDir,
            },
          },
        },
      };
      result = await renderFn(templatePath, configWithVite);
    } catch (err) {
      const message = (err as Error).message ?? String(err);
      this.logger.error(`Render failed for ${templatePath}: ${message}`);
      throw err;
    }

    const entry: CacheEntry = {
      html: result.html,
      plaintext: result.plaintext,
      ts: Date.now(),
    };
    this.evictIfNeeded();
    this.cache.set(key, entry);

    return { html: entry.html, plaintext: entry.plaintext };
  }

  /**
   * Clear the cache. If a templatePath is given, clears only entries for
   * that path. Otherwise clears all entries.
   */
  clearCache(templatePath?: string): void {
    if (!templatePath) {
      this.cache.clear();
      this.logger.log('Cache cleared (all)');
      return;
    }
    const prefix = `${templatePath}::`;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
    this.logger.log(`Cache cleared for ${templatePath}`);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.renderer) {
      try {
        await this.renderer.close();
        this.logger.log('Maizzle renderer closed');
      } catch (err) {
        this.logger.error(
          `Failed to close renderer: ${(err as Error).message}`,
        );
      }
      this.renderer = null;
    }
  }

  private emailsPkgDir = '';

  private async getRenderFn() {
    if (!this.renderFn) {
      // DEVIATION 3: bypass SWC's import-to-require transform with new Function().
      const nativeImport = new Function(
        'specifier',
        'return import(specifier)',
      ) as (s: string) => Promise<typeof import('@maizzle/framework')>;
      const { render } = await nativeImport('@maizzle/framework');

      // Pre-compute the @emails alias path for extension templates.
      const cwd = process.cwd();
      this.emailsPkgDir = resolve(cwd, '../../packages/emails/emails');

      this.renderFn = render as unknown as typeof this.renderFn;
      this.logger.log('Maizzle render() ready');
    }
    return this.renderFn;
  }

  private cacheKey(
    templatePath: string,
    config: Record<string, unknown>,
  ): string {
    const hash = createHash('sha256')
      .update(this.stableStringify(config))
      .digest('hex')
      .slice(0, 16);
    return `${templatePath}::${hash}`;
  }

  /**
   * Stable JSON serialization — sorts object keys recursively so
   * {a:1,b:2} and {b:2,a:1} produce the same string (D-CACHE).
   */
  private stableStringify(value: unknown): string {
    return JSON.stringify(value, (_k, val) =>
      val && typeof val === 'object' && !Array.isArray(val)
        ? Object.keys(val as Record<string, unknown>)
            .sort()
            .reduce<Record<string, unknown>>((acc, k) => {
              acc[k] = (val as Record<string, unknown>)[k];
              return acc;
            }, {})
        : val,
    );
  }

  /**
   * LRU eviction at MAX_ENTRIES — evicts the oldest entry by timestamp.
   */
  private evictIfNeeded(): void {
    if (this.cache.size < this.MAX_ENTRIES) return;
    let oldestKey: string | null = null;
    let oldestTs = Infinity;
    for (const [key, entry] of this.cache) {
      if (entry.ts < oldestTs) {
        oldestTs = entry.ts;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.logger.debug(`Evicted oldest cache entry (ts=${oldestTs})`);
    }
  }
}