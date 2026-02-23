<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Button } from '@/components/ui/button'
import { Languages } from 'lucide-vue-next'

const isDev = process.env.NODE_ENV === 'development'
const showKeys = useState('i18n-show-keys', () => false)

const toggleKeys = () => {
    showKeys.value = !showKeys.value
}
</script>

<template>
    <div v-if="isDev" class="fixed bottom-4 right-4 z-[9999]">
        <Button
            @click="toggleKeys"
            :variant="showKeys ? 'default' : 'secondary'"
            size="icon"
            class="rounded-full shadow-lg opacity-70 hover:opacity-100 transition-opacity"
            title="Toggle Translation Keys"
        >
            <Languages class="w-5 h-5" />
        </Button>
    </div>
</template>
