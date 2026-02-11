<script setup lang="ts">
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  getLocalTimeZone,
  DateFormatter,
  type DateValue,
} from "@internationalized/date";
import { CalendarIcon } from "lucide-vue-next";

const df = new DateFormatter("es-ES", {
  dateStyle: "long",
});

defineProps<{
  label: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  description?: string;
}>();

const date = defineModel<DateValue | null>({ required: true });
</script>

<template>
  <div class="space-y-2">
    <Label for="date"
      >{{ label }} <span v-if="required" class="text-red-600">*</span></Label
    >
    <Popover>
      <PopoverTrigger as-child>
        <Button
          variant="outline"
          :class="
            cn(
              'w-full justify-start text-left font-normal',
              !date && 'text-muted-foreground'
            )
          "
        >
          <CalendarIcon class="mr-2 h-4 w-4" />
          {{
            date && typeof date.toDate === 'function'
              ? df.format(date.toDate(getLocalTimeZone()))
              : placeholder || "Establecer fecha"
          }}
        </Button>
      </PopoverTrigger>
      <PopoverContent class="w-auto p-0">
        <Calendar
          v-model="date"
          locale="es-ES"
          :disabled="disabled"
          :class="{ 'border-destructive': error }"
        />
      </PopoverContent>
    </Popover>
    <p v-if="error" class="text-sm text-destructive">
      {{ error }}
    </p>
  </div>
</template>
