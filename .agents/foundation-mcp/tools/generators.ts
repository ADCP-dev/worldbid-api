import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { runPnpmScript, formatRunResult, type RunResult } from './_runner.js';

const BACK_CWD = 'apps/back';

function reply(result: RunResult, title: string) {
  return { content: [{ type: 'text' as const, text: formatRunResult(result, title) }] };
}

const PropertyKindSchema = z.enum(['primitive', 'reference']);

const NullableFlagSchema = z
  .boolean()
  .optional()
  .describe('Whether the new column allows NULL. Adds `--nullable` to hygen.');

export function registerGeneratorTools(server: McpServer): void {
  server.tool(
    'generate_resource',
    'Scaffold a full CRUD resource module (domain, dto, entity, repository, controller, service). Runs `pnpm generate:resource` in apps/back with `-- --name=<name> --destination=custom`. Name must be PascalCase (e.g., "Product"). Destination is always `custom` to avoid the hygen interactive prompt that hangs in non-TTY environments.',
    {
      name: z
        .string()
        .min(1)
        .describe('PascalCase resource name (e.g., "Product", "OrderItem")'),
    },
    async ({ name }) => {
      const args = [`--name=${name}`, `--destination=custom`];
      const result = await runPnpmScript('generate:resource', args, {
        cwd: BACK_CWD,
      });
      return reply(result, `generate:resource ${args.join(' ')}`);
    },
  );

  server.tool(
    'generate_extension',
    'Scaffold a full CRUD extension module. Auto-discovered by the ExtensionLoaderModule. Runs `pnpm generate:extension` in apps/back with `-- --name=<name>`. Name must be PascalCase (e.g., "Blog").',
    {
      name: z
        .string()
        .min(1)
        .describe('PascalCase extension name (e.g., "Blog", "Newsletter")'),
    },
    async ({ name }) => {
      const result = await runPnpmScript('generate:extension', [`--name=${name}`], {
        cwd: BACK_CWD,
      });
      return reply(result, `generate:extension --name=${name}`);
    },
  );

  server.tool(
    'add_property',
    'Add a new column to an existing resource. Updates entity, domain object, and DTOs. Runs `pnpm add:property` in apps/back. NOTE: the hygen template reads `isAddToDto`/`isOptional`/`isNullable` (not `nullable`) — the tool maps the `nullable` boolean to `--isNullable=true|false` and forces `--isAddToDto=true --isOptional=true` so DTOs are always updated. `kind=reference` is partially supported (template needs `referenceType` + `propertyInReference` which this tool does not expose).',
    {
      resource: z
        .string()
        .min(1)
        .describe('PascalCase resource name (e.g., "User", "Product")'),
      property: z
        .string()
        .min(1)
        .describe('Property name in camelCase (e.g., "email", "price")'),
      kind: PropertyKindSchema.describe(
        '"primitive" for scalar types, "reference" for relations',
      ),
      type: z
        .string()
        .min(1)
        .describe('Type name (e.g., "string", "number", "boolean", "User", "Role")'),
      nullable: NullableFlagSchema,
    },
    async ({ resource, property, kind, type, nullable }) => {
      const args = [
        `--name=${resource}`,
        `--property=${property}`,
        `--kind=${kind}`,
        `--type=${type}`,
        '--isAddToDto=true',
        '--isOptional=true',
        `--isNullable=${nullable === true ? 'true' : 'false'}`,
      ];

      const result = await runPnpmScript('add:property', args, { cwd: BACK_CWD });
      return reply(result, `add:property ${args.join(' ')}`);
    },
  );

  server.tool(
    'add_extension_property',
    'Add a new column to an existing extension resource. Runs `pnpm add:extension-property` in apps/back. Same DTO/optional/nullable flag mapping as `add_property`.',
    {
      resource: z
        .string()
        .min(1)
        .describe('PascalCase extension resource name (e.g., "Post", "Category")'),
      property: z
        .string()
        .min(1)
        .describe('Property name in camelCase (e.g., "slug", "publishedAt")'),
      kind: PropertyKindSchema.describe(
        '"primitive" for scalar types, "reference" for relations',
      ),
      type: z
        .string()
        .min(1)
        .describe('Type name (e.g., "string", "Date", "User")'),
      nullable: NullableFlagSchema,
    },
    async ({ resource, property, kind, type, nullable }) => {
      const args = [
        `--name=${resource}`,
        `--property=${property}`,
        `--kind=${kind}`,
        `--type=${type}`,
        '--isAddToDto=true',
        '--isOptional=true',
        `--isNullable=${nullable === true ? 'true' : 'false'}`,
      ];

      const result = await runPnpmScript('add:extension-property', args, {
        cwd: BACK_CWD,
      });
      return reply(result, `add:extension-property ${args.join(' ')}`);
    },
  );
}
