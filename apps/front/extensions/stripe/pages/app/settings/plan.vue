<script setup lang="ts">
import { computed } from 'vue';
import {
  useSubscriptionQuery,
  useCancelMutation,
  useResumeMutation,
  useInvoicesQuery,
} from '@/composables/useSubscription';
import StripeService from '@/services/stripe.service';

definePageMeta({ layout: 'default', middleware: 'auth' });

const stripeService = new StripeService();

const { data: subscription, isLoading } = useSubscriptionQuery('me');
const { data: invoices, isLoading: loadingInvoices } = useInvoicesQuery();
const cancel = useCancelMutation();
const resume = useResumeMutation();
async function handleManage() {
  const { url } = await stripeService.getCustomerPortal();
  if (url) window.location.href = url;
}

async function downloadInvoice(invoiceId: string) {
  try {
    await stripeService.downloadInvoice(invoiceId);
  } catch (e: any) {
    console.error('Error downloading invoice', e);
  }
}
</script>

<template>
  <SettingsLayout>
    <div class="space-y-6">
      <div class="space-y-0.5">
        <h2 class="text-2xl font-bold tracking-tight">Suscripción</h2>
        <p class="text-muted-foreground">Gestiona tu plan, facturación y pagos</p>
      </div>
      <div class="divider my-6"></div>

      <div v-if="isLoading" class="flex justify-center py-12">
        <span class="loading loading-spinner loading-lg"></span>
      </div>

      <!-- Current subscription -->
      <div v-if="subscription" class="space-y-6">
        <!-- Plan card -->
        <div class="card bg-base-100 shadow-sm border">
          <div class="card-body">
            <div class="flex items-start justify-between flex-wrap gap-4">
              <div>
                <h2 class="card-title text-lg">{{ subscription.plan?.name ?? 'Sin plan' }}</h2>
                <p class="text-sm text-base-content/60 mt-1">{{ subscription.plan?.description }}</p>
              </div>
              <div class="text-right">
                <span class="text-2xl font-bold text-primary">{{ priceLabel }}</span>
                <p class="text-xs text-base-content/50 mt-0.5">Próxima facturación: {{ nextBilling ?? '—' }}</p>
              </div>
            </div>
            <div class="flex items-center gap-3 mt-3 flex-wrap">
              <span class="badge" :class="statusClass">{{ statusLabel }}</span>
              <span class="text-sm text-base-content/60">{{ periodLabel }}</span>
            </div>
            <div class="card-actions mt-4">
              <button class="btn btn-primary btn-sm" data-testid="plan-change" @click="handleManage">Cambiar plan</button>
              <button class="btn btn-outline btn-sm" data-testid="plan-portal" @click="handleManage">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                Portal de facturación
              </button>
              <button
                v-if="subscription.status !== 'canceled'"
                class="btn btn-outline btn-error btn-sm"
                data-testid="plan-cancel"
                :disabled="cancel.isPending.value"
                @click="handleCancel"
              >
                {{ cancel.isPending.value ? 'Cancelando...' : 'Cancelar suscripción' }}
              </button>
              <button
                v-if="subscription.status === 'canceled'"
                class="btn btn-outline btn-success btn-sm"
                data-testid="plan-resume"
                :disabled="resume.isPending.value"
                @click="handleResume"
              >
                {{ resume.isPending.value ? 'Reactivando...' : 'Reactivar suscripción' }}
              </button>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <!-- Features -->
          <div class="card bg-base-100 shadow-sm border">
            <div class="card-body">
              <h2 class="card-title text-base">Características incluidas</h2>
              <ul class="space-y-2 mt-3">
                <li v-for="f in (subscription.plan?.features ?? [])" :key="f" class="flex items-center gap-2 text-sm">
                  <span class="text-success text-lg leading-none">✓</span> {{ f }}
                </li>
                <li v-if="!subscription.plan?.features?.length" class="text-sm text-base-content/60">Sin características listadas</li>
              </ul>
            </div>
          </div>

          <!-- Usage -->
          <div v-if="subscription.plan?.maxUsers || subscription.plan?.maxStorage" class="card bg-base-100 shadow-sm border">
            <div class="card-body">
              <h2 class="card-title text-base">Uso del plan</h2>
              <div class="space-y-4 mt-3">
                <div v-if="subscription.plan?.maxUsers">
                  <div class="flex justify-between text-sm mb-1">
                    <span>Usuarios</span>
                    <span class="text-base-content/60">0 / {{ subscription.plan.maxUsers }}</span>
                  </div>
                  <progress class="progress progress-primary w-full" :value="0" :max="subscription.plan.maxUsers"></progress>
                </div>
                <div v-if="subscription.plan?.maxStorage">
                  <div class="flex justify-between text-sm mb-1">
                    <span>Almacenamiento</span>
                    <span class="text-base-content/60">0 / {{ subscription.plan.maxStorage }}</span>
                  </div>
                  <progress class="progress progress-primary w-full" :value="0" :max="subscription.plan.maxStorage"></progress>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Billing details -->
        <div class="card bg-base-100 shadow-sm border">
          <div class="card-body">
            <h2 class="card-title text-base">Detalles de facturación</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-3">
              <div>
                <p class="text-xs text-base-content/50 uppercase tracking-wide">Plan</p>
                <p class="text-sm font-medium mt-0.5">{{ subscription.plan?.name ?? '—' }}</p>
              </div>
              <div>
                <p class="text-xs text-base-content/50 uppercase tracking-wide">Precio</p>
                <p class="text-sm font-medium mt-0.5">{{ priceLabel }}</p>
              </div>
              <div>
                <p class="text-xs text-base-content/50 uppercase tracking-wide">Estado</p>
                <p class="text-sm mt-0.5"><span class="badge badge-xs" :class="statusClass">{{ statusLabel }}</span></p>
              </div>
              <div>
                <p class="text-xs text-base-content/50 uppercase tracking-wide">Renovación</p>
                <p class="text-sm font-medium mt-0.5">{{ nextBilling ?? '—' }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- No subscription -->
      <div v-else-if="!isLoading" class="card bg-base-100 shadow-sm border">
        <div class="card-body text-center py-12">
          <div class="text-4xl mb-4">📋</div>
          <h3 class="text-lg font-semibold">No tienes una suscripción activa</h3>
          <p class="text-sm text-base-content/60 mt-2 max-w-md mx-auto">
            Contrata un plan desde la <NuxtLink to="/app/settings/stripe-test" class="link link-primary">página de pruebas de Stripe</NuxtLink> para desbloquear todas las funcionalidades.
          </p>
        </div>
      </div>

      <!-- Invoice History -->
      <div class="card bg-base-100 shadow-sm border">
        <div class="card-body">
          <div class="flex items-center justify-between">
            <h2 class="card-title text-base">Historial de facturación</h2>
            <button class="btn btn-ghost btn-xs" data-testid="plan-refresh-invoices" @click="loadInvoices" :disabled="loadingInvoices">
              <svg v-if="loadingInvoices" class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" /><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              Actualizar
            </button>
          </div>
          <div v-if="invoices.length" class="overflow-x-auto mt-3">
            <table class="table table-sm">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Concepto</th>
                  <th>Importe</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="inv in invoices" :key="inv.id">
                  <td class="text-sm">{{ new Date(inv.created * 1000).toLocaleDateString('es-ES') }}</td>
                  <td class="text-sm">{{ inv.description ?? inv.billing_reason ?? 'Factura' }}</td>
                  <td class="text-sm font-medium">{{ (inv.amount_paid / 100).toFixed(2) }} {{ (inv.currency ?? 'eur').toUpperCase() }}</td>
                  <td>
                    <span class="badge badge-xs" :class="inv.paid ? 'badge-success' : inv.status === 'open' ? 'badge-warning' : 'badge-ghost'">
                      {{ inv.paid ? 'Pagada' : inv.status === 'open' ? 'Pendiente' : inv.status }}
                    </span>
                  </td>
                  <td>
                    <button
                      v-if="inv.invoice_pdf"
                      class="btn btn-ghost btn-xs"
                      data-testid="plan-invoice-pdf"
                      @click="downloadInvoice(inv.id)"
                      title="Descargar PDF"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      PDF
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else-if="!loadingInvoices" class="text-center py-6">
            <p class="text-sm text-base-content/60">No hay facturas disponibles</p>
          </div>
        </div>
      </div>
    </div>
  </SettingsLayout>
</template>