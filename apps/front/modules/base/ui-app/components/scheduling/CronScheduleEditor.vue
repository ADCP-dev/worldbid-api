<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Settings2, CalendarClock } from 'lucide-vue-next';

import FormInput from '@base/ui-app/components/form/FormInput.vue';
import FormTime from '@base/ui-app/components/form/FormTime.vue';
import WeekdayPicker from '@base/ui-app/components/form/WeekdayPicker.vue';
import NumericStepper from '@base/ui-app/components/form/NumericStepper.vue';
import { cronToHuman, parseCron } from './lib/cronToHuman';
import type { CronMode, ParsedCron } from './types';

const props = withDefaults(defineProps<{
  modelValue: string;
  label: string;
  description?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  timezone?: 'user' | 'server';
  allowAdvanced?: boolean;
}>(), {
  timezone: 'server',
  allowAdvanced: true,
  disabled: false,
});

const { t } = useI18n();
const model = defineModel<string>({ default: '0 * * * *' });

const MODES: CronMode[] = ['every-n-minutes', 'daily-at', 'weekly-on', 'monthly-on'];

// --- internal state per mode -------------------------------------------------
const advancedMode = ref(false);
const activeMode = ref<CronMode>('daily-at');
const intervalMinutes = ref(15);
const dailyTime = ref('09:00');
const weeklyDays = ref<number[]>([1]);
const monthlyDay = ref<string>('1');
const monthlyTime = ref('09:00');
const rawCron = ref(model.value);

// --- validation --------------------------------------------------------------
const CRON_REGEX = /^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)$/;

function detectAdvanced(cron: string): void {
  const parsed = parseCron(cron);
  if (!parsed) {
    advancedMode.value = props.allowAdvanced;
    rawCron.value = cron;
    return;
  }
  advancedMode.value = false;
  applyParsedToState(parsed);
}

function applyParsedToState(parsed: ParsedCron): void {
  activeMode.value = parsed.mode;
  if (parsed.mode === 'every-n-minutes' && parsed.intervalMinutes) {
    intervalMinutes.value = parsed.intervalMinutes;
  } else if (parsed.mode === 'daily-at' && parsed.time) {
    dailyTime.value = parsed.time;
  } else if (parsed.mode === 'weekly-on' && parsed.time && parsed.weekdays) {
    weeklyDays.value = parsed.weekdays;
    dailyTime.value = parsed.time;
  } else if (parsed.mode === 'monthly-on' && parsed.time && parsed.dayOfMonth) {
    monthlyDay.value = parsed.dayOfMonth;
    monthlyTime.value = parsed.time;
  }
}

// --- cron builders (simple → string) ----------------------------------------
function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function buildEveryN(): string {
  return `*/${intervalMinutes.value} * * * *`;
}

function buildDailyAt(): string {
  const [h, m] = dailyTime.value.split(':');
  return `${m ?? '0'} ${h ?? '0'} * * *`;
}

function buildWeeklyOn(): string {
  const [h, m] = dailyTime.value.split(':');
  const dow = [...weeklyDays.value].sort((a, b) => a - b).join(',') || '*';
  return `${m ?? '0'} ${h ?? '0'} * * ${dow}`;
}

function buildMonthlyOn(): string {
  const [h, m] = monthlyTime.value.split(':');
  const dom = monthlyDay.value || '*';
  return `${m ?? '0'} ${h ?? '0'} ${dom} * *`;
}

const rawError = computed(() => {
  if (!advancedMode.value) return '';
  if (!CRON_REGEX.test(rawCron.value)) {
    return t('base.app.scheduling.cron.errors.invalid');
  }
  return '';
});

// --- emit ---------------------------------------------------------------------
function buildCronForMode(mode: CronMode): string {
  switch (mode) {
    case 'every-n-minutes': return buildEveryN();
    case 'daily-at': return buildDailyAt();
    case 'weekly-on': return buildWeeklyOn();
    case 'monthly-on': return buildMonthlyOn();
    default: return model.value;
  }
}

// reactive emission when simple-mode state changes
watch([activeMode, intervalMinutes, dailyTime, weeklyDays, monthlyDay, monthlyTime, advancedMode, rawCron], () => {
  if (advancedMode.value) {
    if (!rawError.value) model.value = rawCron.value;
    return;
  }
  model.value = buildCronForMode(activeMode.value);
});

// react to external modelValue changes (e.g. parent reset)
watch(() => props.modelValue, (next) => {
  if (next === model.value) return;
  detectAdvanced(next);
});

// initialize from incoming value once
detectAdvanced(model.value);

// --- preview + timezone note -------------------------------------------------
const preview = computed(() => cronToHuman(model.value));

const timezoneNote = computed(() => {
  if (props.timezone !== 'user') return '';
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const offsetMin = -new Date().getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '−';
  const abs = Math.abs(offsetMin);
  const hh = pad(Math.floor(abs / 60));
  const mm = pad(abs % 60);
  return t('base.app.scheduling.cron.timezoneNote', { tz, offset: `${sign}${hh}:${mm}` });
});

function toggleAdvanced(): void {
  if (props.disabled) return;
  if (!advancedMode.value) rawCron.value = model.value;
  advancedMode.value = !advancedMode.value;
}
</script>

<template>
  <div class="form-control w-full">
    <label class="label">
      <span class="label-text font-semibold">
        {{ label }}<span v-if="required" class="text-error ml-1">*</span>
      </span>
    </label>

    <p v-if="description" class="text-sm text-base-content/60 mb-2">{{ description }}</p>

    <!-- mode tabs -->
    <div v-if="!advancedMode" role="tablist" class="tabs tabs-boxed mb-3">
      <button
        v-for="mode in MODES"
        :key="mode"
        type="button"
        role="tab"
        :aria-selected="activeMode === mode"
        class="tab"
        :class="{ 'tab-active': activeMode === mode }"
        :disabled="disabled"
        @click="activeMode = mode"
      >
        {{ t(`base.app.scheduling.cron.modes.${mode}`) }}
      </button>
    </div>

    <!-- simple mode inputs -->
    <div v-if="!advancedMode" class="space-y-3">
      <NumericStepper
        v-if="activeMode === 'every-n-minutes'"
        v-model="intervalMinutes"
        :min="1"
        :max="59"
        :label="t('base.app.scheduling.cron.fields.intervalMinutes')"
        :disabled="disabled"
        unit="minutos"
      />

      <FormTime
        v-if="activeMode === 'daily-at' || activeMode === 'weekly-on'"
        v-model="dailyTime"
        :label="t('base.app.scheduling.cron.fields.time')"
        :disabled="disabled"
      />

      <WeekdayPicker
        v-if="activeMode === 'weekly-on'"
        v-model="weeklyDays"
        :label="t('base.app.scheduling.cron.fields.weekdays')"
        :disabled="disabled"
      />

      <template v-if="activeMode === 'monthly-on'">
        <FormInput
          v-model="monthlyDay"
          :label="t('base.app.scheduling.cron.fields.dayOfMonth')"
          :description="t('base.app.scheduling.cron.fields.dayOfMonthHint')"
          :disabled="disabled"
        />
        <FormTime
          v-model="monthlyTime"
          :label="t('base.app.scheduling.cron.fields.time')"
          :disabled="disabled"
        />
      </template>
    </div>

    <!-- advanced mode raw editor -->
    <div v-else class="space-y-1">
      <FormInput
        v-model="rawCron"
        :label="t('base.app.scheduling.cron.advancedLabel')"
        :error="rawError"
        :disabled="disabled"
      />
      <p class="text-xs text-base-content/50">
        {{ t('base.app.scheduling.cron.advancedHint') }}
      </p>
    </div>

    <!-- preview -->
    <div class="mt-3 p-3 bg-base-200 rounded-box flex items-start gap-2">
      <CalendarClock class="h-4 w-4 mt-0.5 shrink-0 text-base-content/60" />
      <div class="min-w-0">
        <p class="text-xs uppercase tracking-wide text-base-content/50">
          {{ t('base.app.scheduling.cron.preview') }}
        </p>
        <p class="font-medium break-words">{{ preview }}</p>
        <slot name="hint" />
      </div>
    </div>

    <!-- timezone note -->
    <p v-if="timezoneNote" class="text-xs text-base-content/50 mt-1">
      {{ timezoneNote }}
    </p>

    <!-- advanced toggle -->
    <div v-if="allowAdvanced" class="mt-2">
      <button
        type="button"
        class="btn btn-ghost btn-xs"
        :disabled="disabled"
        @click="toggleAdvanced"
      >
        <Settings2 class="h-3.5 w-3.5" />
        {{ advancedMode
          ? t('base.app.scheduling.cron.simpleMode')
          : t('base.app.scheduling.cron.advancedMode') }}
      </button>
    </div>

    <label v-if="error" class="label py-0 mt-2">
      <span class="label-text-alt text-error font-medium">{{ error }}</span>
    </label>
  </div>
</template>