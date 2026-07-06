import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { analyzeEndpoints, type Endpoint } from '../analyzers/endpoints.js';
import { analyzePages, analyzeLayouts, type Page } from '../analyzers/pages.js';

const BACK_DIR = 'apps/back';
const FRONT_DIR = 'apps/front';

function escapeCell(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function endpointsTable(endpoints: Endpoint[]): string {
  if (endpoints.length === 0) return '_No endpoints._\n';
  const header = '| Method | Path | Handler | Guards | Decorators |';
  const sep = '| --- | --- | --- | --- | --- |';
  const rows = endpoints.map((e) => {
    const decs = e.decorators.length > 0 ? e.decorators.join('<br>') : '—';
    const guards = e.guards.length > 0 ? e.guards.join('<br>') : '—';
    return `| \`${e.method.toUpperCase()}\` | \`${escapeCell(e.path)}\` | \`${e.handler}()\` | ${guards} | ${decs} |`;
  });
  return [header, sep, ...rows].join('\n') + '\n';
}

function pagesTable(pages: Page[]): string {
  if (pages.length === 0) return '_No pages._\n';
  const header = '| Route | Layer | File | Layout | Middleware |';
  const sep = '| --- | --- | --- | --- | --- |';
  const rows = pages.map((p) => {
    const rel = p.filePath.replace(/\\/g, '/').split('/apps/front/')[1] ?? p.filePath;
    const layout = p.layout ?? '—';
    const mw = p.middleware ? p.middleware.join(', ') : '—';
    return `| \`${escapeCell(p.route)}\` | \`${p.layer}\` | \`${escapeCell(rel)}\` | \`${layout}\` | ${mw} |`;
  });
  return [header, sep, ...rows].join('\n') + '\n';
}

function layoutsTable(layouts: Page[]): string {
  if (layouts.length === 0) return '_No layouts._\n';
  const header = '| Name | Layer | File |';
  const sep = '| --- | --- | --- |';
  const rows = layouts.map((l) => {
    const rel = l.filePath.replace(/\\/g, '/').split('/apps/front/')[1] ?? l.filePath;
    return `| \`${l.name}\` | \`${l.layer}\` | \`${escapeCell(rel)}\` |`;
  });
  return [header, sep, ...rows].join('\n') + '\n';
}

function textReply(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

export function registerIntrospectionTools(server: McpServer): void {
  server.tool(
    'list_endpoints',
    'List all NestJS backend endpoints, grouped by module/extension. Returns HTTP method, path, handler, guards, and source file for each endpoint.',
    {
      module: z
        .string()
        .optional()
        .describe('Filter by module/extension name (e.g., "iam/auth", "extensions/cms")'),
    },
    async ({ module }) => {
      const modules = await analyzeEndpoints(BACK_DIR);
      const filtered = module
        ? modules.filter((m) => {
            const rel = m.module.replace(/^(modules|extensions)\//, '');
            return rel === module || rel.startsWith(module + '/');
          })
        : modules;

      if (filtered.length === 0) {
        return textReply(`_No modules matched filter "${module ?? ''}"._\n`);
      }

      const sections = filtered.map((m) => {
        const header = `## \`${m.module}\``;
        const ctrlInfo = m.controllers
          .map((c) => {
            const tag = c.apiTag ? ` · @ApiTags(\`${c.apiTag}\`)` : '';
            const prefix = c.prefix ? `\`${c.prefix}\`` : '_(no prefix)_';
            return `- **${c.className}** — prefix: ${prefix}${tag} — \`${c.filePath.replace(/\\/g, '/').split('/apps/back/')[1] ?? c.filePath}\``;
          })
          .join('\n');
        const epTables = m.controllers
          .map((c) => `### ${c.className}\n\n${endpointsTable(c.endpoints)}`)
          .join('\n');
        return `${header}\n\n${ctrlInfo}\n\n${epTables}`;
      });

      const summary = `# Foundation Endpoints (${filtered.length} module${filtered.length === 1 ? '' : 's'})\n\n`;
      return textReply(summary + sections.join('\n---\n\n'));
    },
  );

  server.tool(
    'list_pages',
    'List all Nuxt pages, grouped by layer. Returns route, file path, layout, and middleware from definePageMeta.',
    {
      layer: z
        .string()
        .optional()
        .describe('Filter by layer (e.g., "root", "modules/base/auth", "extensions/cms")'),
    },
    async ({ layer }) => {
      const pages = await analyzePages(FRONT_DIR);
      const filtered = layer
        ? pages.filter((p) => p.layer === layer || p.layer.startsWith(layer + '/'))
        : pages;

      const header = `# Foundation Pages (${filtered.length})\n\n`;
      if (filtered.length === 0) {
        return textReply(header + `_No pages matched filter "${layer ?? ''}"._\n`);
      }
      return textReply(header + pagesTable(filtered));
    },
  );

  server.tool(
    'list_layouts',
    'List all Nuxt layouts across all layers (root, modules, extensions).',
    {},
    async () => {
      const layouts = await analyzeLayouts(FRONT_DIR);
      const header = `# Foundation Layouts (${layouts.length})\n\n`;
      return textReply(header + layoutsTable(layouts));
    },
  );

  server.tool(
    'find_endpoint',
    'Search endpoints by path, handler, or file path. Case-insensitive substring match.',
    {
      query: z
        .string()
        .min(1)
        .describe('Substring to search for (matches against path, handler, or file path)'),
      method: z
        .enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
        .optional()
        .describe('Optional HTTP method filter'),
    },
    async ({ query, method }) => {
      const modules = await analyzeEndpoints(BACK_DIR);
      const q = query.toLowerCase();

      const matched: Array<{ module: string; file: string; endpoint: Endpoint }> = [];
      for (const m of modules) {
        for (const c of m.controllers) {
          for (const e of c.endpoints) {
            if (method && e.method.toUpperCase() !== method.toUpperCase()) continue;
            const haystack = `${e.path} ${e.handler} ${c.filePath}`.toLowerCase();
            if (haystack.includes(q)) {
              matched.push({ module: m.module, file: c.filePath, endpoint: e });
            }
          }
        }
      }

      const header = `# Endpoint search: \`${query}\`${method ? ` [${method}]` : ''} (${matched.length})\n\n`;
      if (matched.length === 0) {
        return textReply(header + '_No matches._\n');
      }

      const rows = matched.map((m) => {
        const e = m.endpoint;
        const guards = e.guards.length > 0 ? e.guards.join(', ') : '—';
        const rel = m.file.replace(/\\/g, '/').split('/apps/back/')[1] ?? m.file;
        return `| \`${e.method.toUpperCase()}\` | \`${escapeCell(e.path)}\` | \`${e.handler}()\` | ${guards} | \`${m.module}\` | \`${escapeCell(rel)}\` |`;
      });

      const table = [
        '| Method | Path | Handler | Guards | Module | File |',
        '| --- | --- | --- | --- | --- | --- |',
        ...rows,
      ].join('\n');

      return textReply(header + table + '\n');
    },
  );

  server.tool(
    'find_page',
    'Search pages by route, file path, or layer. Case-insensitive substring match.',
    {
      query: z
        .string()
        .min(1)
        .describe('Substring to search for (matches against route, file path, or layer)'),
      layer: z
        .string()
        .optional()
        .describe('Optional layer filter'),
    },
    async ({ query, layer }) => {
      const pages = await analyzePages(FRONT_DIR);
      const q = query.toLowerCase();
      const filtered = pages.filter((p) => {
        if (layer && !(p.layer === layer || p.layer.startsWith(layer + '/'))) return false;
        const haystack = `${p.route} ${p.filePath} ${p.layer}`.toLowerCase();
        return haystack.includes(q);
      });

      const header = `# Page search: \`${query}\`${layer ? ` in \`${layer}\`` : ''} (${filtered.length})\n\n`;
      if (filtered.length === 0) {
        return textReply(header + '_No matches._\n');
      }
      return textReply(header + pagesTable(filtered));
    },
  );
}
