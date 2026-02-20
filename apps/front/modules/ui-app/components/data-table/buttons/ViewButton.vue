<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-vue-next";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
const emit = defineEmits(["click"]);

const props = defineProps<{
  ariaLabel: string;
  label?: string;
}>();
</script>

<template>
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger>
        <Button variant="outline" class="p-0" :class="{ 'h-8 flex items-center justify-center': props.label, 'w-8 h-8': !props.label }" :aria-label="props.ariaLabel" @click="emit('click')"><Eye />{{ props.label }}</Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Ver</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</template>