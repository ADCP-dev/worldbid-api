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
        401
      </h1>
      <span class="font-medium">Acceso no autorizado</span>
      <p class="text-center text-muted-foreground">
        Por favor, inicia sesión con las credenciales apropiadas <br> para acceder a este recurso.
      </p>
      <div class="mt-6 flex gap-4">
        <Button variant="outline" @click="router.back()">
          Volver
        </Button>
        <Button @click="navigateTo('/')">
          Volver al inicio
        </Button>
      </div>
    </div>
  </div>
</template>

<style scoped>

</style>
