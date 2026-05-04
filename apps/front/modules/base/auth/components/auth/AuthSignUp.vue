<script setup lang="ts">
import PasswordInput from "~/components/PasswordInput.vue";
import { toast } from 'vue-sonner';
import { useI18n } from 'vue-i18n';

const { t } = useI18n()
const router = useRouter();
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
    toast.error(t('base.auth.signUp.errorGeneric'), {
      description: t('base.auth.signUp.errorEmptyFields'),
    });
    return;
  }

  if (password.value !== confirmPassword.value) {
    toast.error(t('base.auth.signUp.errorGeneric'), {
      description: t('base.auth.signUp.errorPasswordMismatch'),
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
    });

    if (result.success) {
      toast.success(t('base.auth.signUp.successRegisterTitle'), {
        description: t('base.auth.signUp.successRegisterDesc'),
      });

      const { navigateHome } = useHomeRoute();
      navigateHome();
    } else {
      toast.error(t('base.auth.signUp.errorGeneric'), {
        description: result.error || t('base.auth.signUp.errorRegisterFailed'),
      });
    }
  } catch (error: any) {
    toast.error(t('base.auth.signUp.errorGeneric'), {
      description: error?.message || t('base.auth.signUp.errorRegisterCatch'),
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
          :label="$t('base.auth.signUp.nameLabel')"
          :placeholder="$t('base.auth.signUp.namePlaceholder')"
          :disabled="isLoading"
          required
        />

        <FormInput
          v-model="email"
          :label="$t('base.auth.signUp.emailLabel')"
          :placeholder="$t('base.auth.signUp.emailPlaceholder')"
          type="email"
          :disabled="isLoading"
          required
        />

        <div class="form-control w-full">
          <label class="label">
            <span class="label-text font-semibold">{{ $t('base.auth.signUp.passwordLabel') }}</span>
          </label>
          <PasswordInput
            id="password"
            v-model="password"
            :placeholder="$t('base.auth.signUp.passwordPlaceholder')"
            :disabled="isLoading"
          />
        </div>

        <div class="form-control w-full">
          <label class="label">
            <span class="label-text font-semibold">{{ $t('base.auth.signUp.confirmPasswordLabel') }}</span>
          </label>
          <PasswordInput
            id="confirm-password"
            v-model="confirmPassword"
            :placeholder="$t('base.auth.signUp.confirmPasswordPlaceholder')"
            :disabled="isLoading"
          />
        </div>

        <button type="submit" class="btn btn-primary w-full" :disabled="isLoading">
          <span v-if="isLoading" class="loading loading-spinner loading-sm" />
          {{ $t('base.auth.signUp.submitButton') }}
        </button>
      </div>
    </form>
  </div>
</template>
