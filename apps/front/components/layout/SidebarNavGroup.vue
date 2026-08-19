<script setup lang="ts">
import type { NavGroup } from "~/types/nav";
import AppIcon from "../AppIcon.vue";

withDefaults(
  defineProps<{
    item: NavGroup;
    size?: any;
  }>(),
  {
    size: "default",
  }
);

const closeDrawer = () => {
  if (typeof document !== 'undefined') {
    const el = document.getElementById('main-drawer') as HTMLInputElement
    if (el) el.checked = false
  }
}
</script>

<template>
  <li>
    <details>
      <summary class="is-drawer-close:tooltip is-drawer-close:tooltip-right is-drawer-close:justify-center" :data-tip="item.title">
        <AppIcon :name="item.icon || ''" mode="svg" />
        <span class="is-drawer-close:hidden">{{ item.title }}</span>
        <span
          v-if="item.new"
          class="rounded-md bg-#adfa1d px-1.5 py-0.5 text-xs text-black leading-none no-underline group-hover:no-underline is-drawer-close:hidden"
        >
          New
        </span>
      </summary>
      <ul class="is-drawer-close:hidden">
        <li
          v-for="subItem in item.children"
          :key="subItem.title"
        >
          <NuxtLink
            :to="subItem.link"
            class="rounded-md"
            exact-active-class="bg-primary/10"
          >
            <template #default>
              <span>{{ subItem.title }}</span>
              <span
                v-if="subItem.new"
                class="rounded-md bg-#adfa1d px-1.5 py-0.5 text-xs text-black leading-none no-underline group-hover:no-underline"
              >
                New
              </span>
            </template>
          </NuxtLink>
        </li>
      </ul>
    </details>
  </li>
</template>

<style scoped></style>
