<template>
  <div class="h-svh">
    <div
      class="m-auto h-full w-full flex flex-col items-center justify-center gap-2"
    >
      <h1 class="text-[7rem] font-bold leading-tight">{{ error.statusCode }}</h1>
      <span class="font-medium">{{ errorTitle }}</span>
      <p class="text-center text-muted-foreground" v-html="errorMessage"></p>
      <div class="mt-6 flex gap-4">
        <Button variant="outline" @click="router.back()"> Volver </Button>
        <Button @click="navigateTo('/')"> Volver al inicio </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";

const props = defineProps({
  error: Object,
});

definePageMeta({
  layout: "blank",
});

const router = useRouter();

// Map of error status codes to titles and messages from the custom error pages
const errorMessages = {
  401: {
    title: "Acceso no autorizado",
    message: "Por favor, inicia sesión con las credenciales apropiadas <br> para acceder a este recurso."
  },
  403: {
    title: "Acceso no autorizado",
    message: "No tienes permiso para ver este recurso."
  },
  404: {
    title: "Oops! Página no encontrada!",
    message: "Parece que la página que estás buscando <br> no existe o puede haber sido eliminada."
  },
  500: {
    title: "Error del servidor",
    message: "Ha ocurrido un error en el servidor. Por favor, inténtalo de nuevo más tarde."
  },
  503: {
    title: "Servicio no disponible",
    message: "El servicio está temporalmente no disponible. Por favor, inténtalo de nuevo más tarde."
  }
};

// Get the appropriate error title based on status code
const errorTitle = computed(() => {
  const statusCode = props.error?.statusCode || 500;
  return errorMessages[statusCode]?.title || "Error";
});

// Get the appropriate error message based on status code
const errorMessage = computed(() => {
  const statusCode = props.error?.statusCode || 500;
  return errorMessages[statusCode]?.message || props.error?.message || "Ha ocurrido un error inesperado.";
});

</script>
