<script setup lang="ts">
import FormInput from "@base/ui-app/components/form/FormInput.vue";
import { tagSchema } from "@cms/schemas/tag.schema";
import { toast } from "vue-sonner";

definePageMeta({
  layout: "default",
  middleware: "auth",
});

const router = useRouter();
const { createTag, loading, error } = useCmsTags();

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
    await createTag({
      name: translations.value.es.name,
      lang: "es",
    });

    toast.success("Etiqueta creada correctamente");
    router.push("/app/cms/tags");
  } catch (e) {
    toast.error((e as any)?.message || "Error al guardar");
  }
};
</script>

<template>
  <div class="container mx-auto py-8 max-w-3xl">
    <div class="flex justify-between items-center mb-8">
      <h1 class="text-3xl font-bold">Crear etiqueta</h1>
      <div class="flex items-center gap-4">
        <button type="button" class="btn btn-sm btn-outline" @click="toggleAll">
          {{ allOpen ? 'Colapsar todo' : 'Expandir todo' }}
        </button>
        <NuxtLink to="/app/cms/tags" class="btn btn-ghost">
          Cancelar
        </NuxtLink>
      </div>
    </div>

    <form class="space-y-4" @submit.prevent="handleSubmit">
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
