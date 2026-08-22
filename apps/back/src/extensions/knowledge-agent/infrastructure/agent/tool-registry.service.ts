import { Injectable, Logger } from '@nestjs/common';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { StructuredTool } from '@langchain/core/tools';

interface CacheEntry {
  tools: StructuredTool[];
  mtimeMs: number;
}

/**
 * ToolRegistryService — auto-discovers `agent.tools.ts` files across all
 * extensions under `src/extensions/` and merges their exported `tools`
 * arrays.
 *
 * Mirrors the ExtensionLoaderModule auto-discovery pattern: each extension MAY
 * drop an `agent.tools.ts` exporting `tools: StructuredTool[]`. Files are
 * cached by mtime — re-scan only happens when a file changes.
 *
 * FS access is isolated into `listExtensionDirs` + `statMtimeMs` so tests can
 * stub them without touching the real disk.
 */
@Injectable()
export class ToolRegistryService {
  private readonly logger = new Logger(ToolRegistryService.name);
  private readonly cache = new Map<string, CacheEntry>();

  /**
   * Collect all native tools from every extension that exposes an
   * `agent.tools.ts`. Extensions without the file (or whose import fails) are
   * skipped gracefully.
   */
  async collect(): Promise<StructuredTool[]> {
    const extensionsDir = this.resolveExtensionsDir();
    let entries: readonly string[];
    try {
      entries = this.listExtensionDirs(extensionsDir);
    } catch (err) {
      this.logger.warn(
        `Failed to read extensions dir ${extensionsDir}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return [];
    }

    const allTools: StructuredTool[] = [];
    for (const name of entries) {
      const tools = await this.loadExtensionTools(extensionsDir, name);
      if (tools.length > 0) allTools.push(...tools);
    }
    return allTools;
  }

  private async loadExtensionTools(
    extensionsDir: string,
    name: string,
  ): Promise<StructuredTool[]> {
    const toolsFile = join(extensionsDir, name, 'agent.tools');
    let mtimeMs: number;
    try {
      mtimeMs = this.statMtimeMs(`${toolsFile}.ts`);
    } catch {
      // No agent.tools.ts — skip gracefully.
      return [];
    }

    const cached = this.cache.get(name);
    if (cached && cached.mtimeMs === mtimeMs) {
      return cached.tools;
    }

    let tools: StructuredTool[] = [];
    try {
      tools = (await this.loadToolsFile(toolsFile)) ?? [];
    } catch (err) {
      this.logger.warn(
        `Failed to import ${toolsFile}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return [];
    }
    this.cache.set(name, { tools, mtimeMs });
    return tools;
  }

  /**
   * Load the tools file via dynamic import. Extracted as a method so tests
   * can stub it deterministically instead of touching the real FS.
   * Returns `null` when the file has no `tools` export.
   */
  protected async loadToolsFile(
    toolsFile: string,
  ): Promise<StructuredTool[] | null> {
    const mod = await import(toolsFile);
    if (Array.isArray(mod.tools)) {
      return mod.tools as StructuredTool[];
    }
    return null;
  }

  /** List subdirectory names under `dir`. Stubbed in tests. */
  protected listExtensionDirs(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  }

  /** Return mtime ms for a file. Stubbed in tests. */
  protected statMtimeMs(file: string): number {
    return statSync(file).mtimeMs;
  }

  protected resolveExtensionsDir(): string {
    // src/extensions/ relative to this compiled file. In dev (ts) and prod
    // (dist) the relative location is the same: ../ from infrastructure/agent.
    return join(__dirname, '..', '..');
  }
}