<script setup lang="ts">
import { toast } from 'vue-sonner';
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n';

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()

const email = ref('')
const isLoading = ref(false)
const isSuccess = ref(false)

async function onSubmit(event: Event) {
  event.preventDefault()

  if (!email.value) {
    toast.error(t('base.auth.forgotPassword.errorGeneric'), {
      description: t('base.auth.forgotPassword.errorEmptyFields'),
    })
    return
  }

  isLoading.value = true

  try {
    const result = await authStore.forgotPassword(email.value)

    if (result.success) {
      isSuccess.value = true
      toast.success(t('base.auth.forgotPassword.successForgotTitle'), {
        description: t('base.auth.forgotPassword.successForgotDesc'),
      })

      // Optionally redirect after a delay
      setTimeout(() => {
        router.push('/login')
      }, 3000)
    } else {
      toast.error(t('base.auth.forgotPassword.errorGeneric'), {
        description: result.error || t('base.auth.forgotPassword.errorForgotFailed'),
      })
    }
  } catch (error: any) {
    toast.error(t('base.auth.forgotPassword.errorGeneric'), {
      description: error?.message || t('base.auth.forgotPassword.errorForgotCatch'),
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
        :label="$t('base.auth.forgotPassword.emailLabel')"
        v-model="email"
        :placeholder="$t('base.auth.forgotPassword.emailPlaceholder')"
        type="email"
        :disabled="isLoading"
        required
      />
      <button type="submit" class="btn btn-primary w-full" :disabled="isLoading">
        <span v-if="isLoading" class="loading loading-spinner loading-sm" />
        {{ $t('base.auth.forgotPassword.submitButton') }}
      </button>
    </div>
  </form>
</template>

<style scoped></style>
