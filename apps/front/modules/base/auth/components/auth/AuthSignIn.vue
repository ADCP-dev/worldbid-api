<script setup lang="ts">
import PasswordInput from '@/components/PasswordInput.vue'
import { toast } from 'vue-sonner';
import { useI18n } from 'vue-i18n';
import { sanitizeRedirect } from '@base/auth/utils/redirect'

const { t } = useI18n()
const router = useRouter()
const authStore = useAuthStore()
const localePath = useLocalePath()
const route = useRoute()

const isLoading = ref(false)
const email = ref('')
const password = ref('')

async function onSubmit(event: Event) {
  event.preventDefault()

  if (!email.value || !password.value) {
    toast.error(t('base.auth.signIn.errorGeneric'), {
      description: t('base.auth.signIn.errorEmptyFields'),
    })
    return
  }

  isLoading.value = true

  try {
    const result = await authStore.login(email.value, password.value)

    if (result.success) {
      toast.success(t('base.auth.signIn.successLoginTitle'), {
        description: t('base.auth.signIn.successLoginDesc'),
      })

      const redirect = sanitizeRedirect(route.query.redirect)
      if (redirect) {
        await navigateTo(redirect)
      } else {
        const { navigateHome } = useHomeRoute()
        await navigateHome()
      }
    } else {
      let description = result.error || t('base.auth.signIn.errorInvalidCreds');
      if (result.errorCode === 'incorrectPassword' || result.errorCode === 'notFound' || result.errorCode === 'incorrectEmail') {
        description = t('base.auth.signIn.errorIncorrectLogin');
      }

      toast.error(t('base.auth.signIn.errorGeneric'), {
        description,
      })
    }
  } catch (error: unknown) {
    let description = t('base.auth.signIn.errorLoginFailed');
    if (error instanceof Error) {
      description = error.message || description;
    }
    // Narrow for API error shape (axios errors carry data.errors)
    const apiError = error as { data?: { errors?: Record<string, string> } } | undefined;
    if (apiError?.data?.errors?.password === 'incorrectPassword' || apiError?.data?.errors?.email === 'notFound') {
      description = t('base.auth.signIn.errorIncorrectLogin');
    }

    toast.error(t('base.auth.signIn.errorGeneric'), {
      description,
    })
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <form class="grid gap-6" @submit="onSubmit">
    <!-- <div class="divider">Or continue with</div> -->

    <FormInput
      :label="$t('base.auth.signIn.emailLabel')"
      v-model="email"
      type="email"
      :placeholder="$t('base.auth.signIn.emailPlaceholder')"
      :disabled="isLoading"
      testId="login-email"
    />

    <div class="form-control w-full">
      <div class="label justify-between">
        <span class="label-text font-semibold">{{ $t('base.auth.signIn.passwordLabel') }}</span>
        <NuxtLink :to="localePath('/forgot-password')" class="label-text-alt link link-hover">
          {{ $t('base.auth.signIn.forgotPasswordLink') }}
        </NuxtLink>
      </div>
      <PasswordInput id="password" v-model="password" testId="login-password" />
    </div>

    <button type="submit" class="btn btn-primary w-full" :disabled="isLoading" data-testid="login-submit">
      <span v-if="isLoading" class="loading loading-spinner loading-sm" />
      {{ $t('base.auth.signIn.submitButton') }}
    </button>
  </form>
  <div class="mt-4 text-center text-sm opacity-60">
    {{ $t('base.auth.signIn.noAccountPrompt') }}
    <NuxtLink :to="localePath('/register')" class="link font-medium">
      {{ $t('base.auth.signIn.registerLink') }}
    </NuxtLink>
  </div>
</template>

<style scoped></style>
