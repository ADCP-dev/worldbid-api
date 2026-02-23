<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useTranslations } from '@/modules/translations/composables/useTranslations';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

const showKeys = useState('i18n-show-keys', () => false);
const isEditing = ref(false);
const editingKey = ref('');
const missingLangs = ref<any[]>([]);

const { getLangs, getTranslations, getExactTranslation, createTranslation, updateTranslation, generateJson } = useTranslations();

// Extract $i18n safely within setup to use in fallback logic
const nuxtApp = useNuxtApp();

// We'll store translations for the given key based on languages
const translationsData = ref<Record<number, any>>({});
const allLangs = ref<any[]>([]);
const groupData = ref<any>(null);

const fetchLangs = async () => {
    try {
        allLangs.value = await getLangs();
    } catch(e) { console.error(e) }
}

onMounted(() => {
    fetchLangs();
});

const openEditor = async (keyText: string) => {
    if (!showKeys.value) return;

    // Minimal heuristic to check if clicked text looks like a translation key (e.g. landing.features.title)
    if (!/^[a-zA-Z0-9_.-]+$/.test(keyText) || !keyText.includes('.')) {
        return;
    }

    editingKey.value = keyText;
    isEditing.value = true;

    try {
        // Split key to find section and exact key
        const parts = keyText.split('.');
        // Section is all without the last part
        const topSection = parts.slice(0, -1).join('.');
        // Rest key is the last part
        const restKey = parts.slice(-1)[0];

        // Fetch precisely via the exact endpoint
        const res = await getExactTranslation('front', topSection, restKey);

        // It returns an exact group `{ app, section, key, translations: [...] }`
        groupData.value = res;

        const newTranslationsData: Record<number, any> = {};
        allLangs.value.forEach(lang => {
            // Safe navigation since groupData could be undefined if the key has no translations yet
            const existing = groupData.value?.translations?.find((t: any) => t?.lang?.id === lang.id);

            // If the DB doesn't have it, try to fallback to the currently loaded JSON locale strings
            let fallbackContent = '';
            if (!existing) {
                try {
                    // Access the global `$i18n`
                    const $i18n = nuxtApp.$i18n as any;
                    if ($i18n && typeof $i18n.t === 'function') {
                        // try fetching specifically for the language code
                        const val = $i18n.t(keyText, -1, { locale: lang.code });
                        if (val && val !== keyText) {
                            fallbackContent = val;
                        }
                    }
                } catch(e) {}
            }

            newTranslationsData[lang.id] = existing || { content: fallbackContent };
        });
        translationsData.value = newTranslationsData;

    } catch (e) {
        console.error(e);
    }
};

const isSaving = ref(false);

const handleSaveAll = async () => {
    isSaving.value = true;
    try {
        const parts = editingKey.value.split('.');
        const topSection = parts[0];
        const restKey = parts.slice(1).join('.');

        // Iterate over all langs
        for (const lang of allLangs.value) {
            const data = translationsData.value[lang.id];
            if (!data || !data.content.trim()) continue;

            if (data.id) {
                await updateTranslation(data.id, { content: data.content });
            } else {
                await createTranslation({
                    langId: lang.id,
                    app: 'front',
                    section: topSection,
                    key: restKey,
                    content: data.content
                });
            }
        }

        await generateJson();
        // Give backend a moment to generate file
        setTimeout(() => {
            window.location.reload();
        }, 500);
    } catch (e) {
        console.error(e);
        alert('Failed to save');
    } finally {
        isSaving.value = false;
    }
};

const interceptClick = (e: MouseEvent) => {
    if (!showKeys.value) return;
    const target = e.target as HTMLElement;

    // To allow interacting with our own dialog when open:
    if (isEditing.value) return;

    if (target && target.innerText) {
        const text = target.innerText.trim();
        if (/^[a-zA-Z0-9_.-]+$/.test(text) && text.includes('.')) {
            e.preventDefault();
            e.stopPropagation();
            openEditor(text);
        }
    }
};

onMounted(() => {
    document.addEventListener('click', interceptClick, { capture: true });
});

onUnmounted(() => {
    document.removeEventListener('click', interceptClick, { capture: true });
});

</script>

<template>
  <div>
    <Dialog v-model:open="isEditing">
      <DialogContent class="max-w-xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Translation: <span class="text-primary font-mono text-sm ml-2">{{ editingKey }}</span></DialogTitle>
          <DialogDescription class="sr-only">Update translations for all languages. Click Guardar y Sincronizar to save and apply.</DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-4 py-4">
          <div v-for="lang in allLangs" :key="lang.id" class="border p-4 rounded-md">
              <div class="flex items-center gap-2 mb-2 font-semibold">
                  <FlagIcon :code="lang.flagCode || lang.code" />
                  <span>{{ lang.name }}</span>
              </div>
              <Textarea v-if="translationsData[lang.id]" v-model="translationsData[lang.id].content" class="mb-2" />
          </div>
        </div>

        <div class="flex justify-end pt-2 border-t mt-2">
            <Button @click="handleSaveAll" :disabled="isSaving" class="w-full sm:w-auto">
                {{ isSaving ? 'Guardando...' : 'Guardar y Sincronizar' }}
            </Button>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
