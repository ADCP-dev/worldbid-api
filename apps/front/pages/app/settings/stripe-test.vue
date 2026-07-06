<<<<<<< HEAD
<script setup lang="ts">
import { ref, computed } from 'vue';
import { toast } from 'vue-sonner';
import { useApi } from '#imports'
import {
  usePlansQuery,
  useCheckoutMutation,
} from '@/composables/useSubscription';

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

=======
<!--
  This page has been relocated to the Stripe extension layer.
  See: extensions/stripe/pages/app/settings/stripe-test.vue
  This stub is kept only to avoid stale-file issues during cleanup.
  The Nuxt layer version takes precedence for the same route.
  Safe to delete this file once the Stripe extension layer is confirmed active.
-->
>>>>>>> 3aded1db4c5a7ba899a388bdcca402c0f4116137
<template>
  <div />
</template>