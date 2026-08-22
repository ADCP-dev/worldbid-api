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
 * TemplateRenderer — wraps Maizzle v6 createRenderer() (C-02).
 *
 * The renderer is created ONCE (lazy via dynamic import) and reused across
 * all renders. Results are cached by `path + sha256(stableStringify(config))`
 * so cache hits return in <5ms (NFR-001).
 *
 * DEVIATION 1 (plaintext): Maizzle v6 createRenderer().render() returns
 * `plaintext` as a CONFIG OBJECT ({}), NOT the generated plaintext string.
 * The actual plaintext string is generated via `createPlaintext(html)`.
 *
 * DEVIATION 2 (perf): Raw first render is ~5-10s (cold Vite SSR server).
 * The cache layer meets the <5ms cache-hit target. A warm-up plan
 * (pre-render core templates on bootstrap) hides the first-render cost.
 *
 * DEVIATION 3 (moduleResolution): apps/back uses classic moduleResolution
 * which cannot read @maizzle/framework v6's exports field. An ambient
 * module shim exists at types/maizzle-framework.d.ts. Runtime dynamic
 * import works (Node reads exports); only tsc needs the shim.
 */
@Injectable()
export class TemplateRenderer implements OnModuleDestroy {
  private readonly logger = new Logger(TemplateRenderer.name);
  private readonly cache = new Map<string, CacheEntry>();
  private renderer: Awaited<
    ReturnType<typeof import('@maizzle/framework')['createRenderer']>
  > | null = null;
  private createPlaintextFn: ((html: string) => string) | null = null;
  private inlineCssFn: ((html: string) => string) | null = null;

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
    const renderer = await this.getRenderer();
    let result: { html: string; plaintext?: unknown };
    try {
      result = await renderer.render(templatePath, config);
    } catch (err) {
      const message = (err as Error).message ?? String(err);
      this.logger.error(`Render failed for ${templatePath}: ${message}`);
      throw err;
    }

    // DEVIATION 4 (CSS inlining): createRenderer().render() only does SSR —
    // it does NOT run the transformer pipeline (CSS inlining, purging, etc).
    // We call inlineCss() to inline Tailwind classes into style attributes.
    let html = result.html;
    if (this.inlineCssFn) {
      try {
        html = this.inlineCssFn(html);
      } catch (err) {
        this.logger.warn(
          `inlineCss failed (using raw SSR HTML): ${(err as Error).message}`,
        );
      }
    }

    // DEVIATION 1: plaintext is generated via createPlaintext(html), NOT
    // from result.plaintext (which is a config object, not the string).
    const plaintext = this.generatePlaintext(html);

    const entry: CacheEntry = { html, plaintext, ts: Date.now() };
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

  private async getRenderer() {
    if (!this.renderer) {
      // DEVIATION 3: @maizzle/framework v6 is ESM-only ("type": "module",
      // exports has no "require" entry). The backend compiles to CJS via SWC,
      // which transforms `await import()` into `require()` — that fails with
      // ERR_PACKAGE_PATH_NOT_EXPORTED. We bypass SWC's static analysis with
      // new Function() so Node's native dynamic import() is used at runtime.
      const nativeImport = new Function(
        'specifier',
        'return import(specifier)',
      ) as (s: string) => Promise<typeof import('@maizzle/framework')>;
      const { createRenderer, createPlaintext, inlineCss } = await nativeImport(
        '@maizzle/framework',
      );

      // Resolve @emails/* alias used by extension templates to the shared
      // packages/emails/emails/ directory. Maizzle's Vite SSR server needs
      // this alias to resolve `import Layout from '@emails/Layout.vue'`.
      const cwd = process.cwd();
      const emailsPkgDir = resolve(cwd, '../../packages/emails/emails');
      this.renderer = await createRenderer({
        root: cwd,
        vite: {
          resolve: {
            alias: {
              '@emails': emailsPkgDir,
            },
          },
        },
      });
      this.createPlaintextFn = createPlaintext;
      this.inlineCssFn = inlineCss;
      this.logger.log('Maizzle renderer created (createRenderer)');
    }
    return this.renderer;
  }

  /**
   * DEVIATION 1: Generate plaintext via createPlaintext(html).
   */
  private generatePlaintext(html: string): string {
    if (!this.createPlaintextFn) {
      // Should not happen — getRenderer() sets it. Fallback: empty string.
      this.logger.warn('createPlaintext not initialized — empty plaintext');
      return '';
    }
    return this.createPlaintextFn(html);
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