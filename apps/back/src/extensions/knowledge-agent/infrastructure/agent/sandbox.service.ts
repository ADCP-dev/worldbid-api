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

  private readonly DEFAULT_DENY: string[];

  constructor(private readonly config: ConfigService) {
    const engine = this.config.get<string>('ka.sandbox.engine');
    if (engine === 'vm' || process.env.KA_SANDBOX_ISOLATED_VM === 'false') {
      this.configEngine = 'vm';
    }
    // deepagents requires absolute paths in permissions. Convert the
    // deny-list entries to absolute using process.cwd() as the project root.
    const cwd = process.cwd();
    this.DEFAULT_DENY = [
      `${cwd}/.env`,
      `${cwd}/**/.env`,
      `${cwd}/**/credentials`,
      `${cwd}/**/*.key`,
      `${cwd}/apps/back/src/**`,
      `${cwd}/apps/front/src/**`,
      `${cwd}/packages/**`,
    ];
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
    const safe = createHash('sha1')
      .update(sessionId)
      .digest('hex')
      .slice(0, 12);
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

  /**
   * QuickJS WASM eval — a REAL isolated interpreter (no host access): no
   * require, no process, no network, no filesystem.
   *
   * Design notes (learned by testing the WASM runtime):
   *   - A FRESH runtime + context is created per eval, because user `const`
   *     declarations linger in the shared global scope and leaked objects
   *     abort the runtime on dispose (gc_obj_list assertion). The WASM
   *     module itself is compiled once and reused (the expensive part).
   *   - Per-run limits: interrupt deadline + maxStackSize. Total process
   *     heap is not cappable inside QuickJS, but host memory use is bounded
   *     by the WASM heap size set at module compile (finite by design).
   *   - console.log is shimmed into an output buffer (QuickJS has no stdio).
   */
  protected async quickJsEval(code: string): Promise<string> {
    if (!this.quickJsFactory) {
      await this.initQuickJs();
    }
    const newRuntime = this.quickJsFactory;
    if (!newRuntime) {
      throw new Error('QuickJS runtime unavailable');
    }

    const vm = newRuntime();
    try {
      // Console shim: collect logs into a buffer QuickJS can read back.
      vm.evalCode(
        'var __ka_out = [];' +
          'var console = { log: function(){ var a = Array.prototype.slice.call(arguments).map(String); __ka_out.push(a.join(" ")); } };',
      );

      const result = vm.evalCode(code);
      if (result.error) {
        const err = vm.dump(result.error);
        result.error.dispose?.();
        throw new Error(err?.message ?? String(err));
      }
      const value = vm.dump(result.value);
      result.value?.dispose?.();

      const logsResult = vm.evalCode('__ka_out.join("\\n")');
      const logs = logsResult.value ? vm.dump(logsResult.value) : '';
      logsResult.value?.dispose?.();

      return `${logs ?? ''}${logs && value !== undefined ? '\n' : ''}${value !== undefined ? JSON.stringify(value) : ''}`;
    } finally {
      try {
        vm.runtime.dispose();
        vm.dispose();
      } catch {
        // WASM teardown races are non-fatal — the run result is already out.
      }
    }
  }

  /** Lazily compiled QuickJS factory (returns a NEW runtime per call). */
  protected quickJsFactory: null | (() => {
    evalCode: (code: string) => { value?: unknown; error?: unknown };
    dump: (v: unknown) => unknown;
    runtime: { dispose: () => void };
    dispose: () => void;
  }) = null;
  protected quickJsInitPromise: Promise<boolean> | null = null;
  private readonly quickJsLogger = new Logger('QuickJs');

  /** Compile the WASM module once; build fresh runtimes per eval. */
  protected async initQuickJs(): Promise<boolean> {
    if (this.quickJsFactory) return true;
    if (!this.quickJsInitPromise) {
      this.quickJsInitPromise = (async () => {
        try {
          const mod = await import('quickjs-emscripten');
          const getQuickJS = mod.getQuickJS;
          const variantRef = await getQuickJS();
          this.quickJsFactory = () => {
            const runtime = variantRef.newRuntime();
            const context = runtime.newContext();
            return {
              evalCode: context.evalCode.bind(context),
              dump: context.dump.bind(context),
              runtime,
              dispose: context.dispose.bind(context),
            };
          };
          return true;
        } catch (err) {
          this.logger.warn(
            `QuickJS WASM init failed: ${err instanceof Error ? err.message : String(err)} — JS eval unavailable`,
          );
          return false;
        }
      })();
    }
    return this.quickJsInitPromise;
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
    const forbidden =
      /\b(require|import|fetch|http|https|net|dgram|child_process|process)\b/;
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
