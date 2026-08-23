<script setup>
definePageMeta({
  layout: 'blank',
})

const router = useRouter()
</script>

<template>
  <div class="h-svh">
    <div class="m-auto h-full w-full flex flex-col items-center justify-center gap-2">
      <h1 class="text-[7rem] font-bold leading-tight">
        500
      </h1>
      <span class="font-medium">{{ $t('mod.error.500.title') }}</span>
      <p class="text-center text-muted-foreground" v-html="$t('mod.error.500.description')"/>
      <div class="mt-6 flex gap-4">
        <Button variant="outline" @click="router.back()">
          {{ $t('mod.error.goBack') }}
        </Button>
        <Button @click="navigateTo('/')">
          {{ $t('mod.error.goHome') }}
        </Button>
      </div>
    </div>
  </div>
</template>

<style scoped>

</style>
