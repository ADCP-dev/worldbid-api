<script setup lang="ts">
import { MoonIcon, SunIcon } from 'lucide-vue-next';

const colorMode = useColorMode()
</script>
<template>
    <div class="dropdown dropdown-end">
        <div tabindex="0" role="button" class="btn btn-outline btn-sm btn-square relative">
            <MoonIcon
                class="h-[1.2rem] w-[1.2rem] transition-all dark:opacity-0 dark:scale-0 opacity-100 scale-100" />
            <SunIcon
                class="absolute h-[1.2rem] w-[1.2rem] transition-all dark:opacity-100 dark:scale-100 opacity-0 scale-0" />
            <span class="sr-only"> Cambiar tema </span>
        </div>
        <ul tabindex="0" class="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-32 mt-2 border ">
            <li><button @click="colorMode.preference = 'light'">Claro</button></li>
            <li><button @click="colorMode.preference = 'dark'">Oscuro</button></li>
            <li><button @click="colorMode.preference = 'system'">Sistema</button></li>
        </ul>
    </div>
</template>
