<script setup lang="ts">
import { toast } from 'vue-sonner'
import { useRouter, useRoute } from 'vue-router'
import PasswordInput from '~/components/PasswordInput.vue'
import { useI18n } from 'vue-i18n';

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const localePath = useLocalePath()

const hash = computed(() => route.query.hash as string)
const expires = computed(() => route.query.expires as string)

const password = ref('')
const confirmPassword = ref('')
const isLoading = ref(false)

const isExpired = computed(() => {
  if (!expires.value) return false
  return Date.now() > Number(expires.value)
})

async function onSubmit(event: Event) {
  event.preventDefault()

  if (!hash.value) {
    toast.error(t('mod.auth.resetPassword.errorInvalidLinkTitle'), {
      description: t('mod.auth.resetPassword.errorInvalidLinkDesc'),
    })
    return
  }

  if (isExpired.value) {
    toast.error(t('mod.auth.resetPassword.errorExpiredLinkTitle'), {
      description: t('mod.auth.resetPassword.errorExpiredLinkDesc'),
    })
    return
  }

  if (!password.value || password.value.length < 6) {
    toast.error(t('mod.auth.resetPassword.errorInvalidPasswordTitle'), {
      description: t('mod.auth.resetPassword.errorInvalidPasswordDesc'),
    })
    return
  }

  if (password.value !== confirmPassword.value) {
    toast.error(t('mod.auth.resetPassword.errorPasswordMismatchTitle'), {
      description: t('mod.auth.resetPassword.errorPasswordMismatchDesc'),
    })
    return
  }

  isLoading.value = true

  try {
    const result = await authStore.resetPassword(hash.value, password.value)

    if (result.success) {
      toast.success(t('mod.auth.resetPassword.successResetTitle'), {
        description: t('mod.auth.resetPassword.successResetDesc'),
      })
      setTimeout(() => {
        router.push(localePath('/login'))
      }, 2000)
    } else {
      toast.error(t('mod.auth.resetPassword.errorGeneric'), {
        description: result.error || t('mod.auth.resetPassword.errorResetFailed'),
      })
    }
  } catch (error: any) {
    toast.error(t('mod.auth.resetPassword.errorGeneric'), {
      description: error?.message || t('mod.auth.resetPassword.errorResetCatch'),
    })
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div>
    <!-- Expired link warning -->
    <div v-if="isExpired" class="alert alert-error mb-4 text-sm">
      <span>
        {{ $t('mod.auth.resetPassword.expiredWarningText') }}
        <NuxtLink :to="localePath('/forgot-password')" class="link font-medium">
          {{ $t('mod.auth.resetPassword.requestNewLink') }}
        </NuxtLink>.
      </span>
    </div>

    <form v-else @submit="onSubmit">
      <div class="grid gap-4">
        <!-- New password -->
        <div class="form-control w-full">
          <label class="label" for="password">
            <span class="label-text font-semibold">{{ $t('mod.auth.resetPassword.newPasswordLabel') }}</span>
          </label>
          <PasswordInput
            id="password"
            v-model="password"
            :placeholder="$t('mod.auth.resetPassword.newPasswordPlaceholder')"
            auto-complete="new-password"
            :disabled="isLoading"
          />
        </div>

        <!-- Confirm password -->
        <div class="form-control w-full">
          <label class="label" for="confirm-password">
            <span class="label-text font-semibold">{{ $t('mod.auth.resetPassword.confirmPasswordLabel') }}</span>
          </label>
          <PasswordInput
            id="confirm-password"
            v-model="confirmPassword"
            :placeholder="$t('mod.auth.resetPassword.confirmPasswordPlaceholder')"
            auto-complete="new-password"
            :disabled="isLoading"
          />
        </div>

        <button type="submit" class="btn btn-primary w-full" :disabled="isLoading">
          <span v-if="isLoading" class="loading loading-spinner loading-sm" />
          {{ $t('mod.auth.resetPassword.submitButton') }}
        </button>
      </div>
    </form>
  </div>
</template>

<style scoped></style>
