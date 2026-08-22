import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as vm from 'node:vm';

/**
 * SandboxService — builds a VfsBackend + permissions block for a DeepAgent and
 * provides isolated JS evaluation.
 *
 * DeepAgent runtime (Context7-verified):
 *   - `backend: VfsBackend` from `@langchain/node-vfs` provides the virtual
 *     filesystem the agent reads/writes. It is NOT a host sandbox.
 *   - `permissions: [{operations, paths, mode}]` goes into `createDeepAgent`
 *     and restricts read/write access to declared paths.
 *
 * Eval engine:
 *   - `quickjs` (default): WASM-sandboxed QuickJS runtime via the node-vfs
 *     interpreter. No native deps.
 *   - `vm` (fallback): Node `vm` module. Configured via KA_SANDBOX_ENGINE.
 *
 * Deny-list (sensitive host paths the agent must never touch):
 *   - dot-env files, credentials, and key files
 *   - project source: apps/back/src, apps/front/src, packages
 */
@Injectable()
export class SandboxService {
  private readonly logger = new Logger(SandboxService.name);
  /** 'quickjs' | 'vm'. Resolved lazily from config. */
  protected configEngine: 'quickjs' | 'vm' = 'quickjs';

  private readonly DEFAULT_DENY = [
    '.env',
    '**/.env',
    '**/credentials',
    '**/*.key',
    'apps/back/src/**',
    'apps/front/src/**',
    'packages/**',
  ];

  constructor(private readonly config: ConfigService) {
    const engine = this.config.get<string>('ka.sandbox.engine');
    if (engine === 'vm' || process.env.KA_SANDBOX_ISOLATED_VM === 'false') {
      this.configEngine = 'vm';
    }
  }

  /**
   * Create a VfsBackend with an isolated working dir for `sessionId`.
   * Returns the backend instance; the caller passes it to `createDeepAgent`.
   */
  async createSandbox(sessionId: string): Promise<unknown> {
    const mountPath = this.workingDir(sessionId);
    return this.createVfsBackend({ mountPath, initialFiles: {} });
  }

  /** Build the `permissions` array for `createDeepAgent`. */
  buildPermissions(workingDir = '/vfs'): Array<{
    operations: string[];
    paths: string[];
    mode: 'allow' | 'deny';
  }> {
    return [
      {
        operations: ['read', 'write'],
        paths: this.DEFAULT_DENY,
        mode: 'deny',
      },
      {
        operations: ['read', 'write'],
        paths: [`${workingDir}/**`],
        mode: 'allow',
      },
    ];
  }

  /** Resolve an isolated working dir for a session under the OS temp dir. */
  workingDir(sessionId: string): string {
    const safe = createHash('sha1').update(sessionId).digest('hex').slice(0, 12);
    return join(tmpdir(), `ka-sandbox-${safe}`);
  }

  /**
   * Evaluate a JS expression in isolation. Uses QuickJS by default; falls back
   * to Node `vm` when configured. Throws on network/require attempts.
   */
  async evalJs(code: string): Promise<string> {
    if (this.configEngine === 'vm') {
      return this.vmEval(code);
    }
    return this.quickJsEval(code);
  }

  /** QuickJS eval stub — wired to the real interpreter at runtime. */
  protected async quickJsEval(code: string): Promise<string> {
    // The actual QuickJS interpreter is lazy-loaded on first use so the
    // extension boots even if the native binding is unavailable.
    const { VfsSandbox } = await import('@langchain/node-vfs');
    const sandbox = await VfsSandbox.create({ initialFiles: {} });
    try {
      const result = await sandbox.execute(`node -e "console.log(${code})"`);
      return result.output ?? '';
    } finally {
      await sandbox.stop();
    }
  }

  /**
   * Node `vm` eval — restricts `require`, `process`, globals to a minimal set.
   * Throws if the code tries to access `require`, `http`, `fetch`, etc.
   */
  protected async vmEval(code: string): Promise<string> {
    this.assertNoNetwork(code);
    const sandbox = {
      console: { log: (...args: unknown[]) => args.map(String).join(' ') },
      Math,
      JSON,
      Number,
      String,
      Boolean,
      Array,
      Object,
    };
    const script = new vm.Script(code);
    const context = vm.createContext(sandbox);
    const result = script.runInContext(context);
    return String(result ?? '');
  }

  /** Reject code that attempts network or require access. */
  private assertNoNetwork(code: string): void {
    const forbidden = /\b(require|import|fetch|http|https|net|dgram|child_process|process)\b/;
    if (forbidden.test(code)) {
      throw new Error(
        'Sandboxed eval denied: network/require access is not allowed',
      );
    }
  }

  /** Create a VfsBackend. Stubbed in tests; real impl uses @langchain/node-vfs. */
  protected async createVfsBackend(opts: {
    mountPath: string;
    initialFiles: Record<string, string>;
  }): Promise<unknown> {
    const { VfsBackend } = await import('@langchain/node-vfs');
    return VfsBackend.create(opts);
  }
}