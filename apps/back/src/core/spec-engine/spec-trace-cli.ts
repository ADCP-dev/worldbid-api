#!/usr/bin/env ts-node
/**
 * spec-trace-cli — CLI that fetches a trace by request ID from a running
 * spec-engine instance.
 *
 * Usage:
 *   pnpm spec:trace <requestId>                 # default host http://localhost:3010
 *   pnpm spec:trace <requestId> --host http://localhost:3010
 *
 * The trace endpoint is GET /api/v1/_spec/trace/:requestId. In the current
 * spike the MetaController stub returns `found: false` for any ID, but the
 * CLI is wired so it works as soon as the backend implements real tracing.
 */

import http from 'http';
import { URL } from 'url';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const hostFlagIdx = args.indexOf('--host');
  const host = hostFlagIdx !== -1 ? args[hostFlagIdx + 1] : 'http://localhost:3010';
  const requestId = args.find((a) => !a.startsWith('--'));

  if (!requestId) {
    console.error('Usage: ts-node spec-trace-cli.ts <requestId> [--host <url>]');
    process.exit(1);
  }

  const url = new URL(`/api/v1/_spec/trace/${encodeURIComponent(requestId)}`, host);

  const options: http.RequestOptions = {
    method: 'GET',
    hostname: url.hostname,
    port: url.port,
    path: url.pathname,
    headers: { Accept: 'application/json' },
  };

  const req = http.request(options, (res) => {
    let body = '';
    res.setEncoding('utf8');
    res.on('data', (chunk) => { body += chunk; });
    res.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        console.log(JSON.stringify(parsed, null, 2));
      } catch {
        console.log(body);
      }
      if ((res.statusCode ?? 500) >= 400) {
        console.error(`\nHTTP ${res.statusCode}`);
        process.exit(1);
      }
    });
  });
  req.on('error', (err) => {
    console.error(`\n❌ Trace fetch failed: ${err.message}`);
    console.error(`   Is the backend running at ${host}?`);
    process.exit(1);
  });
  req.end();
}

if (require.main === module) {
  main();
}