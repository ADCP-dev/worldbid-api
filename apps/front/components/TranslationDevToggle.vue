<script setup lang="ts">
import { LanguagesIcon } from 'lucide-vue-next';

const showKeys = useState('i18n-show-keys', () => false)

const toggleKeys = () => {
  showKeys.value = !showKeys.value
}
</script>

<template>
  <div class="fixed bottom-4 right-4 z-[9999]">
    <button
      class="btn btn-circle shadow-lg opacity-70 hover:opacity-100 transition-opacity border border-base-content/20"
      :class="showKeys ? 'btn-primary' : 'btn-neutral'"
      title="Toggle Translation Keys"
      @click="toggleKeys"
    >
      <LanguagesIcon class="w-5 h-5" />
    </button>
  </div>
</template>
