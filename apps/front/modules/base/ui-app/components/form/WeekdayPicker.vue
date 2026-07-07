<script setup lang="ts">
import { computed, ref } from 'vue';
import { onKeyStroke } from '@vueuse/core';

const props = withDefaults(defineProps<{
  modelValue: number[];
  label?: string;
  firstDayOfWeek?: 0 | 1;
  presets?: boolean;
  disabled?: boolean;
}>(), {
  firstDayOfWeek: 1,
  presets: true,
  disabled: false,
});

const model = defineModel<number[]>({ default: () => [] });

// ISO order: 0=Sun ... 6=Sat. Labels in Spanish.
const DAYS = [
  { iso: 1, short: 'L' },
  { iso: 2, short: 'M' },
  { iso: 3, short: 'X' },
  { iso: 4, short: 'J' },
  { iso: 5, short: 'V' },
  { iso: 6, short: 'S' },
  { iso: 0, short: 'D' },
];

const orderedDays = computed(() => {
  return props.firstDayOfWeek === 0
    ? [...DAYS.slice(-1), ...DAYS.slice(0, -1)]
    : DAYS;
});

const rootRef = ref<HTMLElement | null>(null);
const activeIso = ref<number | null>(null);

function toggle(iso: number): void {
  if (props.disabled) return;
  const set = new Set(model.value);
  if (set.has(iso)) set.delete(iso);
  else set.add(iso);
  model.value = Array.from(set).sort((a, b) => a - b);
}

function isSelected(iso: number): boolean {
  return model.value.includes(iso);
}

function setPreset(name: 'weekdays' | 'weekends' | 'none'): void {
  if (props.disabled) return;
  if (name === 'weekdays') model.value = [1, 2, 3, 4, 5];
  else if (name === 'weekends') model.value = [0, 6];
  else model.value = [];
}

function ariaLabel(day: { iso: number; short: string }): string {
  const names = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  return names[day.iso] ?? day.short;
}

// Keyboard navigation (NFR-011): arrows move, Enter/Space toggles, Escape blurs.
onKeyStroke(['ArrowLeft', 'ArrowRight', 'Enter', 'Escape', ' '], (event) => {
  if (activeIso.value === null) return;
  const list = orderedDays.value.map((d) => d.iso);
  const idx = list.indexOf(activeIso.value);
  if (idx === -1) return;
  const target = event.target as HTMLElement;

  if (event.key === 'ArrowRight') {
    activeIso.value = list[(idx + 1) % list.length];
    event.preventDefault();
  } else if (event.key === 'ArrowLeft') {
    activeIso.value = list[(idx - 1 + list.length) % list.length];
    event.preventDefault();
  } else if (event.key === 'Enter' || event.key === ' ') {
    toggle(activeIso.value);
    event.preventDefault();
  } else if (event.key === 'Escape') {
    target.blur();
    activeIso.value = null;
    event.preventDefault();
  }
});
</script>

<template>
  <div class="form-control w-full">
    <label v-if="label" class="label">
      <span class="label-text font-semibold">{{ label }}</span>
    </label>

    <div
      ref="rootRef"
      role="group"
      :aria-label="label || 'Días de la semana'"
      class="flex flex-wrap items-center gap-1"
    >
      <button
        v-for="day in orderedDays"
        :key="day.iso"
        type="button"
        :aria-label="ariaLabel(day)"
        :aria-pressed="isSelected(day.iso)"
        :disabled="disabled"
        :tabindex="activeIso === day.iso ? 0 : -1"
        class="btn btn-sm w-10 h-10"
        :class="{
          'btn-primary': isSelected(day.iso),
          'btn-outline': !isSelected(day.iso),
          'btn-disabled cursor-not-allowed': disabled,
        }"
        @click="toggle(day.iso)"
        @focus="activeIso = day.iso"
        @blur="activeIso = null"
      >
        {{ day.short }}
      </button>
    </div>

    <div v-if="presets" class="flex gap-2 mt-2">
      <button
        type="button"
        class="btn btn-ghost btn-xs"
        :disabled="disabled"
        @click="setPreset('weekdays')"
      >{{ $t('base.app.scheduling.weekdayPicker.presets.weekdays') }}</button>
      <button
        type="button"
        class="btn btn-ghost btn-xs"
        :disabled="disabled"
        @click="setPreset('weekends')"
      >{{ $t('base.app.scheduling.weekdayPicker.presets.weekends') }}</button>
      <button
        type="button"
        class="btn btn-ghost btn-xs"
        :disabled="disabled"
        @click="setPreset('none')"
      >{{ $t('base.app.scheduling.weekdayPicker.presets.none') }}</button>
    </div>
  </div>
</template>