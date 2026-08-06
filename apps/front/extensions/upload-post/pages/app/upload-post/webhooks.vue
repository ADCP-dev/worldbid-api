<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { toast } from 'vue-sonner';
import { Webhook, Save } from 'lucide-vue-next';
import FormInput from '@/modules/base/ui-app/components/form/FormInput.vue';
import FormSwitch from '@/modules/base/ui-app/components/form/FormSwitch.vue';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const { configureWebhooks } = useUploadPost();

const form = ref({
  webhookUrl: '',
  telegramChatId: '',
  events: {
    uploadCompleted: true,
    socialAccountConnected: true,
    socialAccountDisconnected: true,
    socialAccountReauthRequired: true,
  },
});

const saving = ref(false);


async function handleSave() {
  if (!form.value.webhookUrl.trim()) {
    toast.error('La URL del webhook es obligatoria');
    return;
  }

  saving.value = true;
  try {
    await configureWebhooks({
      webhookUrl: form.value.webhookUrl,
      telegramChatId: form.value.telegramChatId || undefined,
      events: form.value.events,
    });
    toast.success('Webhooks configurados');
  } catch (err: unknown) {
    toast.error('Error guardando webhooks', { description: errorMessage(err) });
  } finally {
    saving.value = false;
  }
}

const EVENT_DESCRIPTIONS: Record<keyof typeof form.value.events, string> = {
  uploadCompleted: 'Se dispara cuando una publicación se completa correctamente.',
  socialAccountConnected: 'Se dispara cuando una cuenta social se conecta.',
  socialAccountDisconnected: 'Se dispara cuando una cuenta social se desconecta.',
  socialAccountReauthRequired: 'Se dispara cuando una cuenta requiere re-autenticación.',
};

onMounted(() => {
  // No GET endpoint to load existing config — form starts empty.
});
</script>

<template>
  <div class="p-6 space-y-6 max-w-3xl mx-auto">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold flex items-center gap-2">
        <Webhook class="w-6 h-6" />
        Webhooks
      </h1>
    </div>

    <div class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body p-6 space-y-4">
        <p class="text-sm text-base-content/70">
          Configura un endpoint para recibir notificaciones de eventos de Upload-Post.
          Los eventos se filtran por tipo; deja activados los que necesites.
        </p>

        <FormInput
          v-model="form.webhookUrl"
          label="URL del webhook"
          placeholder="https://example.com/webhooks/upload-post"
          required
          description="Endpoint HTTPS que recibirá los POST con el payload del evento."
        />

        <FormInput
          v-model="form.telegramChatId"
          label="Telegram Chat ID (opcional)"
          placeholder="-1001234567890"
          description="Si se configura, se envían notificaciones a este chat de Telegram."
        />

        <div class="divider">Eventos</div>

        <div class="space-y-3">
          <div
            v-for="(key, idx) in (Object.keys(form.events) as Array<keyof typeof form.events>)"
            :key="idx"
            class="flex items-start justify-between gap-4 p-3 rounded-lg border border-base-300"
          >
            <div class="flex-1">
              <p class="font-medium text-sm capitalize">{{ key.replace(/([A-Z])/g, ' $1').trim() }}</p>
              <p class="text-xs text-base-content/60 mt-1">{{ EVENT_DESCRIPTIONS[key] }}</p>
            </div>
            <FormSwitch
              v-model="form.events[key]"
              :label="''"
            />
          </div>
        </div>

        <div class="flex justify-end pt-2">
          <button
            class="btn btn-primary"
            :disabled="saving"
            @click="handleSave"
          >
            <Save class="w-4 h-4" />
            <span v-if="saving" class="loading loading-spinner loading-xs" />
            Guardar configuración
          </button>
        </div>
      </div>
    </div>
  </div>
</template>