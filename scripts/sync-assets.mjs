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
 *   3. Email theme      — brand color tokens extracted from the DaisyUI theme
 *                          → all .vue email templates' @theme blocks (Maizzle)
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
} from 'node:fs';
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

// ─── 3. Email theme ───────────────────────────────────────────────────────

// The email theme is a subset of the full DaisyUI theme — only the color
// tokens that the Maizzle @theme block uses. These are the token names we
// extract from the DaisyUI theme block and inject into .vue @theme blocks.
const EMAIL_THEME_TOKENS = [
  '--color-primary',
  '--color-primary-content',
  '--color-base-100',
  '--color-base-200',
  '--color-base-300',
  '--color-base-content',
];

// Email template roots — mirrors EmailDiscoveryService scan order.
const EMAIL_DIRS = [
  join(ROOT, 'packages/emails/emails'),
  join(ROOT, 'apps/back/src/modules/communications/mail/emails'),
  join(ROOT, 'apps/back/src/extensions'),
];

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

/**
 * Extract the value of a `--color-*` token from the DaisyUI theme block.
 * Lines look like: `--color-primary: #F97316;  (comment) `
 * Returns the trimmed hex value or null if not found.
 */
function extractThemeToken(themeBlock, tokenName) {
  // Match: --token-name: <value>;  (value is the first hex word after colon)
  const re = new RegExp(tokenName + '\\s*:\\s*([#0-9a-fA-F]+)');
  const match = themeBlock.match(re);
  return match ? match[1] : null;
}

/**
 * Build the Maizzle @theme block string from the extracted brand colors.
 */
function buildEmailThemeBlock(colors) {
  const lines = EMAIL_THEME_TOKENS.map((token) => {
    const value = colors[token];
    return value ? `  ${token}: ${value};` : null;
  }).filter(Boolean);
  return `@theme {\n${lines.join('\n')}\n}`;
}

/**
 * Replace ALL `@theme { ... }` blocks in a .vue email template with the given
 * emailThemeBlock. Handles two patterns:
 *   1. <style> block:  `@theme { ... }` lives inside a <style> tag.
 *   2. <Tailwind #config>:  `@theme { ... }` lives inside a template #config slot.
 * Both use the same @theme syntax, so we replace every occurrence.
 */
function injectEmailTheme(vuePath, emailThemeBlock) {
  let content = readFileSync(vuePath, 'utf-8');
  let changed = false;

  // Repeatedly find and replace every @theme { ... } block.
  let searchFrom = 0;
  while (searchFrom < content.length) {
    const themeIdx = content.indexOf('@theme', searchFrom);
    if (themeIdx === -1) break;
    const braceOpen = content.indexOf('{', themeIdx);
    if (braceOpen === -1) break;
    let depth = 0;
    let end = -1;
    for (let i = braceOpen; i < content.length; i++) {
      if (content[i] === '{') depth++;
      else if (content[i] === '}') {
        depth--;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }
    if (end === -1) break;

    // Preserve the indentation of the original @theme line so the
    // replacement fits both <style> (no indent) and #config slot
    // (typically 10 spaces: "          @theme").
    let lineStart = themeIdx;
    while (lineStart > 0 && content[lineStart - 1] !== '\n') lineStart--;
    const indent = content.slice(lineStart, themeIdx);
    const indentedBlock = emailThemeBlock
      .split('\n')
      .map((line, i) => (i === 0 ? line : indent + line))
      .join('\n');

    content =
      content.slice(0, themeIdx) +
      indentedBlock +
      content.slice(end);
    changed = true;
    // Advance past the replacement to avoid re-matching the newly inserted @theme.
    searchFrom = themeIdx + indentedBlock.length;
  }

  if (changed) {
    writeFileSync(vuePath, content.endsWith('\n') ? content : content + '\n');
  }
  return changed;
}

/**
 * Recursively find all .vue files in a directory.
 */
function findVueFiles(dir) {
  if (!existsSync(dir)) return [];
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      // For extensions/, only descend into emails/ subdirectories.
      if (entry.name === 'emails' || dir.includes('extensions')) {
        results.push(...findVueFiles(full));
      }
    } else if (entry.name.endsWith('.vue')) {
      results.push(full);
    }
  }
  return results;
}

// ─── Run ───────────────────────────────────────────────────────────────────

let synced = 0;

// 1. Logo
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

// 2. Theme (web CSS)
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

    // 3. Email theme — extract brand colors and inject into all .vue templates.
    const colors = {};
    for (const token of EMAIL_THEME_TOKENS) {
      const value = extractThemeToken(themeBlock, token);
      if (value) colors[token] = value;
    }

    if (Object.keys(colors).length === 0) {
      console.warn('⚠️  No brand color tokens found in DaisyUI theme. Skipping email theme sync.');
    } else {
      const emailThemeBlock = buildEmailThemeBlock(colors);
      let emailCount = 0;
      for (const dir of EMAIL_DIRS) {
        for (const vuePath of findVueFiles(dir)) {
          if (injectEmailTheme(vuePath, emailThemeBlock)) {
            const rel = vuePath.replace(ROOT + '/', '');
            console.log(`✅ Email theme synced → ${rel}`);
            emailCount++;
          }
        }
      }
      if (emailCount > 0) {
        console.log(`✅ Email theme synced (${emailCount} template(s))`);
        synced++;
      } else {
        console.warn('⚠️  No .vue email templates found with @theme blocks.');
      }
    }
  }
}

console.log(`\n${synced} item(s) synced.`);