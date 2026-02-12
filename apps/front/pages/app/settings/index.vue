<script setup lang="ts">
definePageMeta({
    middleware: [
        function (to, from) {
            return navigateTo('/app/settings/profile')
        },
    ],
})
</script>

<template>
    <div>
        <!-- Optional: a loading state if needed, though middleware redirect is immediate -->
    </div>
</template>
