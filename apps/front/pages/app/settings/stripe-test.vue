<script setup lang="ts">
import { ref, computed } from 'vue';
import { toast } from 'vue-sonner';
import { fetchWrapper } from '@/helpers/fetch-wrapper';

definePageMeta({ layout: 'default', middleware: 'auth' });

const config = useRuntimeConfig();
const baseURL = `${config.public.apiUrl}${config.public.apiPrefix}`;

// Payment form
const amount = ref(1000);
const currency = ref('eur');
const description = ref('');
const cardNumber = ref('4242 4242 4242 4242');
const cardExpiry = ref('12/28');
const cardCvc = ref('123');
const cardName = ref('Test User');

// Subscription
const plan = ref('mensual');
const planOptions = [
  { value: 'mensual', label: 'Plan Mensual (€9.99/mes)' },
  { value: 'anual', label: 'Plan Anual (€99.99/año)' },
  { value: 'enterprise', label: 'Plan Enterprise (€49.99/mes)' },
];

const results = ref<any[]>([]);
const payments = ref<any[]>([]);
const methods = ref<any>(null);

// Simulation
const webhookType = ref('checkout.session.completed');
const webhookTypes = [
  'checkout.session.completed',
  'invoice.paid',
  'invoice.payment_failed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
];

function formatAmount(cents: number, curr: string) {
  return (cents / 100).toFixed(2) + ' ' + curr.toUpperCase();
}

async function simulatePayment() {
  try {
    const result = await fetchWrapper.post(`${baseURL}/stripe/test/payment`, {
      amount: amount.value,
      currency: currency.value,
      description: description.value || undefined,
      card: {
        number: cardNumber.value,
        expiry: cardExpiry.value,
        cvc: cardCvc.value,
        name: cardName.value,
      },
    });
    results.value.unshift({ type: 'success', data: result });
    toast.success('Pago exitoso');
    loadPayments();
  } catch (e: any) {
    const errorData = e.data || {};
    const payment = errorData.payment;
    
    if (payment) {
      results.value.unshift({ type: 'error', data: payment, error: errorData.message });
      loadPayments();
    }
    
    if (errorData.requiresAction) {
      toast.warning(errorData.message || 'Requiere acción adicional');
    } else {
      toast.error(errorData.message || 'Pago rechazado');
    }
  }
}

async function simulateSubscription() {
  try {
    const result = await fetchWrapper.post(`${baseURL}/stripe/test/subscription`, {
      planId: plan.value,
    });
    results.value.unshift(result);
    toast.success('Suscripción simulada');
  } catch (e: any) {
    toast.error(e.message || 'Error');
  }
}

async function simulateWebhook() {
  try {
    const result = await fetchWrapper.post(`${baseURL}/stripe/test/webhook/simulate`, {
      type: webhookType.value,
    });
    results.value.unshift(result);
    toast.success('Webhook simulado');
  } catch (e: any) {
    toast.error(e.message || 'Error');
  }
}

async function loadPayments() {
  try {
    payments.value = await fetchWrapper.get(`${baseURL}/stripe/test/payments`);
  } catch {}
}

async function loadMethods() {
  try {
    methods.value = await fetchWrapper.get(`${baseURL}/stripe/test/methods`);
  } catch {}
}

loadPayments();
loadMethods();
</script>

<template>
  <div class="container mx-auto py-8 max-w-5xl">
    <h1 class="text-3xl font-bold mb-8">Stripe Test Suite</h1>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Simulate Payment -->
      <div class="card bg-base-100 shadow-sm border">
        <div class="card-body">
          <h2 class="card-title text-lg border-b pb-3 mb-4">Simular pago</h2>
          <div class="space-y-4">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="label pt-0"><span class="label-text font-medium">Importe (centavos)</span></label>
                <input v-model.number="amount" type="number" class="input input-bordered w-full" min="1" />
              </div>
              <div>
                <label class="label pt-0"><span class="label-text font-medium">Moneda</span></label>
                <select v-model="currency" class="select select-bordered w-full">
                  <option value="eur">EUR (€)</option>
                  <option value="usd">USD ($)</option>
                </select>
              </div>
            </div>
            <div>
              <label class="label pt-0"><span class="label-text font-medium">Número de tarjeta</span></label>
              <input v-model="cardNumber" class="input input-bordered w-full font-mono" placeholder="4242 4242 4242 4242" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="label pt-0"><span class="label-text font-medium">Caducidad</span></label>
                <input v-model="cardExpiry" class="input input-bordered w-full" placeholder="MM/AA" />
              </div>
              <div>
                <label class="label pt-0"><span class="label-text font-medium">CVC</span></label>
                <input v-model="cardCvc" class="input input-bordered w-full" placeholder="123" maxlength="4" />
              </div>
            </div>
            <div>
              <label class="label pt-0"><span class="label-text font-medium">Titular</span></label>
              <input v-model="cardName" class="input input-bordered w-full" placeholder="Nombre en la tarjeta" />
            </div>
            <div>
              <label class="label pt-0"><span class="label-text font-medium">Descripción</span></label>
              <input v-model="description" class="input input-bordered w-full" placeholder="Ej: Suscripción mensual" />
            </div>
            <button class="btn btn-primary w-full mt-2" @click="simulatePayment">
              Pagar {{ formatAmount(amount, currency) }}
            </button>
          </div>
        </div>
      </div>

      <!-- Test Cards -->
      <div class="card bg-base-100 shadow-sm border">
        <div class="card-body">
          <h2 class="card-title text-lg border-b pb-3 mb-4">Tarjetas de prueba</h2>
          <p class="text-xs text-base-content/60 mb-3">Clic en una tarjeta para usarla en el formulario</p>
          <div v-if="methods" class="space-y-2">
            <div
              v-for="card in methods.testCards"
              :key="card.number"
              class="flex items-center justify-between text-sm p-2.5 rounded bg-base-200 cursor-pointer hover:bg-base-300 transition-colors"
              @click="cardNumber = card.number.replace(/\s/g, ''); toast.info('Tarjeta ' + card.brand + ' seleccionada')"
            >
              <div>
                <span class="font-mono text-xs">{{ card.number }}</span>
                <span class="badge badge-xs ml-2">{{ card.brand }}</span>
              </div>
              <span class="badge badge-xs" :class="card.result.includes('exitoso') ? 'badge-success' : card.result.includes('rechazado') ? 'badge-error' : card.result.includes('3D') ? 'badge-warning' : 'badge-ghost'">
                {{ card.result }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Simulate Subscription -->
      <div class="card bg-base-100 shadow-sm border">
        <div class="card-body">
          <h2 class="card-title text-lg border-b pb-3 mb-4">Simular suscripción</h2>
          <div class="space-y-5">
            <div>
              <label class="label pt-0"><span class="label-text font-medium">Plan</span></label>
              <select v-model="plan" class="select select-bordered w-full">
                <option v-for="opt in planOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
            </div>
            <button class="btn btn-primary w-full mt-2" @click="simulateSubscription">
              Crear suscripción
            </button>
          </div>
        </div>
      </div>

      <!-- Simulate Webhook -->
      <div class="card bg-base-100 shadow-sm border">
        <div class="card-body">
          <h2 class="card-title text-lg border-b pb-3 mb-4">Simular webhook</h2>
          <div class="space-y-5">
            <div>
              <label class="label pt-0"><span class="label-text font-medium">Tipo de evento</span></label>
              <select v-model="webhookType" class="select select-bordered w-full">
                <option v-for="t in webhookTypes" :key="t" :value="t">{{ t }}</option>
              </select>
            </div>
            <button class="btn btn-primary w-full mt-2" @click="simulateWebhook">
              Disparar webhook
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Payment History -->
    <div class="card bg-base-100 shadow-sm border mt-6">
      <div class="card-body">
        <h2 class="card-title text-lg border-b pb-3 mb-4">Historial de pagos de prueba</h2>
        <div v-if="payments.length" class="overflow-x-auto">
          <table class="table table-md">
            <thead>
              <tr>
                <th>ID</th>
                <th>Tarjeta</th>
                <th>Importe</th>
                <th>Estado</th>
                <th>Descripción</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in payments" :key="p.id">
                <td class="font-mono text-xs">{{ p.id }}</td>
                <td class="text-sm">{{ p.cardBrand }} ····{{ p.cardLast4 }}</td>
                <td>{{ formatAmount(p.amount, p.currency) }}</td>
                <td>
                  <span class="badge badge-sm" :class="p.status === 'succeeded' ? 'badge-success' : p.status === 'requires_action' ? 'badge-warning' : 'badge-error'">
                    {{ p.status === 'succeeded' ? 'Exitoso' : p.status === 'requires_action' ? '3D Secure' : 'Fallido' }}
                  </span>
                  <p v-if="p.error" class="text-xs text-error mt-1">{{ p.error }}</p>
                </td>
                <td class="text-sm">{{ p.description }}</td>
                <td class="text-xs text-base-content/60">{{ new Date(p.createdAt).toLocaleString('es-ES') }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="text-sm text-base-content/60">No hay pagos de prueba aún</p>
      </div>
    </div>
  </div>
</template>
