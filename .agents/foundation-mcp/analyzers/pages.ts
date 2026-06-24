import { readFile } from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';

export type Page = {
  layer: string;
  filePath: string;
  route: string;
  type: 'page' | 'layout';
  layout?: string;
  middleware?: string[];
  name?: string;
};

const DEFINE_PAGE_META_REGEX = /definePageMeta\s*\(\s*\{([\s\S]*?)\}\s*\)/;
const LAYOUT_META_REGEX = /layout\s*:\s*['"`]([^'"`]+)['"`]/;
const MIDDLEWARE_STRING_REGEX = /middleware\s*:\s*['"`]([^'"`]+)['"`]/;
const MIDDLEWARE_ARRAY_REGEX = /middleware\s*:\s*\[([^\]]+)\]/;

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/');
}

function inferLayer(normalizedFile: string, frontDir: string): string {
  const root = normalizePath(frontDir).replace(/\/$/, '');
  const rel = normalizedFile.startsWith(root + '/')
    ? normalizedFile.slice(root.length + 1)
    : normalizedFile;
  const parts = rel.split('/');
  if (parts[0] === 'pages' || parts[0] === 'layouts') return 'root';
  if (parts[0] === 'modules' && parts[1]) return `modules/${parts[1]}`;
  if (parts[0] === 'extensions' && parts[1]) return `extensions/${parts[1]}`;
  return parts[0] ?? 'root';
}

function filePathToRoute(
  normalizedFile: string,
  frontDir: string,
  kind: 'page' | 'layout',
): { route: string; name: string | null } | null {
  const root = normalizePath(frontDir).replace(/\/$/, '');
  if (!normalizedFile.startsWith(root + '/')) return null;
  const rel = normalizedFile.slice(root.length + 1);
  const parts = rel.split('/');

  let segments: string[];
  let layoutName: string | null = null;

  if (kind === 'layout') {
    const layoutsIdx = parts.indexOf('layouts');
    if (layoutsIdx === -1 || layoutsIdx === parts.length - 1) return null;
    const fileName = parts[parts.length - 1]!;
    if (!fileName.endsWith('.vue')) return null;
    layoutName = fileName.slice(0, -'.vue'.length);
    if (layoutName.startsWith('_')) return null;
    return { route: '', name: layoutName };
  }

  const pagesIdx = parts.indexOf('pages');
  if (pagesIdx === -1 || pagesIdx === parts.length - 1) return null;
  segments = parts.slice(pagesIdx + 1);

  const last = segments[segments.length - 1]!;
  if (!last.endsWith('.vue')) return null;
  const baseName = last.slice(0, -'.vue'.length);

  if (baseName.startsWith('_')) return null;

  if (baseName === 'index') {
    segments = segments.slice(0, -1);
  } else {
    segments = [...segments.slice(0, -1), baseName];
  }

  segments = segments.filter((s) => !/^\(.+\)$/.test(s));

  const routeSegments = segments.map((s) => {
    const dm = s.match(/^\[(.+?)\]$/);
    return dm ? `:${dm[1]}` : s;
  });

  const route = '/' + routeSegments.join('/');
  return { route, name: null };
}

function parsePageMeta(source: string): {
  layout?: string;
  middleware?: string[];
} {
  const m = source.match(DEFINE_PAGE_META_REGEX);
  if (!m) return {};

  const body = m[1] ?? '';
  const result: { layout?: string; middleware?: string[] } = {};

  const layoutMatch = body.match(LAYOUT_META_REGEX);
  if (layoutMatch) result.layout = layoutMatch[1];

  const mwArrayMatch = body.match(MIDDLEWARE_ARRAY_REGEX);
  if (mwArrayMatch) {
    result.middleware = (mwArrayMatch[1] ?? '')
      .split(',')
      .map((s) => s.trim().replace(/^['"`]|['"`]$/g, ''))
      .filter((s) => s.length > 0);
  } else {
    const mwStringMatch = body.match(MIDDLEWARE_STRING_REGEX);
    if (mwStringMatch) result.middleware = [mwStringMatch[1]!];
  }

  return result;
}

export async function findPageFiles(frontDir: string): Promise<string[]> {
  const entries = await fg('**/pages/**/*.vue', {
    cwd: frontDir,
    absolute: true,
    ignore: ['**/node_modules/**', '**/dist/**', '**/.nuxt/**', '**/.output/**'],
    onlyFiles: true,
  });
  return entries.sort();
}

export async function findLayoutFiles(frontDir: string): Promise<string[]> {
  const entries = await fg('**/layouts/*.vue', {
    cwd: frontDir,
    absolute: true,
    ignore: ['**/node_modules/**', '**/dist/**', '**/.nuxt/**', '**/.output/**'],
    onlyFiles: true,
  });
  return entries.sort();
}

export async function analyzePages(frontDir: string): Promise<Page[]> {
  const absFrontDir = path.resolve(frontDir);
  const files = await findPageFiles(frontDir);
  const pages: Page[] = [];

  for (const file of files) {
    const normalized = normalizePath(file);
    const parsed = filePathToRoute(normalized, absFrontDir, 'page');
    if (!parsed) continue;
    if (parsed.route === '') continue;

    let source = '';
    try {
      source = await readFile(file, 'utf8');
    } catch (err) {
      console.error(
        `[pages] could not read ${file}:`,
        err instanceof Error ? err.message : String(err),
      );
    }
    const meta = parsePageMeta(source);
    const layer = inferLayer(normalized, absFrontDir);

    pages.push({
      layer,
      filePath: file,
      route: parsed.route,
      type: 'page',
      ...(meta.layout ? { layout: meta.layout } : {}),
      ...(meta.middleware ? { middleware: meta.middleware } : {}),
    });
  }

  return pages;
}

export async function analyzeLayouts(frontDir: string): Promise<Page[]> {
  const absFrontDir = path.resolve(frontDir);
  const files = await findLayoutFiles(frontDir);
  const layouts: Page[] = [];

  for (const file of files) {
    const normalized = normalizePath(file);
    const parsed = filePathToRoute(normalized, absFrontDir, 'layout');
    if (!parsed || !parsed.name) continue;

    const layer = inferLayer(normalized, absFrontDir);

    layouts.push({
      layer,
      filePath: file,
      route: parsed.name,
      type: 'layout',
      name: parsed.name,
    });
  }

  return layouts;
}
