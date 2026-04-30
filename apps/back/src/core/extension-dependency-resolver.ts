import { Logger } from '@nestjs/common';
import type { ExtensionManifest, ExtensionConflict } from './extension-manifest.types';

const logger = new Logger('ExtensionDependencyResolver');

/**
 * Resolve extension load order using Kahn's algorithm (topological sort).
 *
 * Returns manifests in dependency-safe order.
 * If a circular dependency is detected, it's logged and the conflicting
 * extensions are placed at the end (best-effort load).
 */
export function resolveDependencies(
  manifests: Map<string, ExtensionManifest>,
): {
  ordered: ExtensionManifest[];
  conflicts: ExtensionConflict[];
} {
  const conflicts: ExtensionConflict[] = [];
  const extNames = Array.from(manifests.keys());

  // Build adjacency list
  const inDegree = new Map<string, number>();
  const graph = new Map<string, string[]>();

  for (const name of extNames) {
    inDegree.set(name, 0);
    graph.set(name, []);
  }

  for (const [name, manifest] of manifests) {
    const deps = manifest.dependencies?.extensions ?? [];
    for (const dep of deps) {
      if (manifests.has(dep)) {
        graph.get(dep)!.push(name);
        inDegree.set(name, (inDegree.get(name) ?? 0) + 1);
      }
      // Missing deps are checked by conflict detector; skip here
    }
  }

  // Kahn's algorithm
  const queue: string[] = [];
  for (const name of extNames) {
    if (inDegree.get(name) === 0) {
      queue.push(name);
    }
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    sorted.push(node);

    for (const neighbor of graph.get(node) ?? []) {
      const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  // Detect circular dependencies
  if (sorted.length < extNames.length) {
    const unsorted = extNames.filter((n) => !sorted.includes(n));
    const cyclePath = findCycle(graph, unsorted);

    conflicts.push({
      type: 'circular_dependency',
      detail: `Circular dependency detected between: ${unsorted.join(', ')}. Chain: ${cyclePath}`,
      severity: 'error',
    });

    logger.warn(`⚠️  ERROR: Circular dependency: ${unsorted.join(' -> ')}`);

    // Append unsorted extensions at the end (best-effort)
    sorted.push(...unsorted);
  }

  const ordered = sorted
    .map((name) => manifests.get(name))
    .filter((m): m is ExtensionManifest => m !== undefined);

  logger.log(
    `Extension load order: ${ordered.map((m) => m.name).join(' → ')}`,
  );

  return { ordered, conflicts };
}

/**
 * Simple DFS cycle detection to produce a readable chain.
 */
function findCycle(
  graph: Map<string, string[]>,
  nodes: string[],
): string {
  const visited = new Set<string>();
  const stack = new Set<string>();
  const parent = new Map<string, string>();

  function dfs(node: string): string | null {
    visited.add(node);
    stack.add(node);

    for (const neighbor of graph.get(node) ?? []) {
      if (!visited.has(neighbor)) {
        parent.set(neighbor, node);
        const result = dfs(neighbor);
        if (result) return result;
      } else if (stack.has(neighbor)) {
        // Found a cycle — reconstruct chain
        const chain: string[] = [neighbor];
        let cur = node;
        while (cur !== neighbor) {
          chain.unshift(cur);
          cur = parent.get(cur) ?? cur;
          if (!cur || chain.length > nodes.length * 2) break;
        }
        chain.unshift(neighbor);
        return chain.join(' → ');
      }
    }

    stack.delete(node);
    return null;
  }

  for (const node of nodes) {
    if (!visited.has(node)) {
      const result = dfs(node);
      if (result) return result;
    }
  }

  return nodes.join(' → ');
}
