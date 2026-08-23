<script setup lang="ts">
import { toast } from 'vue-sonner';
import { useI18n } from 'vue-i18n';

const { t } = useI18n()
const localePath = useLocalePath()
const authStore = useAuthStore()

const email = ref('')
const isLoading = ref(false)
const isSuccess = ref(false)

async function onSubmit(event: Event) {
  event.preventDefault()

  if (!email.value) {
    toast.error(t('mod.auth.forgotPassword.errorGeneric'), {
      description: t('mod.auth.forgotPassword.errorEmptyFields'),
    })
    return
  }

  isLoading.value = true

  try {
    const result = await authStore.forgotPassword(email.value)

    if (result.success) {
      isSuccess.value = true
      toast.success(t('mod.auth.forgotPassword.successForgotTitle'), {
        description: t('mod.auth.forgotPassword.successForgotDesc'),
      })

      // Optionally redirect after a delay
      setTimeout(() => {
        navigateTo(localePath('/login'))
      }, 3000)
    } else {
      toast.error(t('mod.auth.forgotPassword.errorGeneric'), {
        description: result.error || t('mod.auth.forgotPassword.errorForgotFailed'),
      })
    }
  } catch (error: any) {
    toast.error(t('mod.auth.forgotPassword.errorGeneric'), {
      description: error?.message || t('mod.auth.forgotPassword.errorForgotCatch'),
    })
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <form @submit="onSubmit">
    <div class="grid gap-4">
      <FormInput
        v-model="email"
        :label="$t('mod.auth.forgotPassword.emailLabel')"
        :placeholder="$t('mod.auth.forgotPassword.emailPlaceholder')"
        type="email"
        :disabled="isLoading"
        required
      />
      <button type="submit" class="btn btn-primary w-full" :disabled="isLoading">
        <span v-if="isLoading" class="loading loading-spinner loading-sm" />
        {{ $t('mod.auth.forgotPassword.submitButton') }}
      </button>
    </div>
  </form>
</template>

<style scoped></style>
