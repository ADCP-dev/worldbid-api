#!/usr/bin/env node
/**
 * Sync assets from the Nuxt frontend (source of truth) to the Astro web app
 * and the NestJS backend.
 *
 * Usage: node scripts/sync-assets.mjs
 *
 * Synced items:
 *   1. logo.svg          — apps/front/public/logo.svg → apps/web/public/ + apps/back/public/assets/
 *   2. DaisyUI theme     — apps/front/assets/css/tailwind.css @plugin "daisyui/theme" block
 *                          → apps/web/src/styles/global.css (replaces existing theme block)
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ─── 1. Logo ───────────────────────────────────────────────────────────────

const LOGO_SOURCE = join(ROOT, 'apps/front/public/logo.svg');
const LOGO_TARGETS = [
  join(ROOT, 'apps/web/public/logo.svg'),
  join(ROOT, 'apps/back/public/assets/logo.svg'),
];

// ─── 2. DaisyUI theme block ───────────────────────────────────────────────

const FRONT_CSS = join(ROOT, 'apps/front/assets/css/tailwind.css');
const WEB_CSS = join(ROOT, 'apps/web/src/styles/global.css');

/**
 * Extract the `@plugin "daisyui/theme" { ... }` block (including the preceding
 * comment line) from the frontend CSS.
 */
function extractThemeBlock(css) {
  const start = css.indexOf('/* ───');
  if (start === -1) return null;
  const pluginIdx = css.indexOf('@plugin "daisyui/theme"', start);
  if (pluginIdx === -1) return null;
  const braceOpen = css.indexOf('{', pluginIdx);
  if (braceOpen === -1) return null;
  let depth = 0;
  let end = -1;
  for (let i = braceOpen; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  if (end === -1) return null;
  return css.slice(start, end).trimEnd();
}

/**
 * Inject (or replace) the theme block in the web CSS.
 * Strategy: keep everything before the first `/* ───` comment (the static
 * @import/@plugin lines), drop everything from that comment onward, then
 * append the freshly extracted theme block (which already starts with
 * its own `/* ───` comment).
 */
function injectThemeBlock(webCssPath, themeBlock) {
  const existing = readFileSync(webCssPath, 'utf-8');
  const commentIdx = existing.indexOf('/* ───');
  const header = commentIdx === -1 ? existing : existing.slice(0, commentIdx);
  const out = `${header.trimEnd()}\n\n${themeBlock}\n`;
  writeFileSync(webCssPath, out);
}

// ─── Run ───────────────────────────────────────────────────────────────────

let synced = 0;

// Logo
if (!existsSync(LOGO_SOURCE)) {
  console.warn(`⚠️  Logo source not found: ${LOGO_SOURCE}`);
} else {
  for (const target of LOGO_TARGETS) {
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(LOGO_SOURCE, target);
    const rel = target.replace(ROOT + '/', '');
    console.log(`✅ Logo synced → ${rel}`);
    synced++;
  }
}

// Theme
if (!existsSync(FRONT_CSS)) {
  console.warn('⚠️  Frontend tailwind.css not found. Skipping theme sync.');
} else if (!existsSync(WEB_CSS)) {
  console.warn('⚠️  Web global.css not found. Skipping theme sync.');
} else {
  const css = readFileSync(FRONT_CSS, 'utf-8');
  const themeBlock = extractThemeBlock(css);
  if (!themeBlock) {
    console.warn('⚠️  Could not extract DaisyUI theme block from frontend CSS.');
  } else {
    injectThemeBlock(WEB_CSS, themeBlock);
    console.log('✅ Theme synced → apps/web/src/styles/global.css');
    synced++;
  }
}

console.log(`\n${synced} item(s) synced.`);