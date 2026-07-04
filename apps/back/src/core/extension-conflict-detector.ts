import { Logger } from '@nestjs/common';
import type {
  ExtensionManifest,
  ExtensionConflict,
} from './extension-manifest.types';

const logger = new Logger('ExtensionConflictDetector');

/**
 * Detect duplicate routes (same method + path) across all extension manifests.
 */
export function detectRouteConflicts(
  manifests: Map<string, ExtensionManifest>,
): ExtensionConflict[] {
  const conflicts: ExtensionConflict[] = [];
  const routeMap = new Map<string, string>();

  for (const [extName, manifest] of manifests) {
    const routes = manifest.contributes?.routes ?? [];
    for (const route of routes) {
      const key = `${route.method}:${route.path}`;
      const owner = routeMap.get(key);
      if (owner) {
        conflicts.push({
          type: 'route_conflict',
          detail: `Route ${route.method} ${route.path} declared by "${extName}" conflicts with "${owner}"`,
          severity: 'error',
        });
      } else {
        routeMap.set(key, extName);
      }
    }
  }

  if (conflicts.length > 0) {
    for (const c of conflicts) {
      logger.warn(`⚠️  ${c.severity.toUpperCase()}: ${c.detail}`);
    }
  }

  return conflicts;
}

/**
 * Detect duplicate table names across all extension manifests.
 */
export function detectTableConflicts(
  manifests: Map<string, ExtensionManifest>,
): ExtensionConflict[] {
  const conflicts: ExtensionConflict[] = [];
  const tableMap = new Map<string, string>();

  for (const [extName, manifest] of manifests) {
    const entities = manifest.contributes?.entities ?? [];
    for (const entity of entities) {
      const owner = tableMap.get(entity.table);
      if (owner) {
        conflicts.push({
          type: 'table_conflict',
          detail: `Table "${entity.table}" declared by "${extName}" conflicts with "${owner}"`,
          severity: 'error',
        });
      } else {
        tableMap.set(entity.table, extName);
      }
    }
  }

  if (conflicts.length > 0) {
    for (const c of conflicts) {
      logger.warn(`⚠️  ${c.severity.toUpperCase()}: ${c.detail}`);
    }
  }

  return conflicts;
}

/**
 * Detect missing extension dependencies.
 * Also detects circular dependencies via the dependency resolver later,
 * but here we check if referenced dependencies actually exist.
 */
export function detectMissingDependencies(
  manifests: Map<string, ExtensionManifest>,
): ExtensionConflict[] {
  const conflicts: ExtensionConflict[] = [];
  const available = new Set(manifests.keys());

  for (const [extName, manifest] of manifests) {
    const deps = manifest.dependencies?.extensions ?? [];
    for (const dep of deps) {
      if (!available.has(dep)) {
        conflicts.push({
          type: 'missing_dependency',
          detail: `Extension "${extName}" requires extension "${dep}" but it is not loaded. Please ensure the "${dep}" extension is present in src/extensions/${dep}/.`,
          severity: 'warning', // Changed from 'error' to 'warning' — missing dep skips only the dependent extension, not all
          extension: extName,
          missingDependency: dep,
        });
      }
    }
  }

  if (conflicts.length > 0) {
    for (const c of conflicts) {
      logger.warn(`⚠️  ${c.severity.toUpperCase()}: ${c.detail}`);
    }
  }

  return conflicts;
}

/**
 * Aggregate all conflict detection checks.
 */
export function detectConflicts(
  manifests: Map<string, ExtensionManifest>,
): ExtensionConflict[] {
  logger.log('Running extension conflict detection…');

  const conflicts: ExtensionConflict[] = [
    ...detectRouteConflicts(manifests),
    ...detectTableConflicts(manifests),
    ...detectMissingDependencies(manifests),
  ];

  if (conflicts.length === 0) {
    logger.log('✅ No extension conflicts detected');
  } else {
    const errors = conflicts.filter((c) => c.severity === 'error').length;
    const warnings = conflicts.filter((c) => c.severity === 'warning').length;
    logger.log(`Found ${errors} error(s), ${warnings} warning(s)`);
  }

  return conflicts;
}
