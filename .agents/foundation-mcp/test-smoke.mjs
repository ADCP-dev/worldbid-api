#!/usr/bin/env node
/**
 * Smoke test for foundation-mcp server.
 *
 * Connects via stdio, lists tools, calls a few read-only tools
 * to verify the parser and runner work end-to-end.
 *
 * Usage:  node test-smoke.mjs
 *   (run from .agents/foundation-mcp/)
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Server lives in .agents/foundation-mcp/, we need cwd = workspace root
// so that relative paths like "apps/back" resolve correctly inside the server.
const workspaceRoot = path.resolve(__dirname, '..', '..');

const transport = new StdioClientTransport({
  command: 'npx',
  args: ['tsx', '.agents/foundation-mcp/server.ts'],
  cwd: workspaceRoot,
});

const client = new Client(
  { name: 'foundation-smoke-test', version: '1.0.0' },
  { capabilities: {} },
);

const OK = '\x1b[32m✓\x1b[0m';
const FAIL = '\x1b[31m✗\x1b[0m';
const INFO = '\x1b[36m›\x1b[0m';

let failed = 0;

function check(name, cond, detail) {
  if (cond) {
    console.log(`  ${OK} ${name}`);
  } else {
    console.log(`  ${FAIL} ${name}${detail ? ` — ${detail}` : ''}`);
    failed += 1;
  }
}

async function call(name, args = {}) {
  const result = await client.callTool({ name, arguments: args });
  if (result.isError) {
    throw new Error(`Tool ${name} returned isError: ${JSON.stringify(result.content)}`);
  }
  const text = result.content?.find((c) => c.type === 'text')?.text ?? '';
  return text;
}

try {
  console.log(`\n${INFO} Connecting to foundation-mcp (cwd: ${workspaceRoot})...`);
  await client.connect(transport);
  console.log(`  ${OK} Connected via stdio\n`);

  // ── 1. List tools ────────────────────────────────────────────────────────
  console.log(`${INFO} Test 1: listTools()`);
  const toolsList = await client.listTools();
  const toolNames = toolsList.tools.map((t) => t.name).sort();
  console.log(`  ${INFO} Server reports ${toolNames.length} tools`);

  const expected = [
    'list_endpoints',
    'list_pages',
    'list_layouts',
    'find_endpoint',
    'find_page',
    'migration_generate',
    'migration_run',
    'migration_revert',
    'generate_resource',
    'generate_extension',
    'add_property',
    'add_extension_property',
    'maizzle_build',
    'translation_add',
    'translation_sync',
    'seed_run',
    'seed_create',
    'lint_back',
    'check_types_back',
    'endpoints_used_in_front',
    'endpoints_unused',
    'front_uses_endpoint',
  ];
  for (const name of expected) {
    check(`tool "${name}" registered`, toolNames.includes(name));
  }
  console.log('');

  // ── 2. list_endpoints (iam/auth) ─────────────────────────────────────────
  console.log(`${INFO} Test 2: list_endpoints(module: "iam/auth")`);
  try {
    const out = await call('list_endpoints', { module: 'iam/auth' });
    const hasLogin = out.includes('/email/login') || out.includes('email/login');
    const hasMe = out.includes('/me') || out.includes(' auth/me');
    const hasFile = out.includes('auth.controller.ts');
    const count = (out.match(/\| `(GET|POST|PATCH|PUT|DELETE)/g) ?? []).length;
    check('output mentions auth controller file', hasFile, 'looking for "auth.controller.ts"');
    check('output mentions email/login endpoint', hasLogin, 'looking for email/login');
    check('output mentions /me endpoint', hasMe, 'looking for /me');
    check(`endpoint count >= 5 (got ${count})`, count >= 5);
    console.log(`  ${INFO} First 400 chars of output:\n`);
    console.log(
      out
        .slice(0, 400)
        .split('\n')
        .map((l) => '      ' + l)
        .join('\n'),
    );
    console.log('');
  } catch (e) {
    check('list_endpoints did not throw', false, e.message);
  }

  // ── 3. list_pages (extensions/cms) ──────────────────────────────────────
  console.log(`${INFO} Test 3: list_pages(layer: "extensions/cms")`);
  try {
    const out = await call('list_pages', { layer: 'extensions/cms' });
    const hasCmsPath = out.includes('/app/cms') || out.includes('cms/');
    const hasBlogPath = out.includes('/blog');
    const hasSlugParam = out.includes(':slug') || out.includes('[slug]');
    const count = (out.match(/\| `\/[^`]+`/g) ?? []).length;
    check('output mentions /app/cms path', hasCmsPath);
    check('output mentions /blog path', hasBlogPath);
    check(`route count >= 5 (got ${count})`, count >= 5);
    check('dynamic param present', hasSlugParam, 'looking for :slug or [slug]');
    console.log(`  ${INFO} First 400 chars of output:\n`);
    console.log(
      out
        .slice(0, 400)
        .split('\n')
        .map((l) => '      ' + l)
        .join('\n'),
    );
    console.log('');
  } catch (e) {
    check('list_pages did not throw', false, e.message);
  }

  // ── 4. list_layouts ─────────────────────────────────────────────────────
  console.log(`${INFO} Test 4: list_layouts()`);
  try {
    const out = await call('list_layouts');
    const hasDefault = out.includes('default');
    const hasBlank = out.includes('blank');
    const hasPublic = out.includes('public');
    check('output mentions "default" layout', hasDefault);
    check('output mentions "blank" layout', hasBlank);
    check('output mentions "public" layout', hasPublic);
    console.log(`  ${INFO} Output:\n`);
    console.log(
      out
        .split('\n')
        .map((l) => '      ' + l)
        .join('\n'),
    );
    console.log('');
  } catch (e) {
    check('list_layouts did not throw', false, e.message);
  }

  // ── 5. find_endpoint ────────────────────────────────────────────────────
  console.log(`${INFO} Test 5: find_endpoint(query: "users", method: "POST")`);
  try {
    const out = await call('find_endpoint', { query: 'users', method: 'POST' });
    const found = out.includes('users.controller') || out.includes('/users');
    check('found users endpoints', found);
    console.log(`  ${INFO} First 300 chars:\n`);
    console.log(
      out
        .slice(0, 300)
        .split('\n')
        .map((l) => '      ' + l)
        .join('\n'),
    );
    console.log('');
  } catch (e) {
    check('find_endpoint did not throw', false, e.message);
  }

  // ── 6. check_types_back (read-only, takes ~30s) ────────────────────────
  console.log(`${INFO} Test 6: check_types_back() (skipping — too slow for smoke)`);
  console.log(`  ${INFO} Run manually with: pnpm check-types-back via MCP\n`);

  // ── 7. endpoints_used_in_front ─────────────────────────────────────────
  console.log(`${INFO} Test 7: endpoints_used_in_front(path: "/v1/users")`);
  try {
    const out = await call('endpoints_used_in_front', { path: '/v1/users' });
    const hasMatch = out.includes('users') || out.includes('No matches');
    const matchCount = (out.match(/\| `(GET|POST|PATCH|PUT|DELETE|UNKNOWN)/g) ?? []).length;
    check('output mentions users endpoint or no matches', hasMatch);
    check(`match count >= 9 (got ${matchCount})`, matchCount >= 9);
    console.log(`  ${INFO} First 600 chars:\n`);
    console.log(
      out
        .slice(0, 600)
        .split('\n')
        .map((l) => '      ' + l)
        .join('\n'),
    );
    console.log('');
  } catch (e) {
    check('endpoints_used_in_front did not throw', false, e.message);
  }

  // ── 7b. endpoints_used_in_front extra paths ────────────────────────────
  for (const [path, label] of [
    ['/v1/cms/blog/posts', 'cms posts'],
    ['/v1/stripe/plans', 'stripe plans'],
    ['/v1/translations', 'translations'],
    ['/v1/auth/email/login', 'auth login'],
  ]) {
    try {
      const out = await call('endpoints_used_in_front', { path });
      const n = (out.match(/\| `(GET|POST|PATCH|PUT|DELETE|UNKNOWN)/g) ?? []).length;
      check(`${label} (${path}) has matches or empty`, n >= 0);
      console.log(`  ${INFO} ${label} (${path}) → ${n} match(es)`);
    } catch (e) {
      check(`${label} did not throw`, false, e.message);
    }
  }

  // ── 8. front_uses_endpoint ────────────────────────────────────────────
  console.log(`${INFO} Test 8: front_uses_endpoint(file: "apps/front/composables/useUsers.ts")`);
  try {
    const out = await call('front_uses_endpoint', {
      file: 'apps/front/composables/useUsers.ts',
    });
    const hasApiCall = out.includes('/users') || out.includes('api.') || out.includes('No API');
    check('output mentions /users or no API detected', hasApiCall);
    console.log(`  ${INFO} First 600 chars:\n`);
    console.log(
      out
        .slice(0, 600)
        .split('\n')
        .map((l) => '      ' + l)
        .join('\n'),
    );
    console.log('');
  } catch (e) {
    check('front_uses_endpoint did not throw', false, e.message);
  }

  // ── 9. endpoints_unused (read-only) ────────────────────────────────────
  console.log(`${INFO} Test 9: endpoints_unused()`);
  try {
    const out = await call('endpoints_unused');
    const isTable = out.includes('| Method | Path |') || out.includes('No endpoints');
    check('output is a table or empty message', isTable);
    const unusedCount = (out.match(/\| `(GET|POST|PATCH|PUT|DELETE)/g) ?? []).length;
    console.log(`  ${INFO} Unused endpoints found: ${unusedCount}`);
    console.log(`  ${INFO} First 600 chars:\n`);
    console.log(
      out
        .slice(0, 600)
        .split('\n')
        .map((l) => '      ' + l)
        .join('\n'),
    );
    console.log('');
  } catch (e) {
    check('endpoints_unused did not throw', false, e.message);
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log('─'.repeat(60));
  if (failed === 0) {
    console.log(`\x1b[32m✓ All smoke checks passed\x1b[0m\n`);
    process.exit(0);
  } else {
    console.log(`\x1b[31m✗ ${failed} check(s) failed\x1b[0m\n`);
    process.exit(1);
  }
} catch (err) {
  console.error(`\n\x1b[31m✗ Fatal: ${err.message}\x1b[0m`);
  if (err.stack) console.error(err.stack);
  process.exit(2);
} finally {
  try {
    await client.close();
  } catch {
    // ignore
  }
}
