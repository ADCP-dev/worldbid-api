<script setup lang="ts">
import NumberFlow from "@number-flow/vue";

defineProps<{
  title: string;
  icon: any;
  value: number;
  valueFormat?: any;
  valuePrefix?: string;
  descriptionValue: number;
  descriptionPrefix?: string;
  descriptionFormat?: any;
  descriptionSuffix: string;
}>();
</script>

<template>
  <div class="card bg-base-100 shadow-sm border border-base-300">
    <div class="card-body p-6 gap-0">
      <div class="flex flex-row items-center justify-between pb-2">
        <h3 class="text-sm font-medium">
          {{ title }}
        </h3>
        <component :is="icon" class="h-4 w-4 text-base-content/60" />
      </div>
      <div class="text-2xl font-bold">
        <NumberFlow
          :value="value"
          :format="valueFormat"
          :prefix="valuePrefix"
        />
      </div>
      <p class="text-xs text-base-content/60">
        <NumberFlow
          :value="descriptionValue"
          :prefix="descriptionPrefix"
          :format="descriptionFormat"
        />
        {{ descriptionSuffix }}
      </p>
    </div>
  </div>
</template>
