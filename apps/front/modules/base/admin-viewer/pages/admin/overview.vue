<script setup lang="ts">
import type { AppOverviewView, ErrorView, ExtensionView } from '@base/admin-viewer/utils/mcp-types';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const mcp = useMcp();

const { data: overview } = await useAsyncData<AppOverviewView>('admin-overview', () =>
  mcp.getAppOverview(),
);
const { data: extensions } = await useAsyncData<ExtensionView[]>('admin-extensions', () =>
  mcp.listExtensions(),
);
const { data: recentErrors } = await useAsyncData<ErrorView[]>('admin-recent-errors', () =>
  mcp.getErrors({ limit: 5, resolved: false }),
);

function fmtDate(date?: string) {
  return date ? new Date(date).toLocaleString() : '-';
}
</script>

<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-6">Overview</h1>

    <div v-if="!overview" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg" />
    </div>

    <template v-else>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div class="bg-base-100 rounded-box p-4 shadow text-center">
          <div class="text-3xl font-bold">{{ overview.extensions.length }}</div>
          <div class="text-xs text-base-content/60">Extensions</div>
        </div>
        <div class="bg-base-100 rounded-box p-4 shadow text-center">
          <div class="text-3xl font-bold">{{ overview.totalRoutes }}</div>
          <div class="text-xs text-base-content/60">Routes</div>
        </div>
        <div class="bg-base-100 rounded-box p-4 shadow text-center">
          <div class="text-3xl font-bold">{{ overview.totalEntities }}</div>
          <div class="text-xs text-base-content/60">Entities</div>
        </div>
        <div class="bg-base-100 rounded-box p-4 shadow text-center">
          <div class="text-3xl font-bold">{{ overview.totalJobs }}</div>
          <div class="text-xs text-base-content/60">Jobs</div>
        </div>
        <div class="bg-base-100 rounded-box p-4 shadow text-center">
          <div class="text-3xl font-bold">{{ overview.totalNotifications }}</div>
          <div class="text-xs text-base-content/60">Notifications</div>
        </div>
        <div class="bg-base-100 rounded-box p-4 shadow text-center">
          <div class="text-3xl font-bold">{{ overview.totalMigrations }}</div>
          <div class="text-xs text-base-content/60">Migrations</div>
        </div>
        <div class="bg-base-100 rounded-box p-4 shadow text-center">
          <div class="text-3xl font-bold" :class="overview.pendingMigrations > 0 ? 'text-warning' : ''">
            {{ overview.pendingMigrations }}
          </div>
          <div class="text-xs text-base-content/60">Pending</div>
        </div>
        <div class="bg-base-100 rounded-box p-4 shadow text-center">
          <div class="text-3xl font-bold" :class="overview.unresolvedErrors > 0 ? 'text-error' : ''">
            {{ overview.unresolvedErrors }}
          </div>
          <div class="text-xs text-base-content/60">Errors</div>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div>
          <h2 class="text-lg font-bold mb-3">Extensions</h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <AdminViewerExtensionCard
              v-for="ext in extensions ?? []"
              :key="ext.name"
              :extension="ext"
            />
          </div>
        </div>
        <div>
          <h2 class="text-lg font-bold mb-3">Modules</h2>
          <div class="bg-base-100 rounded-box p-4 shadow">
            <ul class="space-y-1">
              <li
                v-for="mod in overview.modules"
                :key="mod"
                class="font-mono text-sm text-base-content/70"
              >
                {{ mod }}
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div>
        <h2 class="text-lg font-bold mb-3">Recent Errors</h2>
        <div class="bg-base-100 rounded-box shadow">
          <div v-if="!recentErrors || recentErrors.length === 0" class="p-4 text-base-content/50">
            No unresolved errors.
          </div>
          <table v-else class="table table-sm">
            <thead>
              <tr>
                <th>Category</th>
                <th>Extension</th>
                <th>Message</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="err in recentErrors" :key="err.id">
                <td><span class="badge badge-sm badge-ghost">{{ err.category ?? '-' }}</span></td>
                <td class="font-mono text-xs">{{ err.extension ?? '-' }}</td>
                <td class="font-mono text-xs max-w-xs truncate">{{ err.message }}</td>
                <td class="whitespace-nowrap text-xs">{{ fmtDate(err.createdAt) }}</td>
                <td>
                  <NuxtLink :to="`/admin/errors/${err.id}`" class="btn btn-xs btn-ghost">
                    View →
                  </NuxtLink>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>