/**
 * ModuleIntrospector — lists base NestJS modules (not extensions).
 *
 * Uses a static registry of known base modules with their filesystem paths.
 * Scans each module dir for submodules and entity files.
 */

import { readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { IntrospectionCache } from '../introspection-cache';
import type { ModuleView } from '../types';

interface BaseModuleEntry {
  name: string;
  path: string;
  entities: string[];
  routes: { method: string; path: string; guard: string }[];
}

// Static registry of Foundation base modules. Mirrors docs/modules/ registry.
const BASE_MODULES: BaseModuleEntry[] = [
  {
    name: 'iam',
    path: 'modules/iam/',
    entities: ['User', 'Role', 'Session', 'ApiKey'],
    routes: [
      { method: 'POST', path: '/api/v1/auth/login', guard: 'public' },
      { method: 'POST', path: '/api/v1/auth/register', guard: 'public' },
      { method: 'GET', path: '/api/v1/auth/me', guard: 'jwt' },
    ],
  },
  {
    name: 'users',
    path: 'modules/users/',
    entities: [],
    routes: [{ method: 'GET', path: '/api/v1/users', guard: 'jwt' }],
  },
  {
    name: 'communications',
    path: 'modules/communications/',
    entities: [],
    routes: [],
  },
  {
    name: 'billing',
    path: 'modules/billing/',
    entities: [],
    routes: [],
  },
  {
    name: 'storage',
    path: 'modules/storage/',
    entities: ['File'],
    routes: [],
  },
  {
    name: 'translations',
    path: 'modules/translations/',
    entities: ['Lang'],
    routes: [{ method: 'GET', path: '/api/v1/translations/langs', guard: 'jwt' }],
  },
  {
    name: 'error-tracker',
    path: 'modules/error-tracker/',
    entities: [],
    routes: [],
  },
  {
    name: 'app-settings',
    path: 'modules/app-settings/',
    entities: [],
    routes: [],
  },
];

export class ModuleIntrospector {
  constructor(
    private readonly cache: IntrospectionCache,
    private readonly repoRoot: string = process.cwd(),
  ) {}

  listModules(): ModuleView[] {
    const cached = this.cache.get<ModuleView[]>('module:list');
    if (cached) return cached;
    const modules = BASE_MODULES.map((m) => this.toModuleView(m));
    this.cache.set('module:list', modules);
    return modules;
  }

  private toModuleView(m: BaseModuleEntry): ModuleView {
    return {
      name: m.name,
      path: m.path,
      submodules: this.scanSubmodules(m.path),
      routes: m.routes,
      entities: m.entities,
    };
  }

  private scanSubmodules(moduleRelPath: string): string[] {
    const abs = path.join(this.repoRoot, 'apps/back/src', moduleRelPath);
    if (!existsSync(abs)) return [];
    try {
      return readdirSync(abs, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);
    } catch {
      return [];
    }
  }
}