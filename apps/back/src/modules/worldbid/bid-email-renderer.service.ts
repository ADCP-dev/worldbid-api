import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { createHash } from 'crypto';
import { resolve } from 'path';
import { writeFileSync, mkdtempSync, readdirSync } from 'fs';
import { tmpdir } from 'os';

export interface BidEmailPayload {
  to: string;
  alias: string;
  kind: 'confirmed' | 'outbid';
  spotLabel: string;
  amount: string;
  appUrl: string;
}

interface RenderedBidEmail {
  html: string;
  text: string;
}

/**
 * Renders the styled WorldBid bid emails (own Maizzle SFCs + Tailwind v4 +
 * juice inlining), independent of the shared TemplateRenderer, whose pipeline
 * currently drops the theme CSS (SSR output reaches clients with classes but
 * no compiled utilities — a pre-existing Foundation template-system issue).
 *
 * Pipeline per render (cached by payload hash):
 *   1. @maizzle/framework createRenderer().render() — SSR of the .vue SFC
 *   2. Tailwind v4 compile — Maizzle theme CSS + @theme colors + @source scan
 *   3. juice — inline the compiled CSS into the SSR html
 */
@Injectable()
export class BidEmailRendererService implements OnModuleDestroy {
  private readonly logger = new Logger(BidEmailRendererService.name);

  private readonly pnpmDir = resolve(process.cwd(), '../../node_modules/.pnpm');
  private readonly flatNodeModules = resolve(process.cwd(), '../../node_modules');
  private readonly emailsDir = resolve(
    process.cwd(),
    '../../packages/emails/emails',
  );
  private readonly cache = new Map<string, RenderedBidEmail>();
  private readonly MAX_CACHE = 200;

  private ssr: ((path: string, cfg: object) => Promise<{ html: string }>) | null =
    null;
  private closeSSR: (() => Promise<void>) | null = null;

  /** Resolve an installed package root. Prefers the pnpm store layout
   *  (.pnpm/<pkg>@<v>-<hash>/node_modules/<pkg>); falls back to the flat
   *  node_modules (docker/hoisted installs). Throws only if neither exists. */
  private pkg(prefix: string): string {
    const fs = require('fs');
    const flat = resolve(this.flatNodeModules, prefix.replace(/\+.*$/, '').replace('@maizzle+', '@maizzle/'));
    // 1) flat node_modules (works in hoisted/docker installs)
    try {
      if (fs.existsSync(resolve(this.flatNodeModules, prefix.split('@').filter(Boolean)[0]))) {
        const direct = resolve(this.flatNodeModules, prefix.split('@').filter(Boolean)[0]);
        if (fs.existsSync(direct)) return direct;
      }
    } catch { /* fall through */ }
    // 2) pnpm store layout
    const dir = readdirSync(this.pnpmDir)
      .filter((d) => d.startsWith(prefix))
      .sort()
      .pop();
    if (!dir) throw new Error(`pnpm package not found: ${prefix}`);
    // dir looks like "@maizzle+framework@6.1.0_<hash>" (scoped: @scope+name@v)
    // or "react@18.3.1_<hash>" (unscoped). Package name = strip @<version>+<hash>
    let pkgName: string;
    if (dir.startsWith('@')) {
      const plus = dir.indexOf('+');
      const at = dir.indexOf('@', plus);
      pkgName = dir.slice(0, plus) + '/' + dir.slice(plus + 1, at);
    } else {
      const at = dir.indexOf('@', 1);
      pkgName = dir.slice(0, at);
    }
    return resolve(this.pnpmDir, dir, 'node_modules', pkgName);
  }

  private mazzleCss(): string {
    return resolve(this.pkg('@maizzle+tailwindcss@'), 'index.css');
  }

  async render(payload: BidEmailPayload): Promise<RenderedBidEmail | null> {
    const key = createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex')
      .slice(0, 16);
    const cached = this.cache.get(key);
    if (cached) return cached;

    try {
      const nativeImport = new Function('s', 'return import(s)') as (
        s: string,
      ) => Promise<any>;

      if (!this.ss) {
        const fw = await nativeImport(
          resolve(this.pkg('@maizzle+framework@'), 'dist/index.js'),
        );
        const renderer = await fw.createRenderer();
        this.ssr = renderer.render.bind(renderer);
        this.closeSSR = () => renderer.close();
      }

      const templatePath = resolve(
        this.emailsDir,
        payload.kind === 'confirmed'
          ? 'worldbid-bid-confirmed.vue'
          : 'worldbid-bid-outbid.vue',
      );

      const copy = {
        lang: 'en',
        subject:
          payload.kind === 'confirmed'
            ? `Your WorldBid bid on ${payload.spotLabel} is confirmed — ${payload.amount}`
            : `You were outbid on ${payload.spotLabel} — WorldBid`,
        title: payload.kind === 'confirmed' ? 'Bid confirmed' : 'You were outbid',
        greeting: `Hi ${payload.alias},`,
        bodyText:
          payload.kind === 'confirmed'
            ? `Your bid on ${payload.spotLabel} is confirmed. It is now the top bid and you own the spot.`
            : `Someone outbid you on ${payload.spotLabel}. You no longer own it — the new top bid is higher than your ${payload.amount}.`,
        ownershipText:
          payload.kind === 'confirmed'
            ? `${payload.spotLabel} — ${payload.amount}`
            : `${payload.spotLabel} — lost to a higher bid`,
        ctaText: 'Open WorldBid',
        link: payload.appUrl,
        ignoreText: `You receive this email because you bid on WorldBid with ${payload.to}.`,
        user: { name: payload.alias, email: payload.to },
      };

      const { html: ssrHtml } = await this.ssr!(templatePath, copy);

      // Tailwind v4: theme + colors + class scan of the SSR output
      const scanDir = mkdtempSync(resolve(tmpdir(), 'wb-mail-'));
      const scanFile = resolve(scanDir, 'scan.html');
      writeFileSync(scanFile, ssrHtml);
      const postcss = require(resolve(this.pkg('postcss@'), 'lib/postcss.js'));
      const twPostcss = require(
        resolve(this.pkg('@tailwindcss+postcss@'), 'dist/index.js'),
      );
      const cssIn = [
        `@import '${this.mazzleCss()}';`,
        '@theme {',
        `  --color-primary: #3b82f6;`,
        `  --color-primary-content: #ffffff;`,
        `  --color-accent: #ef4444;`,
        `  --color-base-100: #0b1220;`,
        `  --color-base-200: #111a2c;`,
        `  --color-base-300: #1b2740;`,
        `  --color-base-content: #e6edf6;`,
        `}`,
        `@source '${scanFile}';`,
      ].join('\n');
      const compiled = await postcss([twPostcss()]).process(cssIn, {
        from: scanFile,
      });

      const juiceMod = require(resolve(this.pkg('juice@'), 'index.js'));
      const juice = juiceMod.default ?? juiceMod;
      const finalHtml = juice(ssrHtml, {
        extraCss: compiled.css,
        removeStyleTags: true,
      });

      const text = [
        copy.subject,
        copy.title,
        copy.greeting,
        copy.bodyText,
        copy.ownershipText,
        `${copy.ctaText}: ${copy.link}`,
        copy.ignoreText,
      ]
        .filter(Boolean)
        .join('\n\n');

      if (this.cache.size >= this.MAX_CACHE) {
        const oldest = this.cache.keys().next().value;
        if (oldest) this.cache.delete(oldest);
      }
      this.cache.set(key, { html: finalHtml, text });
      return { html: finalHtml, text };
    } catch (error: any) {
      this.logger.error(`styled bid email render failed: ${error?.message}`);
      return null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.closeSSR) {
      try {
        await this.closeSSR();
      } catch {
        /* ignore */
      }
      this.ssr = null;
      this.closeSSR = null;
    }
  }
}