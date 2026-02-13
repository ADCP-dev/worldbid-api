<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-vue-next";
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
        <Button type="button" variant="destructive" class="w-8 h-8 p-0" @click="emit('click')"><Trash2 /></Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Eliminar</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</template>