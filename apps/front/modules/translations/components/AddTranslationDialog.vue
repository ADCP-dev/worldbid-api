<script setup lang="ts">
import { ref, computed } from 'vue'
import { Plus } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import FormInput from '~/modules/ui-app/components/form/FormInput.vue'
import FormSelect from '~/modules/ui-app/components/form/FormSelect.vue'

const props = defineProps<{
  appContext: string;
  langs: any[];
}>()

const emit = defineEmits(['created'])
const { createTranslation } = useTranslations()

const open = ref(false)
const section = ref('')
const key = ref('')
const selectedLangId = ref<string | number | undefined>(undefined)
const content = ref('')

const isSubmitting = ref(false)

const isValid = computed(() => {
  return section.value.trim() !== '' &&
         key.value.trim() !== '' &&
         selectedLangId.value !== undefined &&
         content.value.trim() !== ''
})

const handleCreate = async () => {
  if (!isValid.value) return

  isSubmitting.value = true
  try {
    await createTranslation({
      app: props.appContext,
      section: section.value.trim(),
      key: key.value.trim(),
      langId: parseInt(selectedLangId.value!.toString()),
      content: content.value.trim()
    })

    emit('created')
    open.value = false

    // Reset form
    section.value = ''
    key.value = ''
    content.value = ''
    selectedLangId.value = undefined

  } catch (error) {
    console.error('Error creating translation:', error)
    toast.error('Failure creating the translation')
  } finally {
    isSubmitting.value = false
  }
}

const langOptions = computed(() =>
  props.langs.map(l => ({ value: l.id, label: `${l.name} (${l.code})` }))
)
</script>

<template>
  <div>
    <button class="btn btn-primary" @click="open = true">
      <Plus class="w-4 h-4 mr-2" />
      Nueva Traducción
    </button>

    <dialog class="modal" :class="{'modal-open': open}">
      <div class="modal-box sm:max-w-[425px]">
        <h3 class="font-bold text-lg">Añadir Traducción</h3>
        <p class="py-4 text-sm text-base-content/70">
          Crea una nueva clave de traducción para la aplicación "<strong>{{ appContext }}</strong>".
        </p>

        <div class="flex flex-col gap-4 py-4">
          <FormInput
            v-model="section"
            label="Sección"
            placeholder="ex: common"
            required
          />

          <FormInput
            v-model="key"
            label="Clave"
            placeholder="ex: welcome_message"
            required
          />

          <FormSelect
            v-model="selectedLangId"
            label="Idioma Base"
            placeholder="Selecciona un idioma"
            :options="langOptions"
            required
          />

          <div class="form-control w-full">
            <label class="label">
              <span class="label-text font-semibold">Contenido</span>
            </label>
            <textarea
              v-model="content"
              placeholder="Texto traducido..."
              class="textarea textarea-bordered h-24"
            ></textarea>
          </div>
        </div>

        <div class="modal-action">
          <button class="btn btn-ghost" @click="open = false">Cancelar</button>
          <button class="btn btn-primary" type="submit" @click="handleCreate" :disabled="!isValid || isSubmitting">
            {{ isSubmitting ? 'Guardando...' : 'Guardar' }}
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="open = false">
        <button>close</button>
      </form>
    </dialog>
  </div>
</template>
