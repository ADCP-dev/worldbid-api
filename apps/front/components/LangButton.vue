<script setup lang="ts">
const { locale, locales, setLocale } = useI18n()

const availableLocales = computed(() => {
    return locales.value.filter(i => i.code !== locale.value)
})
</script>
<template>
    <DropdownMenu>
        <DropdownMenuTrigger as-child>
            <Button variant="outline" class="mr-4 cursor-pointer">
                {{ locale }}
            </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
            <DropdownMenuItem v-for="locale in availableLocales" :key="locale.code"
                @click.prevent.stop="setLocale(locale.code)">
                {{ locale.name }}
            </DropdownMenuItem>
        </DropdownMenuContent>
    </DropdownMenu>
</template>