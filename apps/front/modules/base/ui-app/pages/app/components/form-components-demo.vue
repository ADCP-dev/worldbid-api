<script setup lang="ts">
import { ref } from 'vue'
import { today, getLocalTimeZone } from '@internationalized/date'

import FormInput from '~/modules/base/ui-app/components/form/FormInput.vue'
import FormPassword from '~/modules/base/ui-app/components/form/FormPassword.vue'
import FormTextArea from '~/modules/base/ui-app/components/form/FormTextArea.vue'
import FormSelect from '~/modules/base/ui-app/components/form/FormSelect.vue'
import FormMultipleSelect from '~/modules/base/ui-app/components/form/FormMultipleSelect.vue'
import FormSwitch from '~/modules/base/ui-app/components/form/FormSwitch.vue'
import FormDate from '~/modules/base/ui-app/components/form/FormDate.vue'
import FormTime from '~/modules/base/ui-app/components/form/FormTime.vue'
import FormFile from '~/modules/base/ui-app/components/form/FormFile.vue'
import FormMultipleFile from '~/modules/base/ui-app/components/form/FormMultipleFile.vue'

// Reactive state for each component
const formInput = ref('')
const formInputError = ref('')
const toggleError = () => {
  formInputError.value = formInputError.value ? '' : 'This field is required'
}

const formPassword = ref('')
const formTextArea = ref('')
const formSelect = ref('')
const formMultipleSelect = ref<string[]>([])
const formMultipleSelectError = ref<string[]>([])
const formSwitch = ref(false)
const formDate = ref(today(getLocalTimeZone()))
const formTime = ref('')
const formFile = ref<File | null>(null)
const formMultipleFile = ref<File[]>([])

// Static options
const countryOptions = [
  { value: 'ar', label: 'Argentina' },
  { value: 'es', label: 'España' },
  { value: 'mx', label: 'México' },
]

const languageOptions = [
  { value: 'es', label: 'Spanish' },
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'French' },
]

function fileMeta(file: File | null) {
  if (!file) return null
  return { name: file.name, size: `${(file.size / 1024).toFixed(1)}KB`, type: file.type }
}
</script>

<template>
  <div class="container mx-auto py-10 px-4">
    <div class="max-w-2xl mx-auto flex flex-col gap-8">
      <!-- Page Header -->
      <div>
        <h1 class="text-3xl font-bold tracking-tight mb-2">Form Components</h1>
        <p class="text-base-content/60">
          Interactive showcase of all 10 form components with live v-model display
        </p>
      </div>

      <!-- 1. FormInput Card -->
      <div class="card bg-base-100 shadow-xl border border-base-content/5">
        <div class="card-body p-8">
          <h2 class="text-xl font-semibold mb-4">FormInput</h2>
          <FormInput
            v-model="formInput"
            label="Username"
            placeholder="Enter your username"
            description="Your unique username"
            required
          />
          <button @click="toggleError" class="btn btn-sm btn-error mt-2 w-fit">
            {{ formInputError ? 'Hide' : 'Show' }} Error
          </button>
          <FormInput
            v-if="formInputError"
            :error="formInputError"
            model-value=""
            label="Username"
            placeholder="Enter your username"
          />
          <div v-if="formInput" class="mt-3 text-sm text-base-content/60">
            Current value: <span class="font-mono bg-base-200 px-2 py-0.5 rounded">{{ formInput }}</span>
          </div>
        </div>
      </div>

      <!-- 2. FormPassword Card -->
      <div class="card bg-base-100 shadow-xl border border-base-content/5">
        <div class="card-body p-8">
          <h2 class="text-xl font-semibold mb-4">FormPassword</h2>
          <FormPassword
            v-model="formPassword"
            label="Password"
            placeholder="Enter your password"
            required
          />
          <div v-if="formPassword" class="mt-3 text-sm text-base-content/60">
            Current value: <span class="font-mono bg-base-200 px-2 py-0.5 rounded">{{ formPassword }}</span>
          </div>
        </div>
      </div>

      <!-- 3. FormTextArea Card -->
      <div class="card bg-base-100 shadow-xl border border-base-content/5">
        <div class="card-body p-8">
          <h2 class="text-xl font-semibold mb-4">FormTextArea</h2>
          <FormTextArea
            v-model="formTextArea"
            label="Description"
            placeholder="Write something..."
            :rows="4"
            :maxlength="200"
            auto-resize
          />
          <div class="mt-1 text-xs text-base-content/40">
            {{ formTextArea?.length ?? 0 }}/200 characters
          </div>
          <div v-if="formTextArea" class="mt-3 text-sm text-base-content/60">
            Current value: <span class="font-mono bg-base-200 px-2 py-0.5 rounded">{{ formTextArea }}</span>
          </div>
        </div>
      </div>

      <!-- 4. FormSelect Card -->
      <div class="card bg-base-100 shadow-xl border border-base-content/5">
        <div class="card-body p-8">
          <h2 class="text-xl font-semibold mb-4">FormSelect</h2>
          <FormSelect
            v-model="formSelect"
            label="Country"
            placeholder="Select a country"
            :options="countryOptions"
            required
          />
          <div v-if="formSelect" class="mt-3 text-sm text-base-content/60">
            Current value: <span class="font-mono bg-base-200 px-2 py-0.5 rounded">{{ formSelect }}</span>
          </div>
        </div>
      </div>

      <!-- 5. FormMultipleSelect Card -->
      <div class="card bg-base-100 shadow-xl border border-base-content/5">
        <div class="card-body p-8">
          <h2 class="text-xl font-semibold mb-4">FormMultipleSelect</h2>
          <FormMultipleSelect
            v-model="formMultipleSelect"
            label="Languages"
            :options="languageOptions"
            placeholder="Select languages"
            description="Choose one or more languages"
          />
          <div v-if="formMultipleSelect.length" class="mt-3 text-sm text-base-content/60">
            Selected: <span class="font-mono bg-base-200 px-2 py-0.5 rounded">{{ formMultipleSelect.join(', ') }}</span>
          </div>

          <div class="divider text-sm text-base-content/40">With Error State</div>

          <FormMultipleSelect
            v-model="formMultipleSelectError"
            label="Required Tags"
            :options="[
              { value: 'javascript', label: 'JavaScript' },
              { value: 'typescript', label: 'TypeScript' },
              { value: 'vue', label: 'Vue' },
              { value: 'react', label: 'React' },
              { value: 'angular', label: 'Angular' },
              { value: 'svelte', label: 'Svelte' },
            ]"
            placeholder="Select at least one tag"
            error="Please select at least one tag"
          />
        </div>
      </div>

      <!-- 6. FormSwitch Card -->
      <div class="card bg-base-100 shadow-xl border border-base-content/5">
        <div class="card-body p-8">
          <h2 class="text-xl font-semibold mb-4">FormSwitch</h2>
          <FormSwitch
            v-model="formSwitch"
            label="Dark Mode"
            description="Toggle dark mode"
            show-icon
          />
          <div class="mt-3 text-sm text-base-content/60">
            Current value: <span class="font-mono bg-base-200 px-2 py-0.5 rounded">{{ formSwitch }}</span>
          </div>
        </div>
      </div>

      <!-- 7. FormDate Card -->
      <div class="card bg-base-100 shadow-xl border border-base-content/5">
        <div class="card-body p-8">
          <h2 class="text-xl font-semibold mb-4">FormDate</h2>
          <FormDate
            v-model="formDate"
            label="Birth Date"
            required
          />
          <div class="mt-3 text-sm text-base-content/60">
            Current value: <span class="font-mono bg-base-200 px-2 py-0.5 rounded">{{ formDate?.toString() ?? 'null' }}</span>
          </div>
        </div>
      </div>

      <!-- 8. FormTime Card -->
      <div class="card bg-base-100 shadow-xl border border-base-content/5">
        <div class="card-body p-8">
          <h2 class="text-xl font-semibold mb-4">FormTime</h2>
          <FormTime
            v-model="formTime"
            label="Meeting Time"
          />
          <div v-if="formTime" class="mt-3 text-sm text-base-content/60">
            Current value: <span class="font-mono bg-base-200 px-2 py-0.5 rounded">{{ formTime }}</span>
          </div>
        </div>
      </div>

      <!-- 9. FormFile Card -->
      <div class="card bg-base-100 shadow-xl border border-base-content/5">
        <div class="card-body p-8">
          <h2 class="text-xl font-semibold mb-4">FormFile</h2>
          <FormFile
            v-model="formFile"
            label="Profile Photo"
            accept="image/*"
            required
          />
          <div v-if="formFile" class="mt-3 text-sm text-base-content/60">
            File: <span class="font-mono bg-base-200 px-2 py-0.5 rounded">{{ formFile.name }}</span>
          </div>
        </div>
      </div>

      <!-- 10. FormMultipleFile Card -->
      <div class="card bg-base-100 shadow-xl border border-base-content/5">
        <div class="card-body p-8">
          <h2 class="text-xl font-semibold mb-4">FormMultipleFile</h2>
          <FormMultipleFile
            v-model="formMultipleFile"
            label="Documents"
            accept=".pdf,.doc,.docx"
            description="Upload your documents"
          />
          <div v-if="formMultipleFile.length" class="mt-3 text-sm text-base-content/60">
            Files: <span class="font-mono bg-base-200 px-2 py-0.5 rounded">{{ formMultipleFile.map(f => f.name).join(', ') }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
