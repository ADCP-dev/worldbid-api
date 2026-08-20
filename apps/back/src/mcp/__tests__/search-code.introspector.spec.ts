import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SearchCodeIntrospector } from '../introspectors/search-code.introspector';
import { IntrospectionCache } from '../introspection-cache';
import { EventEmitter } from 'node:events';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

class FakeChild extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  constructor(public readonly output: string) { super(); }
}

describe('SearchCodeIntrospector', () => {
  let cache: IntrospectionCache;
  let intro: SearchCodeIntrospector;

  beforeEach(() => {
    cache = new IntrospectionCache();
  });

  describe('searchCode', () => {
    it('returns empty for empty query', async () => {
      intro = new SearchCodeIntrospector(cache, '/repo');
      expect(await intro.searchCode('')).toEqual([]);
    });

    it('parses rg JSON output into results', async () => {
      const fakeSpawn = vi.fn(() => {
        const lines: string[] = [
          JSON.stringify({ type: 'match', data: { path: { text: 'extensions/tasks/hooks/task-after-create.ts' }, line_number: 15, lines: { text: "await ctx.notify('task-assigned', {});" }, submatches: [] } }),
          JSON.stringify({ type: 'summary', data: { elapsed_total: {}, matched_paths: 1, matches: 1 } }),
        ];
        const child = new FakeChild(lines.join('\n'));
        process.nextTick(() => {
          child.stdout.emit('data', Buffer.from(child.output));
          child.emit('close', 0);
        });
        return child as unknown as import('node:child_process').ChildProcess;
      });
      intro = new SearchCodeIntrospector(cache, '/repo', fakeSpawn as unknown as typeof import('node:child_process').spawn);
      const results = await intro.searchCode('task assigned', 5);
      expect(results).toHaveLength(1);
      expect(results[0].file).toContain('task-after-create.ts');
      expect(results[0].line).toBe(15);
    });

    it('respects limit', async () => {
      const fakeSpawn = vi.fn(() => {
        const lines: string[] = [];
        for (let i = 0; i < 10; i++) {
          lines.push(JSON.stringify({ type: 'match', data: { path: { text: `f${i}.ts` }, line_number: i, lines: { text: 'match' }, submatches: [] } }));
        }
        const child = new FakeChild(lines.join('\n'));
        process.nextTick(() => {
          child.stdout.emit('data', Buffer.from(child.output));
          child.emit('close', 0);
        });
        return child as unknown as import('node:child_process').ChildProcess;
      });
      intro = new SearchCodeIntrospector(cache, '/repo', fakeSpawn as unknown as typeof import('node:child_process').spawn);
      const results = await intro.searchCode('x', 3);
      expect(results).toHaveLength(3);
    });

    it('returns empty on rg error', async () => {
      const fakeSpawn = vi.fn(() => {
        const child = new FakeChild('');
        process.nextTick(() => child.emit('error', new Error('rg not found')));
        return child as unknown as import('node:child_process').ChildProcess;
      });
      intro = new SearchCodeIntrospector(cache, '/repo', fakeSpawn as unknown as typeof import('node:child_process').spawn);
      expect(await intro.searchCode('x')).toEqual([]);
    });
  });

  describe('scrubSecrets', () => {
    it('replaces sk_live tokens', () => {
      intro = new SearchCodeIntrospector(cache, '/repo');
      const out = intro.scrubSecrets('const key = "sk_live_12345abc"');
      expect(out).not.toContain('sk_live_12345abc');
      expect(out).toContain('[REDACTED]');
    });
    it('replaces API_KEY= assignments', () => {
      intro = new SearchCodeIntrospector(cache, '/repo');
      const out = intro.scrubSecrets('API_KEY = "abc123"');
      expect(out).toContain('[REDACTED]');
      expect(out).not.toContain('abc123');
    });
    it('replaces PASSWORD= assignments', () => {
      intro = new SearchCodeIntrospector(cache, '/repo');
      const out = intro.scrubSecrets("PASSWORD = 'secret'");
      expect(out).toContain('[REDACTED]');
    });
  });

  describe('getHandlerCode', () => {
    it('returns null for missing file', () => {
      intro = new SearchCodeIntrospector(cache, '/nope/repo');
      expect(intro.getHandlerCode('tasks', 'hooks/missing.ts')).toBeNull();
    });
    it('returns scrubbed file content', () => {
      const tmp = mkdtempSync(path.join(tmpdir(), 'sc-'));
      const extDir = path.join(tmp, 'apps/back/src/extensions/tasks/hooks');
      mkdirSync(extDir, { recursive: true });
      writeFileSync(path.join(extDir, 'before-create.ts'), 'const API_KEY = "sk_live_x";');
      intro = new SearchCodeIntrospector(cache, tmp);
      const code = intro.getHandlerCode('tasks', 'hooks/before-create.ts');
      expect(code).toContain('[REDACTED]');
      expect(code).not.toContain('sk_live_x');
    });
  });
});