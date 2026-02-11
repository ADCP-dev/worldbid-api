<script setup lang="ts">
import Label from "~/components/ui/label/Label.vue";
import Select from "~/components/ui/select/Select.vue";
import { PlusCircle } from "lucide-vue-next";
import Button from "~/components/ui/button/Button.vue";

defineProps<{
  label: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  description?: string;
  options?: Array<{ label: string; value: string | number }>;
  // Props for create button
  showCreateButton?: boolean;
  createButtonText?: string;
  createButtonIcon?: boolean;
  onCreateClick?: () => void;
}>();

const model = defineModel<string | number>();

const slots = useSlots();
</script>

<template>
  <div class="relative space-y-2">
    <Label
      >{{ label }}<span v-if="required" class="text-red-600">*</span></Label
    >
    <Select
      v-model="model"
      :placeholder="placeholder"
      :disabled="disabled"
    >
      <SelectTrigger class="w-full" :class="{ 'border-destructive': error }">
        <SelectValue :placeholder="placeholder" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem v-for="option in options" :key="option.value" :value="option.value">
          {{ option.label }}
        </SelectItem>
        
        <!-- Create button at the bottom (conditional) -->
        <div 
          v-if="showCreateButton" 
          class="px-2 py-2 sticky bottom-0 border-t border-border bg-popover mt-1"
        >
          <Button
            type="button"
            variant="outline"
            @click.stop="onCreateClick && onCreateClick()"
          >
            <PlusCircle v-if="createButtonIcon" class="mr-2 h-4 w-4" />
            {{ createButtonText || 'Crear nuevo' }}
          </Button>
        </div>
      </SelectContent>
    </Select>
    <p v-if="description" class="text-xs text-muted-foreground">
      {{ description }}
    </p>
    <span
      v-if="slots['icon-start']"
      class="absolute start-0 inset-y-0 flex items-center justify-center px-2"
    >
      <slot name="icon-start" />
    </span>
    <span
      v-if="slots['icon-end']"
      class="absolute end-0 inset-y-0 flex items-center justify-center px-2"
    >
      <slot name="icon-end" />
    </span>
    <p v-if="error" class="text-sm text-destructive">
      {{ error }}
    </p>
  </div>
</template>
