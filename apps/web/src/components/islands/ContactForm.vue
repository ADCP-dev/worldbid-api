<script setup lang="ts">
import { ref, computed } from 'vue';
import { z } from 'zod';

interface Props {
  locale: 'es' | 'en';
}
const props = defineProps<Props>();

const API_URL = import.meta.env.API_URL || 'http://localhost:3000';
const CONTACT_ENDPOINT = `${API_URL}/api/v1/contact`;

const messages = {
  es: {
    name: 'Nombre',
    email: 'Correo electrónico',
    message: 'Mensaje',
    submit: 'Enviar',
    success: '¡Mensaje enviado! Te responderemos pronto.',
    error: 'Ocurrió un error. Intenta nuevamente.',
    nameMin: 'El nombre debe tener al menos 2 caracteres',
    emailInvalid: 'Correo electrónico inválido',
    messageMin: 'El mensaje debe tener al menos 10 caracteres',
  },
  en: {
    name: 'Name',
    email: 'Email',
    message: 'Message',
    submit: 'Send',
    success: 'Message sent! We\'ll get back to you soon.',
    error: 'Something went wrong. Please try again.',
    nameMin: 'Name must be at least 2 characters',
    emailInvalid: 'Invalid email',
    messageMin: 'Message must be at least 10 characters',
  },
};
const t = computed(() => messages[props.locale] ?? messages.es);

const schema = z.object({
  name: z.string().min(2, 'nameMin'),
  email: z.string().email('emailInvalid'),
  message: z.string().min(10, 'messageMin'),
  website: z.string().optional(), // honeypot
});

type FormState = 'idle' | 'loading' | 'success' | 'error';
const state = ref<FormState>('idle');
const errorMsg = ref<string>('');

const form = ref({
  name: '',
  email: '',
  message: '',
  website: '', // honeypot — hidden, humans leave empty
});

const errors = ref<Record<string, string>>({});

function validate(): boolean {
  errors.value = {};
  const result = schema.safeParse(form.value);
  if (!result.success) {
    for (const issue of result.error.issues) {
      const key = issue.path[0] as string;
      if (!errors.value[key]) {
        errors.value[key] = issue.message;
      }
    }
    return false;
  }
  return true;
}

async function handleSubmit() {
  state.value = 'idle';
  errorMsg.value = '';
  if (!validate()) return;

  state.value = 'loading';
  try {
    const res = await fetch(CONTACT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form.value, lang: props.locale }),
    });

    if (res.status === 201) {
      state.value = 'success';
      form.value = { name: '', email: '', message: '', website: '' };
    } else if (res.status === 400) {
      state.value = 'error';
      errorMsg.value = t.value.error;
    } else {
      state.value = 'error';
      errorMsg.value = t.value.error;
    }
  } catch {
    state.value = 'error';
    errorMsg.value = t.value.error;
  }
}
</script>

<template>
  <form @submit.prevent="handleSubmit" class="space-y-4" novalidate>
    <!-- Honeypot: hidden from humans, bots fill it -->
    <div aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden;">
      <label>{{ t.website || 'Website' }}
        <input
          type="text"
          tabindex="-1"
          autocomplete="off"
          v-model="form.website"
          name="website"
        />
      </label>
    </div>

    <div>
      <label class="label" for="contact-name">
        <span class="label-text">{{ t.name }}</span>
      </label>
      <input
        id="contact-name"
        type="text"
        v-model="form.name"
        class="input input-bordered w-full"
        :class="{ 'input-error': errors.name }"
        required
        minlength="2"
      />
      <p v-if="errors.name" class="text-error text-sm mt-1">{{ t[errors.name as keyof typeof t] }}</p>
    </div>

    <div>
      <label class="label" for="contact-email">
        <span class="label-text">{{ t.email }}</span>
      </label>
      <input
        id="contact-email"
        type="email"
        v-model="form.email"
        class="input input-bordered w-full"
        :class="{ 'input-error': errors.email }"
        required
      />
      <p v-if="errors.email" class="text-error text-sm mt-1">{{ t[errors.email as keyof typeof t] }}</p>
    </div>

    <div>
      <label class="label" for="contact-message">
        <span class="label-text">{{ t.message }}</span>
      </label>
      <textarea
        id="contact-message"
        v-model="form.message"
        class="textarea textarea-bordered w-full"
        rows="5"
        :class="{ 'input-error': errors.message }"
        required
        minlength="10"
      ></textarea>
      <p v-if="errors.message" class="text-error text-sm mt-1">{{ t[errors.message as keyof typeof t] }}</p>
    </div>

    <button
      type="submit"
      class="btn btn-primary w-full"
      :disabled="state === 'loading'"
    >
      <span v-if="state === 'loading'" class="loading loading-spinner loading-sm"></span>
      {{ t.submit }}
    </button>

    <p v-if="state === 'success'" role="status" class="text-success text-center pt-2">
      {{ t.success }}
    </p>
    <p v-if="state === 'error'" role="alert" class="text-error text-center pt-2">
      {{ errorMsg || t.error }}
    </p>
  </form>
</template>