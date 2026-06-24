import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';
import { z } from 'zod';
import { analyzeEndpoints, type Endpoint } from '../analyzers/endpoints.js';
import { resolveCwd } from './_runner.js';

const FRONT_DIR = 'apps/front';
const BACK_DIR = 'apps/back';

const IGNORE = [
  '**/node_modules/**',
  '**/.nuxt/**',
  '**/.output/**',
  '**/dist/**',
  '**/.turbo/**',
  '**/test-results/**',
  '**/coverage/**',
  '**/*.min.js',
  '**/*.map',
  '**/*.lock',
  '**/*.svg',
  '**/*.png',
  '**/*.jpg',
  '**/*.jpeg',
  '**/*.gif',
  '**/*.webp',
  '**/*.ico',
  '**/*.woff',
  '**/*.woff2',
  '**/*.ttf',
  '**/*.eot',
];

const FILE_EXTENSIONS = ['.ts', '.vue', '.js', '.tsx', '.jsx', '.mjs', '.cjs'];

/**
 * Regex matches path-like strings (paths that start with `/`) used in API
 * calls. Captures both template strings (`${baseURL}/users/${id}`) and
 * plain string literals (`'/users/1'`).
 */
const PATH_LITERAL_REGEX = /[`'"](\/[^`'"]*?)[`'"]/g;
const FETCH_WRAPPER_REGEX =
  /fetchWrapper\.(get|post|put|patch|delete)\s*\(\s*[`'"]?([^`'")]+)/g;
const FETCH_REGEX =
  /fetch\s*\(\s*[`'"](\/[^`'"]*?)[`'"]\s*,\s*\{[^}]*?method\s*:\s*['"`]([A-Z]+)['"`]/g;
const USE_API_REGEX =
  /api\.(get|post|put|patch|delete)\s*<[^>]*>\s*\(\s*[`'"]?([^`'")]+)/g;

type FrontUsage = {
  file: string;
  line: number;
  matched: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'UNKNOWN';
  via: 'fetchWrapper' | 'fetch' | 'useApi' | 'path-literal';
};

function dedupeAndNormalizePath(rawPath: string): string | null {
  if (!rawPath.startsWith('/')) return null;
  let p = rawPath.split('?')[0].split('#')[0].trim();
  p = p.replace(/\$\{[^}]+\}/g, ':param');
  p = p.replace(/`/g, '');
  if (!p || p === '/') return null;
  return p;
}

function endpointMatches(epPath: string, usagePath: string): boolean {
  const normalize = (s: string) => s.replace(/^\/v\d+/, '');
  const a = normalize(epPath);
  const b = normalize(usagePath);
  if (a === b) return true;
  const aSegments = a.split('/').filter(Boolean);
  const bSegments = b.split('/').filter(Boolean);
  if (aSegments.length !== bSegments.length) return false;
  return aSegments.every((seg, i) => {
    if (seg.startsWith(':')) return true;
    return seg === bSegments[i];
  });
}

async function listFrontFiles(): Promise<string[]> {
  const cwd = resolveCwd();
  const pattern = `${FRONT_DIR}/**/*+(${FILE_EXTENSIONS.map((e) => e.slice(1)).join('|')})`;
  return fg(pattern, {
    cwd,
    ignore: IGNORE,
    absolute: true,
    dot: false,
    onlyFiles: true,
  });
}

async function scanFileForUsages(file: string): Promise<FrontUsage[]> {
  const usages: FrontUsage[] = [];
  let content: string;
  try {
    content = await readFile(file, 'utf8');
  } catch {
    return usages;
  }
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1;

    let m: RegExpExecArray | null;
    const fwRegex = new RegExp(FETCH_WRAPPER_REGEX.source, 'g');
    while ((m = fwRegex.exec(line)) !== null) {
      const path = dedupeAndNormalizePath(m[2]);
      if (path) {
        usages.push({
          file,
          line: lineNo,
          matched: m[0].trim(),
          method: m[1].toUpperCase() as FrontUsage['method'],
          via: 'fetchWrapper',
        });
      }
    }

    const fetchRegex = new RegExp(FETCH_REGEX.source, 'g');
    while ((m = fetchRegex.exec(line)) !== null) {
      const path = dedupeAndNormalizePath(m[1]);
      if (path) {
        usages.push({
          file,
          line: lineNo,
          matched: m[0].trim(),
          method: m[2].toUpperCase() as FrontUsage['method'],
          via: 'fetch',
        });
      }
    }

    const uaRegex = new RegExp(USE_API_REGEX.source, 'g');
    while ((m = uaRegex.exec(line)) !== null) {
      const path = dedupeAndNormalizePath(m[2]);
      if (path) {
        usages.push({
          file,
          line: lineNo,
          matched: m[0].trim(),
          method: m[1].toUpperCase() as FrontUsage['method'],
          via: 'useApi',
        });
      }
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (
      line.includes('fetchWrapper.') ||
      line.match(/\bapi\.(get|post|put|patch|delete)\s*</) ||
      line.match(/^\s*fetch\s*\(\s*[`'"][^`'"]*[`'"]/)
    ) {
      continue;
    }
    const pathRegex = new RegExp(PATH_LITERAL_REGEX.source, 'g');
    let m: RegExpExecArray | null;
    while ((m = pathRegex.exec(line)) !== null) {
      const path = dedupeAndNormalizePath(m[1]);
      if (path && path.length > 1) {
        usages.push({
          file,
          line: i + 1,
          matched: m[0],
          method: 'UNKNOWN',
          via: 'path-literal',
        });
      }
    }
  }

  return usages;
}

function relativeFrontPath(file: string): string {
  const cwd = resolveCwd();
  return path.relative(cwd, file).replace(/\\/g, '/');
}

function relativeBackPath(file: string): string {
  const cwd = resolveCwd();
  return path.relative(cwd, file).replace(/\\/g, '/');
}

function textReply(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

export function registerCrossRefTools(server: McpServer): void {
  server.tool(
    'endpoints_used_in_front',
    'For a back-end endpoint path, list every file in apps/front/ that references it. Detects fetchWrapper.{get,post,put,patch,delete}, fetch() with method, useApi() (TanStack Query era), and bare path literals. Returns the file path, line number, the matched source, and the inferred HTTP method.',
    {
      path: z
        .string()
        .min(1)
        .describe('Endpoint path to search for, e.g., "/v1/users" or "/users"'),
      method: z
        .enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
        .optional()
        .describe('Optional HTTP method filter'),
    },
    async ({ path: queryPath, method }) => {
      const files = await listFrontFiles();
      const all: FrontUsage[] = [];
      for (const f of files) {
        const usages = await scanFileForUsages(f);
        for (const u of usages) {
          // Extract the path literal from the match (u.matched is the
          // full matched source, not just the path).
          const pathFromMatch = dedupeAndNormalizePathFromUsage(u);
          if (!pathFromMatch) continue;
          if (endpointMatches(queryPath, pathFromMatch)) {
            if (method && u.method !== 'UNKNOWN' && u.method !== method) continue;
            all.push(u);
          }
        }
      }

      const header = `# Endpoints used in front matching \`${queryPath}\`${method ? ` [${method}]` : ''} (${all.length})\n\n`;
      if (all.length === 0) {
        return textReply(header + '_No matches._\n');
      }

      const rows = all.map((u) => {
        const rel = relativeFrontPath(u.file);
        return `| \`${u.method}\` | \`${rel}:${u.line}\` | \`${escapeCell(u.matched)}\` | ${u.via} |`;
      });
      const table = [
        '| Method | Location | Matched | Via |',
        '| --- | --- | --- | --- |',
        ...rows,
      ].join('\n');
      return textReply(header + table + '\n');
    },
  );

  server.tool(
    'endpoints_unused',
    'List back-end endpoints that are NOT referenced anywhere in apps/front/. Useful for finding dead code or planning removals. Scans every .ts/.vue/.js file in the front (excluding node_modules, .nuxt, .output, etc.) and matches the path via segment comparison (treating `:param` as wildcard).',
    {},
    async () => {
      const modules = await analyzeEndpoints(BACK_DIR);
      const files = await listFrontFiles();
      const allUsages: FrontUsage[] = [];
      for (const f of files) {
        const usages = await scanFileForUsages(f);
        allUsages.push(...usages);
      }

      type EpKey = string;
      const usedKeys = new Set<EpKey>();
      for (const u of allUsages) {
        const path = dedupeAndNormalizePathFromUsage(u);
        if (path) usedKeys.add(path);
      }

      const allEndpoints: Array<{ module: string; path: string; method: string }> = [];
      for (const m of modules) {
        for (const c of m.controllers) {
          for (const e of c.endpoints) {
            allEndpoints.push({ module: m.module, path: e.path, method: e.method });
          }
        }
      }

      const unused: Array<{ module: string; path: string; method: string }> = [];
      for (const ep of allEndpoints) {
        const key = `${ep.method.toUpperCase()} ${normalizeForCompare(ep.path)}`;
        if (!usedKeys.has(key)) {
          unused.push(ep);
        }
      }

      const header = `# Unused back-end endpoints (${unused.length} of ${allEndpoints.length})\n\n`;
      if (unused.length === 0) {
        return textReply(header + '_All back-end endpoints are referenced in the front._\n');
      }

      const rows = unused.map((u) => {
        return `| \`${u.method.toUpperCase()}\` | \`${escapeCell(u.path)}\` | \`${u.module}\` |`;
      });
      const table = [
        '| Method | Path | Module |',
        '| --- | --- | --- |',
        ...rows,
      ].join('\n');
      return textReply(header + table + '\n');
    },
  );

  server.tool(
    'front_uses_endpoint',
    'For a given file path in apps/front/, list every back-end endpoint it references with the HTTP method (when known) and the matched source. Useful to understand a single file\'s API surface before refactoring.',
    {
      file: z
        .string()
        .min(1)
        .describe('Path to a file in apps/front/, relative to repo root, e.g., "apps/front/composables/useUsers.ts"'),
    },
    async ({ file }) => {
      const cwd = resolveCwd();
      const abs = path.isAbsolute(file) ? file : path.resolve(cwd, file);
      const usages = await scanFileForUsages(abs);
      const header = `# API usage in \`${file}\` (${usages.length})\n\n`;
      if (usages.length === 0) {
        return textReply(header + '_No API calls detected._\n');
      }
      const rows = usages.map((u) => {
        return `| \`${u.method}\` | line ${u.line} | \`${escapeCell(u.matched)}\` | ${u.via} |`;
      });
      const table = [
        '| Method | Line | Matched | Via |',
        '| --- | --- | --- | --- |',
        ...rows,
      ].join('\n');
      return textReply(header + table + '\n');
    },
  );
}

function dedupeAndNormalizePathFromUsage(u: FrontUsage): string | null {
  const m = u.matched.match(/[`'"](\/[^`'"]*?)[`'"]/);
  if (!m) return null;
  return dedupeAndNormalizePath(m[1]);
}

function normalizeForCompare(p: string): string {
  return p.replace(/^\/v\d+/, '').replace(/\$\{[^}]+\}/g, ':param');
}

function escapeCell(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

export type { FrontUsage };
