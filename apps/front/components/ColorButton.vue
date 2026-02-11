<script setup lang="ts">
import { MoonIcon, SunIcon } from 'lucide-vue-next';

const colorMode = useColorMode()
</script>
<template>
    <DropdownMenu>
        <DropdownMenuTrigger as-child>
            <Button variant="outline" class="mr-4 cursor-pointer">
                <MoonIcon
                    class="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <SunIcon
                    class="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span class="sr-only"> Cambiar tema </span>
            </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
            <DropdownMenuItem @click="colorMode.preference = 'light'">
                Claro
            </DropdownMenuItem>
            <DropdownMenuItem @click="colorMode.preference = 'dark'">
                Oscuro
            </DropdownMenuItem>
            <DropdownMenuItem @click="colorMode.preference = 'system'">
                Sistema
            </DropdownMenuItem>
        </DropdownMenuContent>
    </DropdownMenu>
</template>