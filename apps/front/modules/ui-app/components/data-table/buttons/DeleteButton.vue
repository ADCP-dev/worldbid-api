<script setup lang="ts">
import { Trash2 } from "lucide-vue-next";

const emit = defineEmits(["click"]);
</script>

<template>
  <div class="tooltip" data-tip="Eliminar">
    <button type="button" class="btn btn-error btn-sm w-8 h-8 p-0" @click="emit('click')">
      <Trash2 class="w-4 h-4" />
    </button>
  </div>
</template>
