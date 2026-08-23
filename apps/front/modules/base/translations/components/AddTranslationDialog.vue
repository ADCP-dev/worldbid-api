<script setup lang="ts">
import { ref, computed } from "vue";
import { Plus } from "lucide-vue-next";
import { toast } from "vue-sonner";
import FormInput from "~/modules/base/ui-app/components/form/FormInput.vue";
import FormSelect from "~/modules/base/ui-app/components/form/FormSelect.vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

const props = defineProps<{
  appContext: string;
  langs: any[];
}>();

const emit = defineEmits(["created"]);
const { createTranslation } = useTranslations();

const open = ref(false);
const section = ref("");
const key = ref("");
const selectedLangId = ref<string | number | undefined>(undefined);
const content = ref("");

const isSubmitting = ref(false);

const isValid = computed(() => {
  return (
    section.value.trim() !== "" &&
    key.value.trim() !== "" &&
    selectedLangId.value !== undefined &&
    content.value.trim() !== ""
  );
});

const handleCreate = async () => {
  if (!isValid.value) return;

  isSubmitting.value = true;
  try {
    await createTranslation({
      app: props.appContext,
      section: section.value.trim(),
      key: key.value.trim(),
      langId: parseInt(selectedLangId.value!.toString()),
      content: content.value.trim(),
    });

    emit("created");
    open.value = false;

    // Reset form
    section.value = "";
    key.value = "";
    content.value = "";
    selectedLangId.value = undefined;
  } catch (error) {
    console.error("Error creating translation:", error);
    toast.error(t("mod.translations.add.toast.error"));
  } finally {
    isSubmitting.value = false;
  }
};

const langOptions = computed(() =>
  props.langs.map((l) => ({ value: l.id, label: `${l.name} (${l.code})` })),
);
</script>

<template>
  <div>
    <button class="btn btn-primary" @click="open = true">
      <Plus class="w-4 h-4 mr-2" />
      {{ $t("mod.translations.add.btn") }}
    </button>

    <dialog class="modal" :class="{ 'modal-open': open }">
      <div class="modal-box sm:max-w-[425px]">
        <h3 class="font-bold text-lg">
          {{ $t("mod.translations.add.title") }}
        </h3>
        <p
          class="py-4 text-sm text-base-content/70"
          v-html="$t('mod.translations.add.description', { app: appContext })"
        />

        <div class="flex flex-col gap-4 py-4">
          <FormInput
            v-model="section"
            :label="$t('mod.translations.add.sectionLabel')"
            :placeholder="$t('mod.translations.add.sectionPlaceholder')"
            required
          />

          <FormInput
            v-model="key"
            :label="$t('mod.translations.add.keyLabel')"
            :placeholder="$t('mod.translations.add.keyPlaceholder')"
            required
          />

          <FormSelect
            v-model="selectedLangId"
            :label="$t('mod.translations.add.langLabel')"
            :placeholder="$t('mod.translations.add.langPlaceholder')"
            :options="langOptions"
            required
          />

          <div class="form-control w-full">
            <label class="label">
              <span class="label-text font-semibold">{{
                $t("mod.translations.add.contentLabel")
              }}</span>
            </label>
            <textarea
              v-model="content"
              :placeholder="$t('mod.translations.add.contentPlaceholder')"
              class="textarea textarea-bordered h-24"
            />
          </div>
        </div>

        <div class="modal-action">
          <button class="btn btn-ghost" @click="open = false">
            {{ $t("mod.translations.add.cancelBtn") }}
          </button>
          <button
            class="btn btn-primary"
            type="submit"
            :disabled="!isValid || isSubmitting"
            @click="handleCreate"
          >
            {{
              isSubmitting
                ? $t("mod.translations.add.savingBtn")
                : $t("mod.translations.add.saveBtn")
            }}
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop" @click="open = false">
        <button>close</button>
      </form>
    </dialog>
  </div>
</template>
