<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import FormTime from '@base/ui-app/components/form/FormTime.vue';
import type { TimeWindow } from '@base/ui-app/components/scheduling/types';

const props = withDefaults(defineProps<{
  modelValue: TimeWindow;
  label?: string;
  error?: string;
  disabled?: boolean;
}>(), {
  disabled: false,
});

const { t } = useI18n();

const model = defineModel<TimeWindow>({
  default: { start: '09:00', end: '17:00', timezone: 'UTC' },
});

const COMMON_TIMEZONES = [
  'UTC',
  'Europe/Madrid',
  'America/Argentina/Buenos_Aires',
  'America/Mexico_City',
  'America/New_York',
  'America/Los_Angeles',
];

const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

const innerError = ref('');

function compare(a: string, b: string): number {
  return a.localeCompare(b);
}

const start = computed({
  get: () => model.value.start,
  set: (v: string) => {
    const next = { ...model.value, start: v };
    if (compare(next.end, next.start) <= 0) {
      innerError.value = t('base.app.scheduling.timeWindow.errors.endBeforeStart');
      return;
    }
    innerError.value = '';
    model.value = next;
  },
});

const end = computed({
  get: () => model.value.end,
  set: (v: string) => {
    const next = { ...model.value, end: v };
    if (compare(next.end, next.start) <= 0) {
      innerError.value = t('base.app.scheduling.timeWindow.errors.endBeforeStart');
      return;
    }
    innerError.value = '';
    model.value = next;
  },
});

const timezone = computed({
  get: () => model.value.timezone,
  set: (v: string) => {
    model.value = { ...model.value, timezone: v };
  },
});

const hasError = computed(() => Boolean(props.error || innerError.value));

function tzLabel(tz: string): string {
  if (tz === localTz) {
    return `${tz} (${t('base.app.scheduling.timeWindow.local')})`;
  }
  return tz;
}
</script>

<template>
  <div class="form-control w-full">
    <label v-if="label" class="label">
      <span class="label-text font-semibold">{{ label }}</span>
    </label>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <FormTime
        v-model="start"
        :label="t('base.app.scheduling.timeWindow.start')"
        :disabled="disabled"
      />
      <FormTime
        v-model="end"
        :label="t('base.app.scheduling.timeWindow.end')"
        :disabled="disabled"
      />
    </div>

    <div class="mt-3">
      <label class="label">
        <span class="label-text font-semibold">
          {{ t('base.app.scheduling.timeWindow.timezone') }}
        </span>
      </label>
      <select
        v-model="timezone"
        class="select select-bordered w-full"
        :disabled="disabled"
      >
        <option v-for="tz in COMMON_TIMEZONES" :key="tz" :value="tz">
          {{ tzLabel(tz) }}
        </option>
        <option v-if="!COMMON_TIMEZONES.includes(localTz)" :value="localTz">
          {{ tzLabel(localTz) }}
        </option>
      </select>
    </div>

    <label v-if="hasError" class="label py-0 mt-2">
      <span class="label-text-alt text-error font-medium">
        {{ error || innerError }}
      </span>
    </label>
  </div>
</template>