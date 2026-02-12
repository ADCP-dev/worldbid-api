<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import * as z from 'zod'
import { toast } from 'vue-sonner'
import { useAuthStore } from '@/stores/auth.store'

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

const { handleSubmit, resetForm, setValues } = useForm({
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
  <div>
    <h3 class="text-lg font-medium">
      Profile
    </h3>
    <p class="text-sm text-muted-foreground">
      This is how others will see you on the site.
    </p>
  </div>
  <Separator />
  <form class="space-y-8" @submit="onSubmit">
    <!-- Profile photo upload -->
    <FormField name="photo">
      <FormItem>
        <FormLabel>Profile Photo</FormLabel>
        <div class="flex items-center gap-4">
          <div class="h-16 w-16 rounded-full overflow-hidden border bg-muted flex items-center justify-center">
            <img
              v-if="photoPreviewUrl || authStore.user?.photo?.path"
              :src="photoPreviewUrl || authStore.user?.photo?.path"
              class="h-full w-full object-cover"
              alt="Profile photo"
            />
            <span v-else class="text-sm text-muted-foreground">No photo</span>
          </div>
          <div class="flex flex-col gap-2">
            <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onPhotoChange" />
            <div class="flex items-center gap-2">
              <Button type="button" variant="secondary" @click="triggerFileSelect">
                Choose image
              </Button>
              <span class="text-sm text-muted-foreground truncate max-w-[200px]">
                {{ selectedPhotoFile?.name || 'No file selected' }}
              </span>
              <Button v-if="photoPreviewUrl" type="button" variant="outline" @click="removeSelectedPhoto">
                Remove selected
              </Button>
            </div>
          </div>
        </div>
        <FormDescription>
          Upload a new profile photo. JPG/PNG recommended.
        </FormDescription>
      </FormItem>
    </FormField>

    <FormField v-slot="{ componentField }" name="firstName">
      <FormItem>
        <FormLabel>First Name</FormLabel>
        <FormControl>
          <Input type="text" placeholder="John" v-bind="componentField" />
        </FormControl>
        <FormDescription>
          Your first name as it appears on your account.
        </FormDescription>
        <FormMessage />
      </FormItem>
    </FormField>

    <FormField v-slot="{ componentField }" name="lastName">
      <FormItem>
        <FormLabel>Last Name</FormLabel>
        <FormControl>
          <Input type="text" placeholder="Doe" v-bind="componentField" />
        </FormControl>
        <FormDescription>
          Your last name as it appears on your account.
        </FormDescription>
        <FormMessage />
      </FormItem>
    </FormField>

    <FormField v-slot="{ componentField }" name="email">
      <FormItem>
        <FormLabel>Email</FormLabel>
        <FormControl>
          <Input type="email" placeholder="john.doe@example.com" v-bind="componentField" />
        </FormControl>
        <FormDescription>
          Your email address. This will be used for account notifications.
        </FormDescription>
        <FormMessage />
      </FormItem>
    </FormField>

    <FormField v-slot="{ componentField }" name="password">
      <FormItem>
        <FormLabel>New Password</FormLabel>
        <FormControl>
          <Input type="password" placeholder="••••••••" v-bind="componentField" />
        </FormControl>
        <FormDescription>
          Leave blank to keep your current password.
        </FormDescription>
        <FormMessage />
      </FormItem>
    </FormField>

    <FormField v-slot="{ componentField }" name="oldPassword">
      <FormItem>
        <FormLabel>Current Password</FormLabel>
        <FormControl>
          <Input type="password" placeholder="••••••••" v-bind="componentField" />
        </FormControl>
        <FormDescription>
          Required only if you're changing your password.
        </FormDescription>
        <FormMessage />
      </FormItem>
    </FormField>

    <div class="flex justify-start gap-2">
      <Button type="submit">
        Update profile
      </Button>

      <Button
        type="button"
        variant="outline"
        @click="resetForm"
      >
        Reset form
      </Button>
    </div>
  </form>
</template>
