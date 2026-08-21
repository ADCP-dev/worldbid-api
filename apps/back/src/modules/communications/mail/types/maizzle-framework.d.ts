/**
 * Ambient declarations for @maizzle/framework v6.
 *
 * apps/back is CommonJS and uses the default `moduleResolution` (classic
 * node), which does not read the `exports` field of @maizzle/framework's
 * package.json. At runtime, dynamic `import('@maizzle/framework')` resolves
 * correctly (Node 20+ reads `exports`), but tsc cannot resolve the types.
 *
 * This shim declares the runtime shape consumed by the email-system-v2
 * renderer so type-checking passes without changing the project's global
 * moduleResolution setting. See sdd/email-system-v2 design (D-ESM).
 */

declare module '@maizzle/framework' {
  export interface RenderResult {
    html: string;
    doctype?: string;
    templateConfig?: unknown;
    sfcEventHandlers?: unknown[];
    plaintext?: unknown;
    outputPath?: unknown;
    tailwindBlocks?: unknown;
  }

  export interface MaizzleRenderer {
    render(
      input: string,
      config?: Record<string, unknown>,
    ): Promise<RenderResult>;
    invalidate(filePath?: string): Promise<void>;
    invalidateAll(): Promise<void>;
    close(): Promise<void>;
  }

  export interface CreateRendererOptions {
    root?: string;
    componentDirs?: unknown[];
    markdown?: unknown;
    dts?: boolean;
    vite?: unknown;
  }

  export function createRenderer(
    options?: CreateRendererOptions,
  ): Promise<MaizzleRenderer>;

  export function render(
    input: string,
    config?: Record<string, unknown>,
  ): Promise<RenderResult>;

  export function createPlaintext(
    html: string,
    options?: Record<string, unknown>,
  ): string;

  // Vue composables used inside .vue SFCs (no-op at the type level; they
  // are auto-imported by the Maizzle Vite SSR pipeline at runtime).
  export function useConfig<T = Record<string, unknown>>(): T;
  export function usePlaintext(options?: Record<string, unknown>): void;
}