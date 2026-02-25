<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import * as z from 'zod'
import { toast } from 'vue-sonner'
import FormInput from '~/modules/ui-app/components/form/FormInput.vue'
import FormPassword from '~/modules/ui-app/components/form/FormPassword.vue'

const authStore = useAuthStore()

const selectedPhotoFile = ref<File | null>(null)
// Preview URL for selected image; falls back to current photo path in template
const photoPreviewUrl = ref<string>('')
const fileInput = ref<HTMLInputElement | null>(null)
const triggerFileSelect = () => fileInput.value?.click()

const profileFormSchema = toTypedSchema(z.object({
  firstName: z
    .string()
    .min(2, {
      message: 'First name must be at least 2 characters.',
    })
    .max(30, {
      message: 'First name must not be longer than 30 characters.',
    }),
  lastName: z
    .string()
    .min(2, {
      message: 'Last name must be at least 2 characters.',
    })
    .max(30, {
      message: 'Last name must not be longer than 30 characters.',
    }),
  email: z
    .string({
      required_error: 'Please enter your email.',
    })
    .email({ message: 'Please enter a valid email address.' }),
  password: z
    .string()
    .optional()
    .refine(val => !val || val.length >= 6, {
      message: 'Password must be at least 6 characters.',
    }),
  oldPassword: z
    .string()
    .optional()
    .refine(val => !val || val.length >= 1, {
      message: 'Old password is required to change password.',
    }),
  photo: z.any().optional(),
}))

const { handleSubmit, resetForm, setValues, errors, defineField } = useForm({
  validationSchema: profileFormSchema,
  initialValues: {
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    oldPassword: '',
    photo: null,
  },
})

const [firstName] = defineField('firstName')
const [lastName] = defineField('lastName')
const [email] = defineField('email')
const [password] = defineField('password')
const [oldPassword] = defineField('oldPassword')

// Load current user data
onMounted(async () => {
  if (!authStore.user) {
    await authStore.getMe()
  }

  if (authStore.user) {
    setValues({
      firstName: authStore.user.firstName || '',
      lastName: authStore.user.lastName || '',
      email: authStore.user.email || '',
      password: '',
      oldPassword: '',
    })
  }
})

const onPhotoChange = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  selectedPhotoFile.value = file
  photoPreviewUrl.value = URL.createObjectURL(file)
}

const removeSelectedPhoto = () => {
  selectedPhotoFile.value = null
  if (photoPreviewUrl.value) {
    URL.revokeObjectURL(photoPreviewUrl.value)
  }
  photoPreviewUrl.value = ''
}

const uploadProfilePhoto = async (): Promise<string | null> => {
  if (!selectedPhotoFile.value) return null
  try {
    const formData = new FormData()
    formData.append('file', selectedPhotoFile.value)
    formData.append('isPublic', 'true')
    formData.append('entity', 'user')
    formData.append('entityId', String(authStore.user?.id ?? ''))

    const runtimeConfig = useRuntimeConfig()
    const base = `${runtimeConfig.public.apiUrl}${runtimeConfig.public.apiPrefix}`
    const res = await fetch(`${base}/files/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authStore.token}`,
      },
      body: formData,
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(text)
    }
    const json = await res.json()
    return json?.file?.id ?? null
  } catch (err) {
    console.error('Profile photo upload failed:', err)
    toast.error('Failed to upload profile photo')
    return null
  }
}

const onSubmit = handleSubmit(async (values) => {
  try {
    const updateData: any = {
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email,
    }

    // Only include password if provided
    if (values.password && values.oldPassword) {
      updateData.password = values.password
      updateData.oldPassword = values.oldPassword
    }

    // Upload profile photo if a new one was selected
    const photoId = await uploadProfilePhoto()
    if (photoId) {
      updateData.photo = { id: photoId }
    }

    const result = await authStore.updateProfile(updateData)

    if (result.success) {
      toast.success('Profile updated successfully')
      await authStore.getMe()
      removeSelectedPhoto()
    } else {
      toast.error(result.error || 'Failed to update profile')
    }
  } catch (error) {
    toast.error('An error occurred while updating profile')
    console.error('Profile update error:', error)
  }
})
</script>

<template>
  <div class="max-w-xl space-y-6">
    <div>
      <h3 class="text-lg font-medium">Profile</h3>
      <p class="text-sm text-base-content/70">
        This is how others will see you on the site.
      </p>
    </div>

    <div class="divider"></div>

    <form class="space-y-8" @submit.prevent="onSubmit">
      <!-- Profile photo upload -->
      <div class="form-control w-full">
        <label class="label">
          <span class="label-text font-semibold">Profile Photo</span>
        </label>
        <div class="flex items-center gap-6">
          <div class="avatar">
            <div class="w-20 rounded-full overflow-hidden bg-base-300">
              <img v-if="photoPreviewUrl || authStore.user?.photo?.path"
                   :src="photoPreviewUrl || authStore.user?.photo?.path"
                   class="object-cover"
                   alt="Profile photo" />
              <div v-else class="flex items-center justify-center p-4">
                <span class="text-xs text-base-content/70">No photo</span>
              </div>
            </div>
          </div>

          <div class="flex flex-col gap-3">
            <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onPhotoChange" />
            <div class="flex flex-wrap items-center gap-2">
              <button type="button" class="btn btn-sm btn-outline border-base-content/20" @click="triggerFileSelect">
                Choose image
              </button>
              <span class="text-xs text-base-content/60 truncate max-w-[150px]">
                {{ selectedPhotoFile?.name || 'No file selected' }}
              </span>
              <button v-if="photoPreviewUrl" type="button" class="btn btn-sm btn-ghost text-error" @click="removeSelectedPhoto">
                Remove selected
              </button>
            </div>
            <p class="text-xs text-base-content/60">
              Upload a new profile photo. JPG/PNG recommended.
            </p>
          </div>
        </div>
      </div>

      <div class="space-y-4">
        <FormInput
          v-model="firstName"
          label="First Name"
          placeholder="John"
          description="Your first name as it appears on your account."
          :error="errors.firstName"
          required
        />

        <FormInput
          v-model="lastName"
          label="Last Name"
          placeholder="Doe"
          description="Your last name as it appears on your account."
          :error="errors.lastName"
          required
        />

        <FormInput
          v-model="email"
          type="email"
          label="Email"
          placeholder="john.doe@example.com"
          description="Your email address. This will be used for account notifications."
          :error="errors.email"
          required
        />

        <div class="divider">Change Password</div>

        <FormPassword
          v-model="password"
          label="New Password"
          placeholder="••••••••"
          description="Leave blank to keep your current password."
          :error="errors.password"
        />

        <FormPassword
          v-model="oldPassword"
          label="Current Password"
          placeholder="••••••••"
          description="Required only if you're changing your password."
          :error="errors.oldPassword"
        />

        <div class="flex justify-end gap-4">
          <button type="submit" class="btn btn-primary" :disabled="Object.keys(errors).length > 0">
            Update profile
          </button>
        </div>
      </div>

    </form>
  </div>
</template>
