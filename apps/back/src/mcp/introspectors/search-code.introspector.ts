/**
 * SearchCodeIntrospector — literal keyword search via ripgrep subprocess,
 * plus handler file retrieval with secret scrubbing.
 *
 * rg invocation: spawn('rg', ['--json','-n','-C2', query, 'apps/back/src', 'apps/front'], {cwd: repoRoot})
 * No shell; query passed as argv (no injection). Excludes via .gitignore respected by rg.
 */

import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { IntrospectionCache } from '../introspection-cache';
import type { SearchResultView } from '../types';

const SECRET_PATTERNS: Array<{ re: RegExp; replacement: string }> = [
  { re: /sk_live_[A-Za-z0-9_]+/g, replacement: '[REDACTED]' },
  { re: /sk_test_[A-Za-z0-9_]+/g, replacement: '[REDACTED]' },
  { re: /(API_KEY|PASSWORD|SECRET|TOKEN)\s*=\s*["'][^"']+["']/gi, replacement: '$1 = "[REDACTED]"' },
];

export interface RgMatch {
  type: 'match';
  data: {
    path: { text: string };
    line_number: number;
    lines: { text: string };
    submatches: unknown[];
  };
}

export interface RgSummary {
  type: 'summary';
  data: { elapsed_total: unknown; matched_paths: number; matches: number };
}

export type RgJsonLine = RgMatch | RgSummary | { type: string; data: unknown };

export class SearchCodeIntrospector {
  constructor(
    private readonly cache: IntrospectionCache,
    private readonly repoRoot: string = process.cwd(),
    private readonly spawnFn: typeof spawn = spawn,
  ) {}

  async searchCode(query: string, limit: number = 5): Promise<SearchResultView[]> {
    if (!query.trim()) return [];
    const key = `search:${query}:${limit}`;
    const cached = this.cache.get<SearchResultView[]>(key);
    if (cached) return cached;
    const results = await this.runRipgrep(query, limit);
    this.cache.set(key, results);
    return results;
  }

  getHandlerCode(extension: string, handlerPath: string): string | null {
    const key = `handler:${extension}:${handlerPath}`;
    const cached = this.cache.get<string | null>(key);
    if (cached !== undefined) return cached;
    const abs = path.join(this.repoRoot, 'apps/back/src/extensions', extension, handlerPath);
    if (!existsSync(abs)) {
      this.cache.set(key, null);
      return null;
    }
    try {
      const raw = readFileSync(abs, 'utf8');
      const scrubbed = this.scrubSecrets(raw);
      this.cache.set(key, scrubbed);
      return scrubbed;
    } catch {
      this.cache.set(key, null);
      return null;
    }
  }

  scrubSecrets(source: string): string {
    let out = source;
    for (const { re, replacement } of SECRET_PATTERNS) {
      out = out.replace(re, replacement);
    }
    return out;
  }

  private async runRipgrep(query: string, limit: number): Promise<SearchResultView[]> {
    return new Promise<SearchResultView[]>((resolve) => {
      const args = ['--json', '-n', '-C2', query, 'apps/back/src', 'apps/front'];
      const child = this.spawnFn('rg', args, { cwd: this.repoRoot });
      const chunks: Buffer[] = [];
      child.stdout?.on('data', (c: Buffer) => chunks.push(c));
      child.stderr?.on('data', () => { /* ignore */ });
      child.on('error', () => resolve([]));
      child.on('close', () => {
        const stdout = Buffer.concat(chunks).toString('utf8');
        const results = this.parseRgJson(stdout, limit);
        resolve(results);
      });
    });
  }

  private parseRgJson(stdout: string, limit: number): SearchResultView[] {
    const results: SearchResultView[] = [];
    const lines = stdout.split('\n').filter(Boolean);
    for (const line of lines) {
      if (results.length >= limit) break;
      try {
        const parsed = JSON.parse(line) as RgJsonLine;
        if (parsed.type !== 'match') continue;
        const m = parsed as RgMatch;
        results.push({
          file: m.data.path.text,
          line: m.data.line_number,
          snippet: m.data.lines.text.trim(),
          relevance: 1 - results.length * 0.05, // deterministic ranking
        });
      } catch {
        // skip non-JSON lines
      }
    }
    return results;
  }
}