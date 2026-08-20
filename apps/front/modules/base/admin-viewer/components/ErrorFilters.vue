<script setup lang="ts">
export interface ErrorFilterState {
  category: string;
  extension: string;
  severity: string;
  resolved: string;
}

const props = defineProps<{ modelValue: ErrorFilterState }>();
const emit = defineEmits<{ 'update:modelValue': [ErrorFilterState] }>();

function update(field: keyof ErrorFilterState, value: string) {
  emit('update:modelValue', { ...props.modelValue, [field]: value });
}

const categories = ['', 'hook_failure', 'database', 'notification', 'permission', 'validation'];
const severities = ['', 'error', 'warning', 'info'];
const statuses = ['', 'unresolved', 'resolved'];
</script>

<template>
  <div class="flex flex-wrap gap-2 items-center mb-4">
    <select
      class="select select-bordered select-sm"
      :value="modelValue.category"
      @change="update('category', ($event.target as HTMLSelectElement).value)"
    >
      <option value="">All categories</option>
      <option v-for="c in categories.slice(1)" :key="c" :value="c">{{ c }}</option>
    </select>

    <input
      type="text"
      placeholder="Extension"
      class="input input-bordered input-sm w-32"
      :value="modelValue.extension"
      @input="update('extension', ($event.target as HTMLInputElement).value)"
    />

    <select
      class="select select-bordered select-sm"
      :value="modelValue.severity"
      @change="update('severity', ($event.target as HTMLSelectElement).value)"
    >
      <option value="">All severities</option>
      <option v-for="s in severities.slice(1)" :key="s" :value="s">{{ s }}</option>
    </select>

    <select
      class="select select-bordered select-sm"
      :value="modelValue.resolved"
      @change="update('resolved', ($event.target as HTMLSelectElement).value)"
    >
      <option value="">All</option>
      <option v-for="s in statuses.slice(1)" :key="s" :value="s">{{ s }}</option>
    </select>

    <button
      class="btn btn-ghost btn-sm"
      @click="emit('update:modelValue', { category: '', extension: '', severity: '', resolved: '' })"
    >
      Clear
    </button>
  </div>
</template>