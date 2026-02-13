<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { Edit } from "lucide-vue-next";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
const emit = defineEmits(["click"]);
</script>

<template>
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger>
        <Button variant="blue"  class="w-8 h-8 p-0" @click="emit('click')"><Edit /></Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Editar</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</template>