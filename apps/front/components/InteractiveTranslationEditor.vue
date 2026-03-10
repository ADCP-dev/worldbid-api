<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue";
import { useTranslations } from "@/modules/base/translations/composables/useTranslations";

const showKeys = useState("i18n-show-keys", () => false);
const isEditing = ref(false);
const editingKey = ref("");
// ... (rest of logic remains similar, just removing imports)

const {
  getLangs,
  getExactTranslationByDotPath,
  createTranslation,
  updateTranslation,
  generateJson,
} = useTranslations();
const isBulkTranslating = ref(false);

const bulkTranslate = async () => {
  isBulkTranslating.value = true;
  try {
    const response = await $fetch("/api/v1/translations/bulk-translate", {
      method: "POST",
      body: { app: "front" },
      headers: {
        Authorization: `Bearer ${useCookie("auth_token").value}`,
      },
    });
    toast.success(
      nuxtApp.$i18n.t("base.translations.editor.toast.bulkSuccess"),
    );
    await generateJson();
    setTimeout(() => {
      window.location.reload();
    }, 500);
  } catch (error: any) {
    console.error(error);
    toast.error(
      `${nuxtApp.$i18n.t("base.translations.editor.toast.bulkError")}: ${error.message || "Error desconocido"}`,
    );
  } finally {
    isBulkTranslating.value = false;
  }
};

const nuxtApp = useNuxtApp();
const translationsData = ref<Record<number, any>>({});
const allLangs = ref<any[]>([]);
const groupData = ref<any>(null);

const fetchLangs = async () => {
  try {
    allLangs.value = await getLangs();
  } catch (e) {
    console.error(e);
  }
};

onMounted(() => {
  fetchLangs();
});

const openEditor = async (keyText: string) => {
  if (!showKeys.value) return;

  if (!/^[a-zA-Z0-9_.-]+$/.test(keyText) || !keyText.includes(".")) {
    return;
  }

  editingKey.value = keyText;
  isEditing.value = true;

  try {
    const res = await getExactTranslationByDotPath("front", keyText);
    groupData.value = res;

    const newTranslationsData: Record<number, any> = {};
    allLangs.value.forEach((lang) => {
      const existing = groupData.value?.translations?.find(
        (t: any) => t?.lang?.id === lang.id,
      );
      let fallbackContent = "";
      if (!existing) {
        try {
          const $i18n = nuxtApp.$i18n as any;
          if ($i18n && typeof $i18n.t === "function") {
            const val = $i18n.t(keyText, -1, { locale: lang.code });
            if (val && val !== keyText) {
              fallbackContent = val;
            }
          }
        } catch (e) {}
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
    // Fallback for brand new keys
    const parts = editingKey.value.split(".");
    const fallbackSection = parts.length > 1 ? parts[0] : "common";
    const fallbackKey =
      parts.length > 1 ? parts.slice(1).join(".") : editingKey.value;

    const finalSection = groupData.value?.section || fallbackSection;
    const finalKey = groupData.value?.key || fallbackKey;

    for (const lang of allLangs.value) {
      const data = translationsData.value[lang.id];
      if (!data || !data.content.trim()) continue;

      if (data.id) {
        await updateTranslation(data.id, { content: data.content });
      } else {
        await createTranslation({
          langId: lang.id,
          app: "front",
          section: finalSection,
          key: finalKey,
          content: data.content,
        });
      }
    }

    await generateJson();
    toast.success(
      nuxtApp.$i18n.t("base.translations.editor.toast.saveSuccess"),
    );
    setTimeout(() => {
      window.location.reload();
    }, 500);
  } catch (e) {
    console.error(e);
    toast.error(nuxtApp.$i18n.t("base.translations.editor.toast.saveError"));
  } finally {
    isSaving.value = false;
  }
};

const hoveredKey = ref("");
const hoveredRect = ref({ top: 0, left: 0, width: 0, height: 0 });

const getValidKey = (target: HTMLElement | null): string | null => {
  if (!target) return null;
  const text = target.innerText?.trim();
  if (text && /^[a-zA-Z0-9_.-]+$/.test(text) && text.includes(".")) {
    return text;
  }
  return null;
};

const interceptClick = (e: MouseEvent) => {
  if (!showKeys.value) return;
  if (isEditing.value) return;

  const target = e.target as HTMLElement;
  const keyText = getValidKey(target);

  if (keyText) {
    e.preventDefault();
    e.stopPropagation();
    openEditor(keyText);
    hoveredKey.value = "";
  }
};

const handleMouseOver = (e: MouseEvent) => {
  if (!showKeys.value || isEditing.value) {
    hoveredKey.value = "";
    return;
  }
  const target = e.target as HTMLElement;
  const keyText = getValidKey(target);

  if (keyText) {
    hoveredKey.value = keyText;
    const rect = target.getBoundingClientRect();
    hoveredRect.value = {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    };
    target.style.cursor = "crosshair";
  }
};

const handleMouseOut = (e: MouseEvent) => {
  if (!showKeys.value || isEditing.value) return;
  const target = e.target as HTMLElement;
  const keyText = getValidKey(target);

  if (keyText) {
    target.style.cursor = "";
    if (hoveredKey.value === keyText) {
      hoveredKey.value = "";
    }
  }
};

const handleScroll = () => {
  hoveredKey.value = "";
};

onMounted(() => {
  document.addEventListener("click", interceptClick, { capture: true });
  document.addEventListener("mouseover", handleMouseOver, { capture: true });
  document.addEventListener("mouseout", handleMouseOut, { capture: true });
  window.addEventListener("scroll", handleScroll, {
    capture: true,
    passive: true,
  });
});

onUnmounted(() => {
  document.removeEventListener("click", interceptClick, { capture: true });
  document.removeEventListener("mouseover", handleMouseOver, { capture: true });
  document.removeEventListener("mouseout", handleMouseOut, { capture: true });
  window.removeEventListener("scroll", handleScroll, { capture: true });
});

import { toast } from "vue-sonner";
</script>

<template>
  <div>
    <!-- Interactive Inspector Overlay -->
    <Teleport to="body">
      <div
        v-if="showKeys && hoveredKey && !isEditing"
        class="fixed pointer-events-none z-[99999] border-2 border-primary bg-primary/10 transition-all duration-75"
        :style="{
          top: hoveredRect.top + 'px',
          left: hoveredRect.left + 'px',
          width: hoveredRect.width + 'px',
          height: hoveredRect.height + 'px',
        }"
      >
        <div
          class="absolute -top-6 left-[-2px] bg-primary text-primary-content text-xs px-2 py-0.5 rounded-t-sm whitespace-nowrap font-mono shadow-sm"
        >
          {{ hoveredKey }}
        </div>
      </div>
    </Teleport>

    <!-- DaisyUI Modal -->
    <dialog class="modal" :class="{ 'modal-open': isEditing }">
      <div class="modal-box max-w-xl max-h-[80vh] flex flex-col p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-bold text-lg">
            {{ $t("base.translations.editor.editTitle") }}
            <span class="text-primary font-mono text-sm ml-2">{{
              editingKey
            }}</span>
          </h3>
          <button
            @click="isEditing = false"
            class="btn btn-sm btn-circle btn-ghost"
          >
            ✕
          </button>
        </div>

        <div class="flex-1 overflow-y-auto pr-2 flex flex-col gap-4 mb-4">
          <div
            v-for="lang in allLangs"
            :key="lang.id"
            class="card card-compact border border-base-content/20 bg-base-100"
          >
            <div class="card-body">
              <div class="flex items-center gap-2 mb-2 font-semibold">
                <FlagIcon :code="lang.flagCode || lang.code" />
                <span>{{ lang.name }}</span>
              </div>
              <textarea
                v-if="translationsData[lang.id]"
                v-model="translationsData[lang.id].content"
                class="textarea textarea-bordered w-full"
                :placeholder="$t('base.translations.editor.placeholder')"
                rows="3"
              />
            </div>
          </div>
        </div>

        <div class="modal-action flex-col sm:flex-row gap-2 mt-0">
          <button
            @click="bulkTranslate"
            :disabled="isBulkTranslating"
            class="btn btn-neutral grow"
          >
            <AppIcon
              v-if="isBulkTranslating"
              name="lucide:loader-2"
              class="w-4 h-4 animate-spin mr-2"
            />
            {{
              isBulkTranslating
                ? $t("base.translations.editor.bulkTranslating")
                : $t("base.translations.editor.autoTranslateAll")
            }}
          </button>
          <button
            @click="handleSaveAll"
            :disabled="isSaving"
            class="btn btn-primary sm:w-auto"
          >
            <AppIcon
              v-if="isSaving"
              name="lucide:loader-2"
              class="w-4 h-4 animate-spin mr-2"
            />
            {{
              isSaving
                ? $t("base.translations.editor.saving")
                : $t("base.translations.editor.saveSync")
            }}
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="isEditing = false">close</button>
      </form>
    </dialog>
  </div>
</template>
