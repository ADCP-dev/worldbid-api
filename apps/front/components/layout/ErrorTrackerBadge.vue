<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { AlertTriangle, X } from 'lucide-vue-next';

/**
 * ErrorTrackerBadge — navbar indicator showing the count of backend errors.
 * Click opens a dropdown with recent errors. Admin-only.
 *
 * Polls /api/v1/system/errors every 60s when the page is visible. Shows a
 * red badge with the count when there are errors.
 */
const authStore = useAuthStore();
const { t } = useI18n();

const errorCount = ref(0);
const errors = ref<Array<{ id: string; message: string; source?: string; createdAt: string }>>([]);
const open = ref(false);
const loading = ref(false);

async function fetchErrors(): Promise<void> {
  if (!authStore.isAdmin) return;
  try {
    loading.value = true;
    const data = await useErrors().fetchErrors();
    errors.value = (data ?? []).slice(0, 10);
    errorCount.value = (data ?? []).length;
  } catch {
    // silent — don't spam the navbar if the endpoint is down
  } finally {
    loading.value = false;
  }
}

async function clearAll(): Promise<void> {
  try {
    await useErrors().clearErrors();
    errors.value = [];
    errorCount.value = 0;
  } catch {
    // silent
  }
  open.value = false;
}

async function deleteOne(id: string): Promise<void> {
  try {
    await useErrors().deleteError(id);
    errors.value = errors.value.filter((e) => e.id !== id);
    errorCount.value = Math.max(0, errorCount.value - 1);
  } catch {
    // silent
  }
}

onMounted(() => {
  if (authStore.isAdmin) {
    void fetchErrors();
    // Poll every 60s
    setInterval(() => {
      if (document.visibilityState === 'visible') {
        void fetchErrors();
      }
    }, 60_000);
  }
});

watch(() => authStore.isAdmin, (isAdmin) => {
  if (isAdmin) void fetchErrors();
});
</script>

<template>
  <div v-if="authStore.isAdmin" class="relative">
    <button
      class="btn btn-xs btn-ghost btn-circle"
      :class="{ 'text-error': errorCount > 0 }"
      :aria-label="t('mod.nav.errorLog', 'Error Log')"
      @click="open = !open"
    >
      <AlertTriangle :size="16" />
      <span
        v-if="errorCount > 0"
        class="badge badge-error badge-xs absolute -top-0.5 -right-0.5 text-[8px] px-1"
      >
        {{ errorCount > 99 ? '99+' : errorCount }}
      </span>
    </button>

    <!-- Dropdown -->
    <div
      v-if="open"
      class="absolute right-0 top-full mt-1 z-50 w-96 max-h-96 bg-base-100 border border-base-300 rounded-lg shadow-xl flex flex-col"
      @click.stop
    >
      <div class="flex items-center justify-between px-3 py-2 border-b border-base-300">
        <span class="font-semibold text-sm">
          {{ t('mod.nav.errorLog', 'Error Log') }}
          <span v-if="errorCount > 0" class="badge badge-error badge-sm ml-1">{{ errorCount }}</span>
        </span>
        <div class="flex gap-1">
          <button
            v-if="errors.length > 0"
            class="btn btn-xs btn-ghost text-error"
            @click="clearAll"
          >
            {{ t('mod.nav.clearErrors', 'Clear all') }}
          </button>
          <button class="btn btn-xs btn-ghost btn-circle" @click="open = false">
            <X :size="13" />
          </button>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto p-2 space-y-1.5">
        <div v-if="loading" class="flex justify-center py-4">
          <span class="loading loading-spinner loading-sm" />
        </div>
        <div v-else-if="errors.length === 0" class="text-center py-4 text-sm text-base-content/40">
          {{ t('mod.nav.noErrors', 'No errors') }}
        </div>
        <div
          v-for="err in errors"
          :key="err.id"
          class="p-2 rounded-md bg-base-200 border border-base-300 group"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="flex-1 min-w-0">
              <p class="text-xs font-mono text-error truncate">{{ err.message }}</p>
              <p class="text-[10px] text-base-content/40 mt-0.5">
                <span v-if="err.source">{{ err.source }} · </span>
                {{ new Date(err.createdAt).toLocaleString() }}
              </p>
            </div>
            <button
              class="btn btn-xs btn-ghost btn-square h-5 w-5 min-h-5 opacity-0 group-hover:opacity-100"
              @click="deleteOne(err.id)"
            >
              <X :size="10" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>