/**
 * spec-crud nav plugin — auto-registers spec-engine resources in the sidebar.
 *
 * Reads the loaded specs from the MetaController (`GET /_spec/resources`) and
 * adds one sidebar block per extension with links to each resource's list view.
 *
 * The MetaController returns a flat list of resources; this plugin clusters
 * them by extension using the `table` prefix (`ext_<ext>_<resource>`).
 *
 * Generic: any new spec extension dropped into `src/extensions/` appears in
 * the sidebar automatically. No manual nav registration needed.
 */

import type { NavMenu } from '~/types/nav';

interface SpecResourceMeta {
  name: string;
  displayName?: string;
  table?: string;
  route?: string;
  ui?: {
    view?: 'table' | 'kanban' | 'list';
    icon?: string;
  };
}

interface SpecResponse {
  resources: SpecResourceMeta[];
}

const VIEW_ICON: Record<string, string> = {
  kanban: 'Kanban',
  list: 'List',
  table: 'Table',
};

export default defineNuxtPlugin(() => {
  const authStore = useAuthStore();
  const menuItems = useState<NavMenu[]>('nav:menuItems', () => []);

  async function loadSpecNav() {
    if (!authStore.token) return;

    try {
      const config = useRuntimeConfig();
      const baseURL = `${config.public.apiUrl}${config.public.apiPrefix}`;
      const res = await $fetch<SpecResponse>('/_spec/resources', {
        baseURL,
        headers: { Authorization: `Bearer ${authStore.token}` },
      });

      // Cluster resources by extension using the table prefix:
      //   ext_tasks_task          → ext = "tasks"
      //   ext_tasks_task_comment   → ext = "tasks"
      const byExtension = new Map<
        string,
        { displayName: string; resources: SpecResourceMeta[] }
      >();

      for (const r of res.resources ?? []) {
        const extName = r.table
          ? (r.table.match(/^ext_([a-z0-9]+)_/)?.[1] ?? null)
          : null;
        if (!extName) continue;
        let bucket = byExtension.get(extName);
        if (!bucket) {
          bucket = { displayName: titleCase(extName), resources: [] };
          byExtension.set(extName, bucket);
        }
        bucket.resources.push(r);
      }

      // Remove any previously-added spec blocks (idempotent re-add on reload).
      menuItems.value = menuItems.value.filter(
        (item) => !item.heading?.startsWith('SPEC:'),
      );

      // Sort extensions alphabetically for stable sidebar order.
      const sorted = [...byExtension.entries()].sort((a, b) =>
        a[0].localeCompare(b[0]),
      );

      for (const [extName, bucket] of sorted) {
        const heading = `SPEC: ${bucket.displayName}`;
        if (menuItems.value.find((item) => item.heading === heading)) continue;

        // Sort resources by name for stable order within the block.
        const sortedResources = [...bucket.resources].sort((a, b) =>
          a.name.localeCompare(b.name),
        );

        menuItems.value.push({
          heading,
          order: 50,
          items: sortedResources.map((r, idx) => ({
            title: r.displayName ?? titleCase(r.name),
            icon: r.ui?.icon ?? VIEW_ICON[r.ui?.view ?? 'table'] ?? 'Table',
            link: routeFor(r),
            order: idx * 10,
          })),
        });
      }
    } catch (err) {
      // Silent fail — the sidebar works without spec nav.
      if (import.meta.dev) {
        // eslint-disable-next-line no-console
        console.warn('[spec-crud nav] could not load spec resources:', err);
      }
    }
  }

  function routeFor(r: SpecResourceMeta): string {
    // /api/v1/tasks → /app/tasks
    if (r.route) {
      return r.route.replace(/^\/api\/v\d+\//, '/app/');
    }
    return `/app/${r.name}`;
  }

  function titleCase(s: string): string {
    return s
      .split(/[-_]/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  // Load on startup and whenever the auth token changes.
  loadSpecNav();
  watch(
    () => authStore.token,
    (tok) => {
      if (tok) loadSpecNav();
    },
  );
});