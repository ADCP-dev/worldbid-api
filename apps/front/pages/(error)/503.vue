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
        503
      </h1>
      <span class="font-medium">{{ $t('base.error.503.title') }}</span>
      <p class="text-center text-muted-foreground" v-html="$t('base.error.503.description')"/>
      <div class="mt-6 flex gap-4">
        <Button variant="outline" @click="router.back()">
          {{ $t('base.error.goBack') }}
        </Button>
        <Button @click="navigateTo('/')">
          {{ $t('base.error.goHome') }}
        </Button>
      </div>
    </div>
  </div>
</template>

<style scoped>

</style>
