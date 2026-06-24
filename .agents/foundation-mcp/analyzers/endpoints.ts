import { readFile } from 'node:fs/promises';
import path from 'node:path';
import fg from 'fast-glob';

export type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'OPTIONS'
  | 'HEAD';

export type Endpoint = {
  method: HttpMethod;
  path: string;
  handler: string;
  decorators: string[];
  guards: string[];
};

export type Controller = {
  filePath: string;
  className: string;
  apiTag: string | null;
  prefix: string;
  endpoints: Endpoint[];
};

export type ModuleEndpoints = {
  module: string;
  controllers: Controller[];
};

const HTTP_METHODS: HttpMethod[] = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
  'HEAD',
];

const METHOD_DECORATOR_REGEX = new RegExp(
  `@(${HTTP_METHODS.join('|')})\\b`,
  'gi',
);

const METHOD_PATH_REGEX =
  /^@\w+\s*\(\s*(?:['"`]([^'"`]*)['"`])?\s*(?:,.*)?\)$/;

const CONTROLLER_STRING_REGEX = /@Controller\s*\(\s*['"`]([^'"`]*)['"`]\s*\)/;
const CONTROLLER_OBJECT_REGEX =
  /@Controller\s*\(\s*\{\s*([\s\S]*?)\}\s*\)/;
const API_TAGS_REGEX = /@ApiTags\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/;
const USE_GUARDS_OPEN_REGEX = /@UseGuards\s*\(/g;
const HANDLER_REGEX =
  /^(?:public\s+|private\s+|protected\s+|static\s+|async\s+|readonly\s+|abstract\s+)*(\w+)\s*\(/;

const CLASS_NAME_REGEX = /export\s+class\s+(\w+Controller)\b/;

const OTHER_DECORATOR_NAMES = [
  'HttpCode',
  'Roles',
  'ApiOperation',
  'ApiConsumes',
  'ApiBearerAuth',
  'ApiExcludeEndpoint',
  'RequiredFeature',
  'UseInterceptors',
  'SerializeOptions',
  'ApiBody',
  'ApiParam',
  'ApiOkResponse',
  'ApiCreatedResponse',
  'ApiQuery',
];

export async function findControllerFiles(rootDir: string): Promise<string[]> {
  const pattern = '**/*.controller.ts';
  const entries = await fg(pattern, {
    cwd: rootDir,
    absolute: true,
    ignore: ['**/node_modules/**', '**/dist/**'],
    onlyFiles: true,
  });
  return entries.sort();
}

function extractControllerPrefix(source: string): string {
  const stringMatch = source.match(CONTROLLER_STRING_REGEX);
  if (stringMatch) return stringMatch[1] ?? '';

  const objectMatch = source.match(CONTROLLER_OBJECT_REGEX);
  if (!objectMatch) return '';

  const body = objectMatch[1] ?? '';
  const pathMatch = body.match(/path\s*:\s*['"`]([^'"`]+)['"`]/);
  return pathMatch?.[1] ?? '';
}

function extractApiTag(source: string): string | null {
  const match = source.match(API_TAGS_REGEX);
  return match?.[1] ?? null;
}

function extractGuards(methodBlock: string): string[] {
  const guards = new Set<string>();
  USE_GUARDS_OPEN_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = USE_GUARDS_OPEN_REGEX.exec(methodBlock)) !== null) {
    const openIdx = m.index + m[0].length;
    let depth = 1;
    let i = openIdx;
    while (i < methodBlock.length && depth > 0) {
      const c = methodBlock[i];
      if (c === '(') depth++;
      else if (c === ')') depth -= 1;
      i += 1;
    }
    if (depth !== 0) {
      USE_GUARDS_OPEN_REGEX.lastIndex = openIdx;
      continue;
    }
    const args = methodBlock.slice(openIdx, i - 1);
    for (const raw of args.split(',')) {
      const cleaned = raw.trim();
      if (!cleaned) continue;
      const name = cleaned.replace(/\(.*\)$/, '').trim();
      if (name) guards.add(name);
    }
    USE_GUARDS_OPEN_REGEX.lastIndex = i;
  }
  return Array.from(guards);
}

function findMethodDecorator(
  source: string,
  startIdx: number,
): { end: number; path: string } | null {
  const openParenIdx = source.indexOf('(', startIdx);
  if (openParenIdx === -1) return null;
  let depth = 1;
  let i = openParenIdx + 1;
  while (i < source.length && depth > 0) {
    const c = source[i];
    if (c === '(') depth += 1;
    else if (c === ')') depth -= 1;
    i += 1;
  }
  if (depth !== 0) return null;
  const decoratorStr = source.slice(startIdx, i);
  const pathMatch = decoratorStr.match(METHOD_PATH_REGEX);
  return { end: i, path: pathMatch?.[1] ?? '' };
}

function extractOtherDecorators(methodBlock: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();

  const decoratorLineRegex = new RegExp(
    `^\\s*@(${OTHER_DECORATOR_NAMES.join('|')})\\b[\\s\\S]*?$`,
    'gm',
  );
  let m: RegExpExecArray | null;
  while ((m = decoratorLineRegex.exec(methodBlock)) !== null) {
    const raw = m[0].trim().replace(/\s+/g, ' ');
    if (seen.has(raw)) continue;
    seen.add(raw);
    found.push(raw);
  }
  return found;
}

function parseMethods(
  source: string,
  prefix: string,
): Endpoint[] {
  const endpoints: Endpoint[] = [];
  METHOD_DECORATOR_REGEX.lastIndex = 0;

  const matches: Array<{ method: HttpMethod; start: number; end: number; path: string }> = [];
  let dm: RegExpExecArray | null;
  while ((dm = METHOD_DECORATOR_REGEX.exec(source)) !== null) {
    const m = findMethodDecorator(source, dm.index);
    if (!m) continue;
    matches.push({
      method: dm[1] as HttpMethod,
      start: dm.index,
      end: m.end,
      path: m.path,
    });
  }

  for (let i = 0; i < matches.length; i += 1) {
    const current = matches[i];
    const nextStart = i + 1 < matches.length ? matches[i + 1]!.start : source.length;
    const methodBlock = source.slice(current.start, nextStart);
    const handler = findHandlerName(methodBlock);

    if (!handler) {
      console.error(
        `[endpoints] could not find handler after ${current.method} decorator at index ${current.start}`,
      );
      continue;
    }

    const fullPath = joinPath(prefix, current.path);

    const guards = extractGuards(methodBlock);
    const decorators = extractOtherDecorators(methodBlock);

    endpoints.push({
      method: current.method,
      path: fullPath,
      handler,
      decorators,
      guards,
    });
  }

  return endpoints;
}

function joinPath(prefix: string, sub: string): string {
  if (!prefix) return sub;
  if (!sub) return prefix;
  return `${prefix}/${sub}`;
}

function findHandlerName(methodBlock: string): string | null {
  const lines = methodBlock.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('@')) continue;
    if (trimmed.startsWith('//') || trimmed.startsWith('/*')) continue;
    const match = trimmed.match(HANDLER_REGEX);
    if (match && match[1]) return match[1];
  }
  return null;
}

function inferModule(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const srcIdx = normalized.lastIndexOf('/src/');
  if (srcIdx === -1) {
    return path.basename(filePath, '.controller.ts');
  }
  const inside = normalized.slice(srcIdx + '/src/'.length);
  const cleaned = inside.replace(/\.controller\.ts$/, '');
  if (cleaned.startsWith('modules/') || cleaned.startsWith('extensions/')) {
    return cleaned;
  }
  return cleaned;
}

export async function parseController(filePath: string): Promise<Controller> {
  const source = await readFile(filePath, 'utf8');
  const classMatch = source.match(CLASS_NAME_REGEX);
  if (!classMatch) {
    throw new Error(`No Controller class found in ${filePath}`);
  }
  const className = classMatch[1]!;
  const prefix = extractControllerPrefix(source);
  const apiTag = extractApiTag(source);
  const endpoints = parseMethods(source, prefix);

  return {
    filePath,
    className,
    apiTag,
    prefix,
    endpoints,
  };
}

export async function analyzeEndpoints(
  rootDir: string,
): Promise<ModuleEndpoints[]> {
  const files = await findControllerFiles(rootDir);
  const grouped = new Map<string, Controller[]>();

  for (const file of files) {
    try {
      const controller = await parseController(file);
      const module = inferModule(file);
      const list = grouped.get(module) ?? [];
      list.push(controller);
      grouped.set(module, list);
    } catch (err) {
      console.error(
        `[endpoints] failed to parse ${file}:`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  return Array.from(grouped.entries())
    .map(([module, controllers]) => ({ module, controllers }))
    .sort((a, b) => a.module.localeCompare(b.module));
}
