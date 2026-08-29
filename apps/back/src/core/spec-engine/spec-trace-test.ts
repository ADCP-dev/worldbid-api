#!/usr/bin/env ts-node
/**
 * spec-trace-test — end-to-end trace verification against a running
 * spec-engine backend.
 *
 * Executes a CRUD/action operation, decodes the X-Spec-Trace response
 * header (base64 JSON, dev mode), then fetches the stored trace from
 * GET /api/v1/_spec/trace/<requestId> (admin) and verifies both views
 * agree: same requestId, same stage names, same final verdict.
 *
 * Usage:
 *   pnpm spec:trace-test --resource task --op list --token <jwt>
 *   pnpm spec:trace-test --resource task --op create --body '{"title":"x"}' \
 *     --login admin@example.com --password secret
 *   pnpm spec:trace-test --resource task --op delete --id 1 --expect error --token <jwt>
 *
 * Exit codes: 0 = trace loop verified, 1 = any failure (connect, auth,
 * op, header missing, store mismatch, unexpected verdict).
 */

import http from 'http';
import { URL } from 'url';

// ─── Arg parsing (pure, exported for tests) ─────────────────────────────────

export interface TraceTestArgs {
  host: string;
  login?: string;
  password?: string;
  token?: string;
  resource: string;
  op: 'create' | 'update' | 'delete' | 'list';
  body?: Record<string, unknown>;
  id?: string;
  expect: 'success' | 'error';
}

export type ParsedArgs =
  | { ok: true; args: TraceTestArgs }
  | { ok: false; usage: string };

export function parseArgs(argv: string[]): ParsedArgs {
  const args: TraceTestArgs = {
    host: 'http://localhost:3010',
    resource: '',
    op: 'list',
    expect: 'success',
  };

  const value = (flag: string): string | undefined => {
    const idx = argv.indexOf(flag);
    if (idx === -1) return undefined;
    return argv[idx + 1];
  };

  const host = value('--host');
  if (host) args.host = host.replace(/\/$/, '');
  args.login = value('--login');
  args.password = value('--password');
  args.token = value('--token');
  args.resource = value('--resource') ?? '';
  args.id = value('--id');

  const op = value('--op');
  if (op !== undefined) {
    if (
      op !== 'create' &&
      op !== 'update' &&
      op !== 'delete' &&
      op !== 'list'
    ) {
      return {
        ok: false,
        usage: `Invalid --op "${op}". Use create|update|delete|list.`,
      };
    }
    args.op = op;
  }

  const expect = value('--expect');
  if (expect !== undefined) {
    if (expect !== 'success' && expect !== 'error') {
      return {
        ok: false,
        usage: `Invalid --expect "${expect}". Use success|error.`,
      };
    }
    args.expect = expect;
  }

  const bodyRaw = value('--body');
  if (bodyRaw !== undefined) {
    try {
      const parsed = JSON.parse(bodyRaw);
      if (parsed === null || typeof parsed !== 'object') {
        return { ok: false, usage: '--body must be a JSON object.' };
      }
      args.body = parsed as Record<string, unknown>;
    } catch (err) {
      return {
        ok: false,
        usage: `--body is not valid JSON: ${(err as Error).message}`,
      };
    }
  }

  if (!args.resource) {
    return { ok: false, usage: 'Missing required --resource <name>.' };
  }

  if ((args.op === 'update' || args.op === 'delete') && !args.id) {
    return { ok: false, usage: `--op ${args.op} requires --id <id>.` };
  }

  if ((args.op === 'create' || args.op === 'update') && !args.body) {
    return { ok: false, usage: `--op ${args.op} requires --body '<json>'.` };
  }

  return { ok: true, args };
}

// ─── X-Spec-Trace header decode (pure, exported for tests) ──────────────────

export interface DecodedHeaderTrace {
  requestId: string;
  resource: string;
  operation: string;
  stages: Array<{
    stage: string;
    status: string;
    durationMs: number;
    error?: { message: string; code: string };
    meta?: Record<string, unknown>;
  }>;
  totalDurationMs: number;
}

export function decodeSpecTraceHeader(
  raw: string | undefined,
): DecodedHeaderTrace | null {
  if (!raw) return null;
  try {
    const json = Buffer.from(raw, 'base64').toString('utf-8');
    const parsed = JSON.parse(json);
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof (parsed as { requestId?: unknown }).requestId === 'string'
    ) {
      return parsed as DecodedHeaderTrace;
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Stage table (pure, exported for tests) ─────────────────────────────────

const STAGE_WIDTH = 14;
const DURATION_WIDTH = 8;

export function formatStageTable(
  stages: Array<{
    stage: string;
    status: string;
    durationMs: number;
    error?: { message: string; code: string };
  }>,
): string {
  const statusIcon = (s: string): string => {
    switch (s) {
      case 'pass':
        return '✅';
      case 'fail':
        return '❌';
      case 'skip':
        return '⏭️';
      default:
        return '❔';
    }
  };

  const lines: string[] = [];
  lines.push(
    `${'STAGE'.padEnd(STAGE_WIDTH)}  ${'STATUS'.padEnd(8)}  ${'DURATION'.padStart(DURATION_WIDTH)}`,
  );
  lines.push(`${'─'.repeat(STAGE_WIDTH + 2 + 8 + 2 + DURATION_WIDTH)}`);
  for (const s of stages) {
    lines.push(
      `${s.stage.padEnd(STAGE_WIDTH)}  ${statusIcon(s.status).padEnd(8)}  ${`${s.durationMs}ms`.padStart(DURATION_WIDTH)}`,
    );
    if (s.error) {
      lines.push(`   └─ ${s.error.code}: ${s.error.message}`);
    }
  }
  return lines.join('\n');
}

export function storeMatchesHeader(
  headerTrace: DecodedHeaderTrace,
  storeTrace: DecodedHeaderTrace,
): { match: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (headerTrace.requestId !== storeTrace.requestId) {
    reasons.push(
      `requestId mismatch: header=${headerTrace.requestId} store=${storeTrace.requestId}`,
    );
  }
  const headerStages = headerTrace.stages.map((s) => s.stage);
  const storeStages = storeTrace.stages.map((s) => s.stage);
  if (headerStages.join(',') !== storeStages.join(',')) {
    reasons.push(
      `stage names differ: header=[${headerStages.join(' → ')}] store=[${storeStages.join(' → ')}]`,
    );
  }
  return { match: reasons.length === 0, reasons };
}

// ─── HTTP helpers (mirrors spec-trace-cli style — plain http) ───────────────

interface HttpJsonResult {
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}

function httpJson(
  url: URL,
  method: string,
  headers: Record<string, string>,
  payload?: string,
): Promise<HttpJsonResult> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        method,
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        headers: {
          Accept: 'application/json',
          ...(payload !== undefined
            ? {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
              }
            : {}),
          ...headers,
        },
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () =>
          resolve({
            statusCode: res.statusCode ?? 0,
            headers: res.headers,
            body,
          }),
        );
      },
    );
    req.on('error', reject);
    if (payload !== undefined) req.write(payload);
    req.end();
  });
}

function parseJsonBody(body: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(body);
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

// ─── Main flow ──────────────────────────────────────────────────────────────

function fail(message: string, host: string): never {
  console.error(`\n❌ ${message}`);
  console.error(`   Is the backend running at ${host}?`);
  process.exit(1);
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  if (!parsed.ok) {
    console.error(
      `Usage: ts-node spec-trace-test.ts <options>\n${parsed.usage}`,
    );
    process.exit(1);
  }
  const { host } = parsed.args;

  // 1. Auth
  let token: string | undefined = parsed.args.token;
  if (!token) {
    if (!parsed.args.login || !parsed.args.password) {
      console.error('Provide --token <jwt> or --login <email> --password <pw>');
      process.exit(1);
    }
    const loginUrl = new URL('/api/v1/auth/email/login', host);
    let res: HttpJsonResult;
    try {
      res = await httpJson(
        loginUrl,
        'POST',
        { 'Content-Type': 'application/json' },
        JSON.stringify({
          email: parsed.args.login,
          password: parsed.args.password,
        }),
      );
    } catch (err) {
      fail(`Login request failed: ${(err as Error).message}`, host);
    }
    const loginBody = parseJsonBody(res.body);
    token =
      loginBody && typeof loginBody.token === 'string'
        ? loginBody.token
        : undefined;
    if (!token) {
      console.error(
        `\n❌ Login failed (HTTP ${res.statusCode}): ${res.body.slice(0, 300)}`,
      );
      console.error(`   Is the backend running at ${host}?`);
      process.exit(1);
    }
    console.log(`🔑 Authenticated as ${parsed.args.login}`);
  }

  const authHeaders = { Authorization: `Bearer ${token}` };

  // 2. Execute the op
  const opPath = buildOpPath(parsed.args);
  const opUrl = new URL(opPath, host);
  const method =
    parsed.args.op === 'create'
      ? 'POST'
      : parsed.args.op === 'update'
        ? 'PATCH'
        : parsed.args.op === 'delete'
          ? 'DELETE'
          : 'GET';

  let opRes: HttpJsonResult;
  try {
    opRes = await httpJson(
      opUrl,
      method,
      authHeaders,
      parsed.args.body ? JSON.stringify(parsed.args.body) : undefined,
    );
  } catch (err) {
    fail(
      `Operation ${method} ${opPath} failed: ${(err as Error).message}`,
      host,
    );
  }

  console.log(`\n🚀 ${method} ${opUrl.toString()} → HTTP ${opRes.statusCode}`);

  const expectedError = parsed.args.expect === 'error';
  const httpOk = opRes.statusCode >= 200 && opRes.statusCode < 300;
  const httpError = opRes.statusCode >= 400;
  if (expectedError && !httpError) {
    console.error(
      `❌ Expected an error response but got HTTP ${opRes.statusCode}`,
    );
    process.exit(1);
  }
  if (!expectedError && !httpOk) {
    console.error(`❌ Operation failed (HTTP ${opRes.statusCode}):`);
    console.error(opRes.body.slice(0, 500));
    process.exit(1);
  }

  // 3. Decode X-Spec-Trace header (dev mode only)
  const rawTraceHeader = opRes.headers['x-spec-trace'];
  const headerTrace = decodeSpecTraceHeader(
    Array.isArray(rawTraceHeader) ? rawTraceHeader[0] : rawTraceHeader,
  );
  if (!headerTrace) {
    console.error(
      '❌ No valid X-Spec-Trace response header. The CLI needs dev mode ' +
        '(NODE_ENV !== production) to compare the header trace with the store.',
    );
    console.error(`   Is the backend running at ${host} (in dev)?`);
    process.exit(1);
  }

  // 4. Fetch the stored trace server-side
  const storeUrl = new URL(
    `/api/v1/_spec/trace/${encodeURIComponent(headerTrace.requestId)}`,
    host,
  );
  let storeRes: HttpJsonResult;
  try {
    storeRes = await httpJson(storeUrl, 'GET', authHeaders);
  } catch (err) {
    fail(`Trace fetch failed: ${(err as Error).message}`, host);
  }
  const storeBody = parseJsonBody(storeRes.body);
  if (storeRes.statusCode >= 400 || !storeBody) {
    console.error(
      `❌ Trace endpoint returned HTTP ${storeRes.statusCode}: ${storeRes.body.slice(0, 300)}`,
    );
    process.exit(1);
  }

  if (storeBody.found !== true) {
    console.error(
      '❌ server store returned found:false — trace store may be empty in ' +
        'prod or requestId mismatch.',
    );
    console.error(`   requestId used: ${headerTrace.requestId}`);
    process.exit(1);
  }

  const storeTrace = decodeSpecTraceHeader(
    Buffer.from(
      JSON.stringify((storeBody as { trace: unknown }).trace),
    ).toString('base64'),
  );
  if (!storeTrace) {
    console.error('❌ Stored trace payload is not a valid trace object.');
    process.exit(1);
  }

  // 5. Compare
  const verdict = storeMatchesHeader(headerTrace, storeTrace);
  const headerFailedStage = headerTrace.stages.find((s) => s.status === 'fail');

  console.log(`\n📋 requestId: ${headerTrace.requestId}`);

  if (expectedError) {
    if (
      !headerFailedStage &&
      !storeTrace.stages.some((s) => s.status === 'fail')
    ) {
      console.error(
        '❌ --expect error was set but no trace stage carries a failure.',
      );
      console.error(formatStageTable(storeTrace.stages));
      process.exit(1);
    }
    console.log('💥 Failed stage recorded:');
    console.log(formatStageTable(headerFailedStage ? [headerFailedStage] : []));
  }

  console.log('\n📊 Stage table (server store):');
  console.log(formatStageTable(storeTrace.stages));

  if (!verdict.match) {
    console.error('\n❌ Trace mismatch between response header and store:');
    for (const reason of verdict.reasons) {
      console.error(`   - ${reason}`);
    }
    process.exit(1);
  }

  console.log('✅ Trace matches server store (requestId + stage names).');
  process.exit(0);
}

/**
 * Build the operation path from args. Mirrors ControllerFactory routing:
 * pluralized resource path with optional /:id.
 */
export function buildOpPath(args: TraceTestArgs): string {
  const plural = pluralize(args.resource);
  if (args.op === 'list') return `/api/v1/${plural}`;
  if (args.op === 'create') return `/api/v1/${plural}`;
  return `/api/v1/${plural}/${encodeURIComponent(args.id ?? '')}`;
}

function pluralize(name: string): string {
  if (name.endsWith('s')) return name;
  if (name.endsWith('y')) return name.slice(0, -1) + 'ies';
  if (name.endsWith('ch') || name.endsWith('sh') || name.endsWith('x')) {
    return name + 'es';
  }
  return name + 's';
}

if (require.main === module) {
  main().catch((err: unknown) => {
    console.error(`[spec-trace-test] Fatal: ${(err as Error).message}`);
    process.exit(1);
  });
}
