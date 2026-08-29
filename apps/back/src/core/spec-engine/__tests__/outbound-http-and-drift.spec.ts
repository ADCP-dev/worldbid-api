/**
 * Outbound HTTP robustness (E) + schema drift detection (F).
 *
 * E: AbortSignal timeout on every outbound fetch, per-webhook HMAC secret
 *    precedence (spec → env → unsigned + warn-once), bounded WARN logs on
 *    failure.
 * F: stable spec hashing + first-boot insert + drift warn/block/off modes.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  postJsonWithTimeout,
  resolveWebhookSecret,
  resetWarnedSecretsForTest,
  getWebhookTimeoutMs,
  safeHost,
} from '@src/core/spec-engine/outbound-http';
import {
  stableStringify,
  computeSchemaHashForTest,
  resolveDriftMode,
  runSchemaDriftCheck,
  DriftDetectedError,
} from '@src/core/spec-engine/spec-schema-drift';
import type { LoadedSpec } from '@src/core/spec-engine/spec-loader';

// ─── E. outbound-http ────────────────────────────────────────────────────────

describe('outbound-http — postJsonWithTimeout (E)', () => {
  const ORIGINAL_ENV = process.env.SPEC_ENGINE_WEBHOOK_TIMEOUT_MS;

  afterEach(() => {
    vi.restoreAllMocks();
    if (ORIGINAL_ENV === undefined)
      delete process.env.SPEC_ENGINE_WEBHOOK_TIMEOUT_MS;
    else process.env.SPEC_ENGINE_WEBHOOK_TIMEOUT_MS = ORIGINAL_ENV;
  });

  it('should pass an AbortSignal timeout in the fetch init', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue({ ok: true, status: 200 } as Response);

    await postJsonWithTimeout({
      url: 'https://example.com/hook',
      body: '{}',
      headers: { 'Content-Type': 'application/json' },
      name: 'test-webhook',
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('should read the timeout from SPEC_ENGINE_WEBHOOK_TIMEOUT_MS', () => {
    process.env.SPEC_ENGINE_WEBHOOK_TIMEOUT_MS = '2500';
    expect(getWebhookTimeoutMs()).toBe(2500);
  });

  it('should fall back to the 10s default on unset/invalid timeout', () => {
    delete process.env.SPEC_ENGINE_WEBHOOK_TIMEOUT_MS;
    expect(getWebhookTimeoutMs()).toBe(10_000);
    process.env.SPEC_ENGINE_WEBHOOK_TIMEOUT_MS = 'not-a-number';
    expect(getWebhookTimeoutMs()).toBe(10_000);
    process.env.SPEC_ENGINE_WEBHOOK_TIMEOUT_MS = '-1';
    expect(getWebhookTimeoutMs()).toBe(10_000);
  });

  it('should log bounded detail (host + error name) on fetch failure', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(
        new Error('ECONNREFUSED with super-secret-token inside'),
      );
    const loggerSpy = vi
      .spyOn((await import('@nestjs/common')).Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    const result = await postJsonWithTimeout({
      url: 'https://secret-host.example.com/hook',
      body: '{"payload":"secret-body"}',
      headers: {},
      name: 'w',
    });

    expect(result.ok).toBe(false);
    expect(fetchSpy).toHaveBeenCalled();
    const logged = loggerSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(logged).toContain('secret-host.example.com');
    // Never leak env vars or the request body.
    expect(logged).not.toContain('secret-body');
  });

  it('should log the HTTP status on non-2xx (bounded detail)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 503,
    } as Response);
    const loggerSpy = vi
      .spyOn((await import('@nestjs/common')).Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    const result = await postJsonWithTimeout({
      url: 'https://example.com/x',
      body: '{}',
      headers: {},
      name: 'w',
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(503);
    const logged = loggerSpy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(logged).toContain('503');
  });
});

describe('outbound-http — resolveWebhookSecret (E.2 per-webhook secret)', () => {
  beforeEach(() => {
    resetWarnedSecretsForTest();
  });

  it('should prefer the per-webhook spec secret over the env fallback', () => {
    const resolved = resolveWebhookSecret({
      webhookKey: 'k1',
      webhookName: 'w1',
      specSecret: 'spec-secret',
      envSecret: 'env-secret',
    });
    expect(resolved.signed).toBe(true);
    expect(resolved.secret).toBe('spec-secret');
  });

  it('should fall back to the env secret when no spec secret is declared', () => {
    const resolved = resolveWebhookSecret({
      webhookKey: 'k2',
      webhookName: 'w2',
      specSecret: null,
      envSecret: 'env-secret',
    });
    expect(resolved.signed).toBe(true);
    expect(resolved.secret).toBe('env-secret');
  });

  it('should warn ONCE per webhook when no secret exists (unsigned delivery)', async () => {
    const loggerSpy = vi
      .spyOn((await import('@nestjs/common')).Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    const first = resolveWebhookSecret({
      webhookKey: 'k3',
      webhookName: 'w3',
      specSecret: null,
      envSecret: null,
    });
    const second = resolveWebhookSecret({
      webhookKey: 'k3',
      webhookName: 'w3',
      specSecret: null,
      envSecret: null,
    });

    expect(first.signed).toBe(false);
    expect(first.secret).toBeNull();
    expect(second.signed).toBe(false);
    const warnCount = loggerSpy.mock.calls.filter((c) =>
      c.join(' ').includes('w3'),
    ).length;
    expect(warnCount).toBe(1);
  });
});

describe('safeHost', () => {
  it('extracts only the host', () => {
    expect(safeHost('https://user:pass@host.example.com/p?q=1')).toBe(
      'host.example.com',
    );
  });

  it('never throws on garbage', () => {
    expect(safeHost('not a url')).toBe('<invalid-url>');
  });
});

// ─── F. schema drift ─────────────────────────────────────────────────────────

describe('spec-schema-drift — hashing (F)', () => {
  function makeSpec(resources: Record<string, unknown>[]) {
    return {
      spec: { name: 'demo', version: '1.0.0', resources },
      dir: '/tmp/demo',
      specPath: '/tmp/demo/demo.spec.yaml',
    } as unknown as LoadedSpec;
  }

  it('should produce the same hash for key-order-different equivalent specs', () => {
    const a = makeSpec([
      { name: 't', fields: [{ name: 'x', type: 'string' }] },
    ]);
    const b = makeSpec([
      { fields: [{ type: 'string', name: 'x' }], name: 't' },
    ]);
    expect(computeSchemaHashForTest(a)).toBe(computeSchemaHashForTest(b));
  });

  it('should change the hash when the spec content changes', () => {
    const a = makeSpec([
      { name: 't', fields: [{ name: 'x', type: 'string' }] },
    ]);
    const b = makeSpec([
      {
        name: 't',
        fields: [
          { name: 'x', type: 'string' },
          { name: 'y', type: 'integer' },
        ],
      },
    ]);
    expect(computeSchemaHashForTest(a)).not.toBe(computeSchemaHashForTest(b));
  });

  it('stableStringify sorts keys recursively and drops undefined', () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(stableStringify({ z: { b: 1, a: 2 }, y: undefined })).toBe(
      '{"z":{"a":2,"b":1}}',
    );
  });
});

describe('spec-schema-drift — boot behavior (F)', () => {
  const ORIGINAL_ENV_NODE = process.env.NODE_ENV;
  const ORIGINAL_ENV_DRIFT = process.env.SPEC_ENGINE_DRIFT;

  function makeDataSource(storedHash: string | null) {
    const queries: Array<{ sql: string; params: unknown[] }> = [];
    return {
      queries,
      async query(sql: string, params: unknown[] = []) {
        queries.push({ sql, params });
        if (/CREATE TABLE IF NOT EXISTS/i.test(sql)) return [];
        if (/FROM spec_schema_version WHERE/i.test(sql)) {
          return storedHash ? [{ schemaHash: storedHash }] : [];
        }
        return [];
      },
    } as never;
  }

  const loaded = (name = 'demo') =>
    ({
      spec: { name, version: '1.0.0', resources: [{ name: 'r', fields: [] }] },
      dir: `/tmp/${name}`,
      specPath: `/tmp/${name}/x.spec.yaml`,
    }) as unknown as LoadedSpec;

  afterEach(() => {
    if (ORIGINAL_ENV_NODE === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = ORIGINAL_ENV_NODE;
    if (ORIGINAL_ENV_DRIFT === undefined) delete process.env.SPEC_ENGINE_DRIFT;
    else process.env.SPEC_ENGINE_DRIFT = ORIGINAL_ENV_DRIFT;
  });

  it('should insert the hash on first boot (no stored row)', async () => {
    process.env.NODE_ENV = 'production';
    const warnSpy = vi
      .spyOn((await import('@nestjs/common')).Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const warnSpyErr = vi
      .spyOn((await import('@nestjs/common')).Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    const ds = makeDataSource(null);
    const outcomes = await runSchemaDriftCheck([loaded()], ds);

    expect(outcomes[0].status).toBe('created');
    // CREATE TABLE + INSERT executed.
    const inserts = (
      ds as never as { queries: Array<{ sql: string }> }
    ).queries.filter((q) => /INSERT INTO spec_schema_version/i.test(q.sql));
    expect(inserts.length).toBe(1);
    void warnSpy;
    void warnSpyErr;
  });

  it('should WARN (not throw) on drift in non-production', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.SPEC_ENGINE_DRIFT;
    const warnSpy = vi
      .spyOn((await import('@nestjs/common')).Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    const ds = makeDataSource('deadbeef');
    const outcomes = await runSchemaDriftCheck([loaded()], ds);

    expect(outcomes[0].status).toBe('drift');
    const driftWarn = warnSpy.mock.calls.find((c) =>
      c.join(' ').includes('Schema drift detected'),
    );
    expect(driftWarn).toBeDefined();
  });

  it('should THROW on drift when mode is block (production default)', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.SPEC_ENGINE_DRIFT;
    vi.spyOn(
      (await import('@nestjs/common')).Logger.prototype,
      'error',
    ).mockImplementation(() => undefined);

    const ds = makeDataSource('stale-hash');
    await expect(runSchemaDriftCheck([loaded()], ds)).rejects.toThrow(
      DriftDetectedError,
    );
  });

  it('should disable everything with SPEC_ENGINE_DRIFT=off', async () => {
    process.env.NODE_ENV = 'production';
    process.env.SPEC_ENGINE_DRIFT = 'off';
    const ds = makeDataSource('stale-hash');
    const outcomes = await runSchemaDriftCheck([loaded()], ds);
    expect(outcomes[0].status).toBe('off');
    expect((ds as never as { queries: unknown[] }).queries.length).toBe(0);
  });

  it('should not throw on internal DB errors (fail open)', async () => {
    process.env.NODE_ENV = 'production';
    process.env.SPEC_ENGINE_DRIFT = 'block';
    vi.spyOn(
      (await import('@nestjs/common')).Logger.prototype,
      'warn',
    ).mockImplementation(() => undefined);

    const failingDs = {
      async query() {
        throw new Error('db unreachable');
      },
    } as never;
    const outcomes = await runSchemaDriftCheck([loaded()], failingDs);
    expect(outcomes[0].status).toBe('failed');
  });

  it('resolveDriftMode defaults: warn in non-prod, block in prod, env override wins', () => {
    delete process.env.SPEC_ENGINE_DRIFT;
    expect(resolveDriftMode(false)).toBe('warn');
    expect(resolveDriftMode(true)).toBe('block');
    process.env.SPEC_ENGINE_DRIFT = 'off';
    expect(resolveDriftMode(true)).toBe('off');
    process.env.SPEC_ENGINE_DRIFT = 'warn';
    expect(resolveDriftMode(true)).toBe('warn');
  });
});
