<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus } from 'lucide-vue-next'

const props = defineProps<{
  appContext: string;
  langs: any[];
}>()

const emit = defineEmits(['created'])
const { createTranslation } = useTranslations()

const open = ref(false)
const section = ref('')
const key = ref('')
const selectedLangId = ref<string | undefined>(undefined)
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
      langId: parseInt(selectedLangId.value!),
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
    alert('Failure creating the translation')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogTrigger as-child>
      <Button variant="default">
        <Plus class="w-4 h-4 mr-2" />
        Nueva Traducción
      </Button>
    </DialogTrigger>
    <DialogContent class="sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>Añadir Traducción</DialogTitle>
        <DialogDescription>
          Crea una nueva clave de traducción para la aplicación "<strong>{{ appContext }}</strong>".
        </DialogDescription>
      </DialogHeader>

      <div class="grid gap-4 py-4">
        <div class="grid grid-cols-4 items-center gap-4">
          <Label for="section" class="text-right">Sección</Label>
          <Input id="section" v-model="section" placeholder="ex: common" class="col-span-3" />
        </div>
        <div class="grid grid-cols-4 items-center gap-4">
          <Label for="key" class="text-right">Clave</Label>
          <Input id="key" v-model="key" placeholder="ex: welcome_message" class="col-span-3" />
        </div>
        <div class="grid grid-cols-4 items-center gap-4">
          <Label class="text-right">Idioma Base</Label>
          <div class="col-span-3">
            <Select v-model="selectedLangId">
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un idioma" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem v-for="l in langs" :key="l.id" :value="l.id.toString()">
                    {{ l.name }} ({{ l.code }})
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div class="grid grid-cols-4 items-center gap-4">
          <Label for="content" class="text-right">Contenido</Label>
          <Textarea id="content" v-model="content" placeholder="Texto traducido..." class="col-span-3 min-h-[80px]" />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="open = false">Cancelar</Button>
        <Button type="submit" @click="handleCreate" :disabled="!isValid || isSubmitting">
          {{ isSubmitting ? 'Guardando...' : 'Guardar' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
