<script setup lang="ts">
import PasswordInput from "~/components/PasswordInput.vue";
import { toast } from 'vue-sonner';
import { useI18n } from 'vue-i18n';

const { t, locale } = useI18n()
const authStore = useAuthStore();

const name = ref('');
const email = ref('');
const password = ref('');
const confirmPassword = ref('');
const isLoading = ref(false);

async function onSubmit(event: Event) {
  event.preventDefault();

  // Form validation
  if (!name.value || !email.value || !password.value || !confirmPassword.value) {
    toast.error(t('mod.auth.signUp.errorGeneric'), {
      description: t('mod.auth.signUp.errorEmptyFields'),
    });
    return;
  }

  if (password.value !== confirmPassword.value) {
    toast.error(t('mod.auth.signUp.errorGeneric'), {
      description: t('mod.auth.signUp.errorPasswordMismatch'),
    });
    return;
  }

  isLoading.value = true;

  try {
    const [firstName, ...lastNameParts] = name.value.trim().split(' ');
    const result = await authStore.register({
      firstName,
      lastName: lastNameParts.join(' ') || '',
      email: email.value,
      password: password.value,
      language: locale.value,
    });

    if (result.success) {
      toast.success(t('mod.auth.signUp.successRegisterTitle'), {
        description: t('mod.auth.signUp.successRegisterDesc'),
      });

      const { navigateHome } = useHomeRoute();
      await navigateHome();
    } else {
      toast.error(t('mod.auth.signUp.errorGeneric'), {
        description: result.error || t('mod.auth.signUp.errorRegisterFailed'),
      });
    }
  } catch (error: any) {
    toast.error(t('mod.auth.signUp.errorGeneric'), {
      description: error?.message || t('mod.auth.signUp.errorRegisterCatch'),
    });
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <div :class="['grid gap-6', $attrs.class ?? '']">
    <form @submit="onSubmit">
      <div class="grid gap-4">
        <FormInput
          v-model="name"
          :label="$t('mod.auth.signUp.nameLabel')"
          :placeholder="$t('mod.auth.signUp.namePlaceholder')"
          :disabled="isLoading"
          required
        />

        <FormInput
          v-model="email"
          :label="$t('mod.auth.signUp.emailLabel')"
          :placeholder="$t('mod.auth.signUp.emailPlaceholder')"
          type="email"
          :disabled="isLoading"
          required
        />

        <div class="form-control w-full">
          <label class="label">
            <span class="label-text font-semibold">{{ $t('mod.auth.signUp.passwordLabel') }}</span>
          </label>
          <PasswordInput
            id="password"
            v-model="password"
            :placeholder="$t('mod.auth.signUp.passwordPlaceholder')"
            :disabled="isLoading"
          />
        </div>

        <div class="form-control w-full">
          <label class="label">
            <span class="label-text font-semibold">{{ $t('mod.auth.signUp.confirmPasswordLabel') }}</span>
          </label>
          <PasswordInput
            id="confirm-password"
            v-model="confirmPassword"
            :placeholder="$t('mod.auth.signUp.confirmPasswordPlaceholder')"
            :disabled="isLoading"
          />
        </div>

        <button type="submit" class="btn btn-primary w-full" :disabled="isLoading">
          <span v-if="isLoading" class="loading loading-spinner loading-sm" />
          {{ $t('mod.auth.signUp.submitButton') }}
        </button>
      </div>
    </form>
  </div>
</template>
