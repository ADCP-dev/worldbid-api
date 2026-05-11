<script setup lang="ts">
const route = useRoute();
const sessionId = route.query.session_id as string;
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-base-200">
    <div class="card bg-base-100 shadow-xl max-w-md w-full mx-4">
      <div class="card-body text-center">
        <div class="text-5xl mb-4">✅</div>
        <h1 class="card-title text-2xl justify-center">¡Pago exitoso!</h1>
        <p class="text-base-content/60 mt-2">
          Tu suscripción se ha activado correctamente.
        </p>
        <p v-if="sessionId" class="text-xs text-base-content/40 mt-4 font-mono break-all">
          Sesión: {{ sessionId }}
        </p>
        <div class="card-actions justify-center mt-6">
          <NuxtLink to="/app/settings/plan" class="btn btn-primary">
            Ir a mi suscripción
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>
