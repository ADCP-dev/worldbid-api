<script setup lang="ts">
import Label from '~/components/ui/label/Label.vue';
import { Clock } from 'lucide-vue-next';
import { Input } from '~/components/ui/input';
import { cn } from '~/lib/utils';
import { ref } from 'vue';

defineProps<{
  label: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  description?: string;
  name?: string;
  showIcon?: boolean;
}>();

const model = defineModel<string>();
const slots = useSlots();
const inputRef = ref<HTMLInputElement | null>(null);

// Custom time input clicks handler to always show time picker
const handleContainerClick = (event: MouseEvent) => {
  // Only open the picker if we're not clicking on another control
  if (event.target === event.currentTarget || 
      (event.target as HTMLElement).classList.contains('time-input-container')) {
    inputRef.value?.showPicker();
  }
};

const inputClasses = computed(() => {
  return cn(
    'pl-8',
    slots['icon-end'] && 'pr-10',
    'time-input' // Add class for styling
  );
});

</script>

<template>
  <div class="relative space-y-2">
    <Label>
      {{ label }}<span v-if="required" class="text-red-600">*</span>
    </Label>
    <div 
      class="relative flex time-input-container cursor-pointer" 
      @click="handleContainerClick"
    >
      <Clock 
        class="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" 
        v-if="!slots['icon-start']" 
      />
      <span 
        v-if="slots['icon-start']" 
        class="absolute start-0 inset-y-0 flex items-center justify-center px-2 text-muted-foreground"
      >
        <slot name="icon-start" />
      </span>
      
      <Input
        ref="inputRef"
        :name="name"
        v-model="model"
        type="time"
        step="60"
        :placeholder="placeholder"
        :required="required"
        :disabled="disabled"
        :class="inputClasses"
        min="00:00"
        max="23:59"
      />
      
      <span 
        v-if="slots['icon-end']" 
        class="absolute end-0 inset-y-0 flex items-center justify-center px-2 text-muted-foreground"
      >
        <slot name="icon-end" />
      </span>
    </div>
    
    <p v-if="description" class="text-xs text-muted-foreground">
      {{ description }}
    </p>
    <p v-if="error" class="text-sm text-destructive">
      {{ error }}
    </p>
  </div>
</template>

<style scoped>
/* Hide the default browser time input icon/widget */
.time-input::-webkit-calendar-picker-indicator {
  display: none;
  -webkit-appearance: none;
  appearance: none;
  opacity: 0;
}

/* Make sure the input field doesn't show any default styling for time inputs */
.time-input {
  position: relative;
  cursor: pointer;
}

/* Add some better hover effect on the container */
.time-input-container:hover {
  background-color: hsl(var(--muted) / 0.2);
  border-radius: 0.375rem;
}

/* Improve cursor and click experience */
.time-input-container {
  transition: background-color 0.2s ease;
}
</style>
