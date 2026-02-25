<script setup lang="ts">
import { Edit } from "lucide-vue-next";

const emit = defineEmits(["click"]);
</script>

<template>
  <div class="tooltip" data-tip="Editar">
    <button type="button" class="btn btn-info btn-sm w-8 h-8 p-0" @click="emit('click')">
      <Edit class="w-4 h-4" />
    </button>
  </div>
</template>
