<script setup lang="ts">
import { useRouteQuery } from '@/composables/useRouteQuery'

const props = withDefaults(defineProps<{
  currentPage: number;
  totalPages: number;
  baseUrl: string;
}>(), {
  currentPage: 1,
  totalPages: 1,
  baseUrl: '',
});

const route = useRoute();
const { buildQueryString } = useRouteQuery()

function pageUrl(n: number): string {
  const overrides = n > 1 ? { page: n } : {}
  const qs = buildQueryString(overrides)
  return `${props.baseUrl || route.path}${qs ? '?' + qs : ''}`;
}
</script>

<template>
  <div v-if="totalPages > 1" class="flex justify-center gap-1 mt-8">
    <NuxtLink
      v-if="currentPage > 1"
      :to="pageUrl(currentPage - 1)"
      class="btn btn-sm btn-outline"
    >
      «
    </NuxtLink>
    <template v-for="n in totalPages" :key="n">
      <NuxtLink
        v-if="n === 1 || n === totalPages || Math.abs(n - currentPage) <= 1"
        :to="pageUrl(n)"
        :class="['btn btn-sm', n === currentPage ? 'btn-primary' : 'btn-outline']"
      >
        {{ n }}
      </NuxtLink>
      <span v-else-if="n === currentPage - 2 || n === currentPage + 2" class="btn btn-sm btn-ghost no-animation cursor-default">
        …
      </span>
    </template>
    <NuxtLink
      v-if="currentPage < totalPages"
      :to="pageUrl(currentPage + 1)"
      class="btn btn-sm btn-outline"
    >
      »
    </NuxtLink>
  </div>
</template>
