/**
 * ExtensionModuleLoader — single place for extension handler module loading.
 *
 * Extension hook/action/handler paths resolve differently per environment:
 * in development the source `.ts` files are required directly, while in
 * production the compiled `.js` variants are used. That string-replace used
 * to be duplicated in hook-executor, action factory, outbound webhooks,
 * scheduled actions, and the webhook controller factory — with subtly
 * different containment checks.
 *
 * This module centralizes:
 *   - `resolveHookModulePath`   → path-containment check + `.ts` → `.js`
 *                                 prod resolution. Returns null when the
 *                                 path escapes the extension directory.
 *   - `loadExtensionModule`     → the actual `require()` call (kept
 *                                 synchronous so the require-cache semantics
 *                                 of hook execution remain identical).
 *   - `extractModuleExport`     → default-export extraction shared by all
 *                                 handler kinds (function or module object).
 *
 * Behavior is byte-identical to the previous per-file implementations.
 */

import * as path from 'path';

/**
 * Convert a resolved absolute handler path to the path that should be
 * required: `.ts` files are compiled to `.js` in production, dev uses the
 * source path directly.
 * Exported for unit testing.
 */
export function resolveExtensionModulePath(absolutePath: string): string {
  return process.env.NODE_ENV === 'production'
    ? absolutePath.replace(/\.ts$/, '.js')
    : absolutePath;
}

/**
 * Resolve the require path for an extension handler module after enforcing
 * directory containment (defense against path traversal out of the
 * extension directory).
 *
 * Returns the require-ready absolute path, or null when `absolutePath` is
 * outside `extensionDir`.
 */
export function resolveHookModulePath(
  absolutePath: string,
  extensionDir: string,
): string | null {
  const normalizedDir = path.resolve(extensionDir) + path.sep;
  const resolved = path.resolve(absolutePath);
  if (!resolved.startsWith(normalizedDir)) {
    return null;
  }
  return resolveExtensionModulePath(resolved);
}

/**
 * Load an extension handler module synchronously (require cache semantics:
 * handlers are loaded once and cached by Node's module system).
 * Throws on load failure — callers own error handling and logging.
 */
export function loadExtensionModule(absPath: string): unknown {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require(absPath);
}

/**
 * Extract the callable handler from a loaded module. Handlers may export
 * the function directly or as a `default` export (ESM interop).
 * Returns unknown — callers validate the shape.
 */
export function extractModuleExport(mod: unknown): unknown {
  if (mod && typeof mod === 'object' && 'default' in (mod as object)) {
    return (mod as { default: unknown }).default;
  }
  return mod;
}
