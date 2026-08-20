/**
 * FrontendIntrospector — lists Nuxt layers (apps/front/modules/*) with
 * page/component/composable/store basenames.
 */

import { readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { IntrospectionCache } from '../introspection-cache';
import type { FrontendLayerView } from '../types';

export class FrontendIntrospector {
  constructor(
    private readonly cache: IntrospectionCache,
    private readonly repoRoot: string = process.cwd(),
  ) {}

  listFrontendLayers(): FrontendLayerView[] {
    const cached = this.cache.get<FrontendLayerView[]>('fe:layers');
    if (cached) return cached;
    const layersDir = path.join(this.repoRoot, 'apps/front/modules');
    const layers: FrontendLayerView[] = [];
    if (existsSync(layersDir)) {
      for (const name of readdirSync(layersDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)) {
        layers.push(this.scanLayer(name, path.join(layersDir, name)));
      }
    }
    this.cache.set('fe:layers', layers);
    return layers;
  }

  private scanLayer(name: string, abs: string): FrontendLayerView {
    return {
      name,
      path: `modules/${name}/`,
      pages: this.scanBasenames(path.join(abs, 'pages'), '.vue'),
      components: this.scanBasenames(path.join(abs, 'components'), '.vue'),
      composables: this.scanBasenames(path.join(abs, 'composables'), '.ts'),
      stores: this.scanBasenames(path.join(abs, 'stores'), '.ts'),
    };
  }

  private scanBasenames(dir: string, ext: string): string[] {
    if (!existsSync(dir)) return [];
    try {
      const out: string[] = [];
      const walk = (d: string, rel: string) => {
        for (const entry of readdirSync(d, { withFileTypes: true })) {
          if (entry.isDirectory()) {
            walk(path.join(d, entry.name), path.join(rel, entry.name));
          } else if (entry.name.endsWith(ext)) {
            out.push(path.join(rel, entry.name));
          }
        }
      };
      walk(dir, '');
      return out;
    } catch {
      return [];
    }
  }
}