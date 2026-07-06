<script setup lang="ts">
import { ref, computed } from 'vue';
import { toast } from 'vue-sonner';
import {
  usePlansQuery,
  useCheckoutMutation,
} from '@/composables/useSubscription';

definePageMeta({ layout: 'default', middleware: 'auth' });

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
    const result = await useApi().post(`/stripe/test/payment`, {
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
    const result = await useApi().post(`/stripe/test/subscription`, {
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
    const result = await useApi().post(`/stripe/test/webhook/simulate`, {
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
    payments.value = await useApi().get(`/stripe/test/payments`);
  } catch {}
}

async function loadMethods() {
  try {
    methods.value = await useApi().get(`/stripe/test/methods`);
  } catch {}
}

loadPayments();
loadMethods();

const { data: plans } = usePlansQuery();
const checkout = useCheckoutMutation();

const sortedPlans = computed(() => {
  if (!plans.value?.length) return [];
  return [...plans.value].sort((a, b) => {
    if (a.isDefault) return -1;
    if (b.isDefault) return 1;
    return (a.price?.unitAmount ?? 0) - (b.price?.unitAmount ?? 0);
  });
});

function handleCheckout(planId: string) {
  checkout.mutate(planId);
}
</script>

<template>
  <div class="container mx-auto py-8 max-w-5xl">
    <h1 class="text-3xl font-bold mb-8">Stripe Test Suite</h1>

    <!-- Planes disponibles (Checkout real) -->
    <div class="card bg-base-100 shadow-sm border mb-6">
      <div class="card-body">
        <h2 class="card-title text-lg">Planes disponibles (Checkout real)</h2>
        <p class="text-sm text-base-content/60 mb-4">
          Contrata un plan usando Stripe Checkout real en modo test. Tarjeta: <code class="badge badge-sm">4242 4242 4242 4242</code>
        </p>
        <div v-if="sortedPlans.length" class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div
            v-for="plan in sortedPlans"
            :key="plan.id"
            class="card bg-base-200 border border-base-300"
            :class="{ 'ring-2 ring-primary': plan.isDefault }"
          >
            <div class="card-body p-4">
              <h3 class="card-title text-lg">{{ plan.name }}</h3>
              <p class="text-sm text-base-content/60">{{ plan.description }}</p>
              <ul class="space-y-1 mt-2">
                <li v-for="f in (plan.features ?? [])" :key="f" class="text-sm flex items-center gap-1">
                  <span class="text-success text-xs">✓</span> {{ f }}
                </li>
              </ul>
              <div class="card-actions mt-4">
                <button
                  class="btn btn-primary btn-sm w-full"
                  data-testid="stripe-checkout-btn"
                  :disabled="checkout.isPending.value && checkout.variables.value === plan.id"
                  @click="handleCheckout(plan.id)"
                >
                  {{ checkout.isPending.value && checkout.variables.value === plan.id ? 'Redirigiendo...' : 'Contratar' }}
                </button>
              </div>
            </div>
          </div>
        </div>
        <p v-else class="text-sm text-base-content/60 mt-2">No hay planes disponibles</p>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

      <!-- Tarjetas de prueba -->
      <div class="card bg-base-100 shadow-sm border">
        <div class="card-body">
          <h2 class="card-title text-lg border-b pb-3 mb-4">Tarjetas de prueba</h2>
          <p class="text-xs text-base-content/60 mb-3">Usa estas tarjetas en el Checkout de Stripe (modo test, 0€)</p>
          <div class="space-y-2">
            <div class="flex items-center justify-between text-sm p-2.5 rounded bg-success/10">
              <div>
                <span class="font-mono text-xs">4242 4242 4242 4242</span>
                <span class="badge badge-xs ml-2">Visa</span>
              </div>
              <span class="badge badge-success badge-xs">Pago exitoso</span>
            </div>
            <div class="flex items-center justify-between text-sm p-2.5 rounded bg-error/10">
              <div>
                <span class="font-mono text-xs">4000 0000 0000 0002</span>
                <span class="badge badge-xs ml-2">Visa</span>
              </div>
              <span class="badge badge-error badge-xs">Rechazada</span>
            </div>
            <div class="flex items-center justify-between text-sm p-2.5 rounded bg-error/10">
              <div>
                <span class="font-mono text-xs">4000 0000 0000 9995</span>
                <span class="badge badge-xs ml-2">Visa</span>
              </div>
              <span class="badge badge-error badge-xs">Fondos insuficientes</span>
            </div>
            <div class="flex items-center justify-between text-sm p-2.5 rounded bg-error/10">
              <div>
                <span class="font-mono text-xs">4000 0000 0000 9987</span>
                <span class="badge badge-xs ml-2">Visa</span>
              </div>
              <span class="badge badge-error badge-xs">Tarjeta robada</span>
            </div>
            <div class="flex items-center justify-between text-sm p-2.5 rounded bg-warning/10">
              <div>
                <span class="font-mono text-xs">4000 0000 0000 3220</span>
                <span class="badge badge-xs ml-2">Visa</span>
              </div>
              <span class="badge badge-warning badge-xs">3D Secure</span>
            </div>
            <div class="flex items-center justify-between text-sm p-2.5 rounded bg-base-200 mt-3">
              <span class="text-xs text-base-content/60">CVC: <b>cualquier 3 dígitos</b></span>
              <span class="text-xs text-base-content/60">Caducidad: <b>fecha futura</b></span>
            </div>
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