<script setup lang="ts">
import { toTypedSchema } from "@vee-validate/zod";
import { useForm } from "vee-validate";
import * as z from "zod";
import { toast } from "vue-sonner";
import FormInput from "~/modules/base/ui-app/components/form/FormInput.vue";
import FormPassword from "~/modules/base/ui-app/components/form/FormPassword.vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

const authStore = useAuthStore();

const selectedPhotoFile = ref<File | null>(null);
const photoPreviewUrl = ref<string>("");
const fileInput = ref<HTMLInputElement | null>(null);
const triggerFileSelect = () => fileInput.value?.click();

const profileFormSchema = computed(() =>
  toTypedSchema(
    z.object({
      firstName: z.string().min(2).max(30),
      lastName: z.string().min(2).max(30),
      email: z.string().email(),
      password: z
        .string()
        .optional()
        .refine((val) => !val || val.length >= 8, {
          message: t("base.settings.profile.validation.passwordMin"),
        }),
      oldPassword: z
        .string()
        .optional()
        .refine((val) => !val || val.length >= 1, {
          message: t("base.settings.profile.validation.oldPasswordRequired"),
        }),
      photo: z.any().optional(),
    }),
  ),
);

const { handleSubmit, resetForm, setValues, errors, defineField } = useForm({
  validationSchema: profileFormSchema,
  initialValues: {
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    oldPassword: "",
    photo: null,
  },
});

const [firstName] = defineField("firstName");
const [lastName] = defineField("lastName");
const [email] = defineField("email");
const [password] = defineField("password");
const [oldPassword] = defineField("oldPassword");

onMounted(async () => {
  if (!authStore.user) {
    await authStore.getMe();
  }
  if (authStore.user) {
    setValues({
      firstName: authStore.user.firstName || "",
      lastName: authStore.user.lastName || "",
      email: authStore.user.email || "",
      password: "",
      oldPassword: "",
    });
  }
});

const onPhotoChange = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  selectedPhotoFile.value = file;
  photoPreviewUrl.value = URL.createObjectURL(file);
};

const removeSelectedPhoto = () => {
  selectedPhotoFile.value = null;
  if (photoPreviewUrl.value) {
    URL.revokeObjectURL(photoPreviewUrl.value);
  }
  photoPreviewUrl.value = "";
};

const uploadProfilePhoto = async (): Promise<void> => {
  if (!selectedPhotoFile.value) return;
  try {
    const runtimeConfig = useRuntimeConfig();
    const base = `${runtimeConfig.public.apiUrl}${runtimeConfig.public.apiPrefix}`;
    const headers = { Authorization: `Bearer ${authStore.token}` };

    const formData = new FormData();
    formData.append("file", selectedPhotoFile.value);

    const res = await fetch(`${base}/users/profile-photo`, {
      method: "POST",
      headers,
      body: formData,
    });
    if (!res.ok) throw new Error(await res.text());

    // Update the user state to reflect the new photo
    await authStore.getMe();
  } catch (err) {
    console.error("Profile photo upload failed:", err);
    toast.error(t("base.settings.profile.uploadFailed"));
  }
};

const onSubmit = handleSubmit(async (values) => {
  try {
    // Upload photo first (if selected) — it self-registers via file metadata
    await uploadProfilePhoto();

    const updateData: any = {
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email,
    };

    if (values.password && values.oldPassword) {
      updateData.password = values.password;
      updateData.oldPassword = values.oldPassword;
    }

    const result = await authStore.updateProfile(updateData);

    if (result.success) {
      toast.success(t("base.settings.profile.successTitle"), {
        description: t("base.settings.profile.successDescription"),
      });
      await authStore.getMe();
      removeSelectedPhoto();
    } else {
      toast.error(t("base.settings.profile.errorTitle"), {
        description:
          result.error || t("base.settings.profile.errorDescription"),
      });
    }
  } catch (error) {
    toast.error(t("base.settings.profile.errorTitle"), {
      description: t("settings.profile.errorDescription"),
    });
    console.error("Profile update error:", error);
  }
});
</script>

<template>
  <div class="max-w-xl space-y-6">
    <div>
      <h3 class="text-lg font-medium">
        {{ $t("base.settings.profile.title") }}
      </h3>
    </div>

    <div class="divider"/>

    <form class="space-y-8" @submit.prevent="onSubmit">
      <!-- Profile photo upload -->
      <div class="form-control w-full">
        <label class="label">
          <span class="label-text font-semibold">{{
            $t("base.settings.profile.photoLabel")
          }}</span>
        </label>
        <div class="flex items-center gap-6">
          <div class="avatar">
            <div class="w-20 rounded-full overflow-hidden bg-base-300">
              <img
                v-if="photoPreviewUrl || authStore.user?.photo?.path"
                :src="photoPreviewUrl || authStore.user?.photo?.path"
                class="object-cover"
                alt="Profile photo"
              >
              <div v-else class="flex items-center justify-center p-4">
                <span class="text-xs text-base-content/70">{{
                  $t("base.settings.profile.noPhoto")
                }}</span>
              </div>
            </div>
          </div>

          <div class="flex flex-col gap-3">
            <input
              ref="fileInput"
              type="file"
              accept="image/*"
              class="hidden"
              @change="onPhotoChange"
            >
            <div class="flex flex-wrap items-center gap-2">
              <button
                type="button"
                class="btn btn-sm btn-outline border-base-content/20"
                @click="triggerFileSelect"
              >
                {{ $t("base.settings.profile.uploadPhoto") }}
              </button>
              <span class="text-xs text-base-content/60 truncate max-w-[150px]">
                {{
                  selectedPhotoFile?.name ||
                  $t("base.settings.profile.noFileSelected")
                }}
              </span>
              <button
                v-if="photoPreviewUrl"
                type="button"
                class="btn btn-sm btn-ghost text-error"
                @click="removeSelectedPhoto"
              >
                {{ $t("base.settings.profile.removePhoto") }}
              </button>
            </div>
            <p class="text-xs text-base-content/60">
              {{ $t("base.settings.profile.photoDescription") }}
            </p>
          </div>
        </div>
      </div>

      <div class="space-y-4">
        <FormInput
          v-model="firstName"
          :label="$t('base.settings.profile.firstNameLabel')"
          :placeholder="$t('base.settings.profile.firstNamePlaceholder')"
          :description="$t('base.settings.profile.firstNameDescription')"
          :error="errors.firstName"
          required
        />

        <FormInput
          v-model="lastName"
          :label="$t('base.settings.profile.lastNameLabel')"
          :placeholder="$t('base.settings.profile.lastNamePlaceholder')"
          :description="$t('base.settings.profile.lastNameDescription')"
          :error="errors.lastName"
          required
        />

        <FormInput
          v-model="email"
          type="email"
          :label="$t('base.settings.profile.emailLabel')"
          :placeholder="$t('base.settings.profile.emailPlaceholder')"
          :description="$t('base.settings.profile.emailDescription')"
          :error="errors.email"
          required
        />

        <div class="divider">
          {{ $t("base.settings.profile.changePassword") }}
        </div>

        <FormPassword
          v-model="password"
          :label="$t('base.settings.profile.newPassword')"
          placeholder="••••••••"
          :description="$t('base.settings.profile.newPasswordDescription')"
          :error="errors.password"
        />

        <FormPassword
          v-model="oldPassword"
          :label="$t('base.settings.profile.currentPassword')"
          placeholder="••••••••"
          :description="$t('base.settings.profile.currentPasswordDescription')"
          :error="errors.oldPassword"
        />

        <div class="flex justify-end gap-4">
          <button
            type="submit"
            class="btn btn-primary"
            :disabled="Object.keys(errors).length > 0"
          >
            {{ $t("base.settings.profile.updateProfile") }}
          </button>
        </div>
      </div>
    </form>
  </div>
</template>
