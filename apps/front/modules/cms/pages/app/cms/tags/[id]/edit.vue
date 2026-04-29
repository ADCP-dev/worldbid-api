<script setup lang="ts">
import FormInput from "@base/ui-app/components/form/FormInput.vue";
import { tagSchema } from "@cms/schemas/tag.schema";
import { toast } from "vue-sonner";

definePageMeta({
  layout: "default",
  middleware: "auth",
});

const router = useRouter();
const route = useRoute();
const { fetchTags, updateTag, deleteTag, loading, error } = useCmsTags();

const tagId = route.params.id as string;
const isDeleting = ref(false);
const validationErrors = ref<Record<string, string>>({});
const allOpen = ref(true);

const languages = [
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "en", label: "English", flag: "🇬🇧" },
];

const translations = ref<Record<string, { name: string }>>({
  es: { name: "" },
  en: { name: "" },
});

onMounted(async () => {
  try {
    const result = await fetchTags();
    const tag = result.data?.find((t: any) => t.id === tagId);
    if (tag) {
      translations.value.es.name = tag.name || "";
    }
  } catch (e) {
    // Silent error
  }
});

const toggleAll = () => {
  allOpen.value = !allOpen.value;
  const details = document.querySelectorAll(".collapse");
  details.forEach((detail) => {
    if (allOpen.value) {
      detail.setAttribute("open", "");
    } else {
      detail.removeAttribute("open");
    }
  });
};

const handleSubmit = async () => {
  const dataToValidate = {
    name: translations.value.es.name,
  };

  const result = tagSchema.safeParse(dataToValidate);
  if (!result.success) {
    validationErrors.value = {};
    result.error.errors.forEach((err) => {
      validationErrors.value[err.path[0]] = err.message;
    });
    return;
  }

  try {
    await updateTag(tagId, {
      name: translations.value.es.name,
      lang: "es",
    });

    toast.success("Etiqueta actualizada correctamente");
    router.push("/app/cms/tags");
  } catch (e) {
    toast.error((e as any)?.message || "Error al guardar");
  }
};

const handleDelete = async () => {
  if (isDeleting.value) return;
  const confirmed = confirm("¿Estás seguro de eliminar esta etiqueta?");
  if (!confirmed) return;

  isDeleting.value = true;
  try {
    await deleteTag(tagId);
    router.push("/app/cms/tags");
  } catch (e) {
    isDeleting.value = false;
  }
};
</script>

<template>
  <div class="container mx-auto py-8 max-w-3xl">
    <div class="flex justify-between items-center mb-8">
      <div class="flex items-center gap-4">
        <NuxtLink to="/app/cms/tags" class="btn btn-ghost btn-sm">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </NuxtLink>
        <h1 class="text-3xl font-bold">Editar etiqueta</h1>
      </div>
      <div class="flex items-center gap-4">
        <button class="btn btn-ghost text-error" :disabled="isDeleting" @click="handleDelete">
          {{ isDeleting ? 'Eliminando...' : 'Eliminar' }}
        </button>
        <NuxtLink to="/app/cms/tags" class="btn btn-ghost">
          Cancelar
        </NuxtLink>
      </div>
    </div>

    <form @submit.prevent="handleSubmit" class="space-y-4">
      <div class="join join-vertical w-full">
        <details
          v-for="lang in languages"
          :key="lang.code"
          class="collapse collapse-arrow join-item border border-base-300 bg-base-100"
          open
        >
          <summary class="collapse-title font-semibold">
            <span class="mr-2">{{ lang.flag }}</span>
            {{ lang.label }}
            <span v-if="lang.code === 'es'" class="badge badge-sm badge-primary ml-2">Por defecto</span>
          </summary>
          <div class="collapse-content">
            <div class="space-y-4 pt-2">
              <FormInput
                v-model="translations[lang.code].name"
                label="Nombre"
                placeholder="Nombre de la etiqueta"
                required
                :error="lang.code === 'es' ? validationErrors.name : undefined"
              />
            </div>
          </div>
        </details>
      </div>

      <div v-if="error" class="alert alert-error">
        {{ error }}
      </div>

      <div class="flex gap-4 pt-4">
        <button type="submit" class="btn btn-primary" :disabled="loading">
          {{ loading ? 'Guardando...' : 'Guardar' }}
        </button>
        <NuxtLink to="/app/cms/tags" class="btn btn-ghost">
          Cancelar
        </NuxtLink>
      </div>
    </form>
  </div>
</template>
