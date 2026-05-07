<script setup lang="ts">
import { computed } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { fetchWrapper } from '@/helpers/fetch-wrapper';

definePageMeta({ layout: 'default', middleware: 'auth' });

const config = useRuntimeConfig();
const baseURL = `${config.public.apiUrl}${config.public.apiPrefix}`;

const { data: subscription, isLoading } = useQuery({
  queryKey: ['subscription', 'me'],
  queryFn: () => fetchWrapper.get(`${baseURL}/stripe/subscriptions/me`),
});

const { data: plans } = useQuery({
  queryKey: ['stripe', 'plans'],
  queryFn: () => fetchWrapper.get(`${baseURL}/stripe/plans`),
});

const statusClass = computed(() => {
  const map: Record<string, string> = {
    active: 'badge-success',
    past_due: 'badge-warning',
    canceled: 'badge-error',
    incomplete: 'badge-ghost',
    trialing: 'badge-info',
  };
  return map[subscription.value?.status] ?? 'badge-ghost';
});

const statusLabel = computed(() => {
  const map: Record<string, string> = {
    active: 'Activa',
    past_due: 'Pago pendiente',
    canceled: 'Cancelada',
    incomplete: 'Incompleta',
    trialing: 'Periodo de prueba',
  };
  return map[subscription.value?.status] ?? subscription.value?.status ?? '—';
});
</script>

<template>
  <SettingsLayout>
    <div class="space-y-6">
      <div class="space-y-0.5">
        <h2 class="text-2xl font-bold tracking-tight">
          Suscripción
        </h2>
        <p class="text-muted-foreground">
          Gestiona tu plan y suscripción
        </p>
      </div>
      <div class="divider my-6"></div>

      <div v-if="isLoading" class="flex justify-center py-12">
        <span class="loading loading-spinner loading-lg"></span>
      </div>

      <!-- Current subscription -->
      <div v-if="subscription" class="space-y-6">
        <div class="card bg-base-100 shadow-sm border">
          <div class="card-body">
            <h2 class="card-title">Suscripción actual</h2>
            <div class="flex items-center gap-3 mt-2">
              <span class="text-xl font-bold">{{ subscription.plan?.name ?? 'Sin plan' }}</span>
              <span class="badge" :class="statusClass">{{ statusLabel }}</span>
            </div>
            <p v-if="subscription.currentPeriodStart" class="text-sm text-base-content/60">
              {{ new Date(subscription.currentPeriodStart).toLocaleDateString('es-ES') }} →
              {{ new Date(subscription.currentPeriodEnd).toLocaleDateString('es-ES') }}
            </p>
          </div>
        </div>

        <div class="card bg-base-100 shadow-sm border">
          <div class="card-body">
            <h2 class="card-title">Características del plan</h2>
            <ul class="space-y-2 mt-2">
              <li v-for="f in (subscription.plan?.features ?? [])" :key="f" class="flex items-center gap-2">
                <span class="text-success">✓</span> {{ f }}
              </li>
              <li v-if="!subscription.plan?.features?.length" class="text-sm text-base-content/60">Sin características listadas</li>
            </ul>
          </div>
        </div>

        <div v-if="subscription.plan?.maxUsers || subscription.plan?.maxStorage" class="card bg-base-100 shadow-sm border">
          <div class="card-body">
            <h2 class="card-title">Uso</h2>
            <div class="space-y-4 mt-2">
              <div v-if="subscription.plan?.maxUsers">
                <div class="flex justify-between text-sm mb-1">
                  <span>Usuarios</span>
                  <span class="text-base-content/60">{{ subscription.plan.maxUsers }} máx</span>
                </div>
                <progress class="progress progress-primary w-full" :value="0" :max="subscription.plan.maxUsers"></progress>
              </div>
              <div v-if="subscription.plan?.maxStorage">
                <div class="flex justify-between text-sm mb-1">
                  <span>Almacenamiento</span>
                  <span class="text-base-content/60">{{ subscription.plan.maxStorage }} bytes máx</span>
                </div>
                <progress class="progress progress-primary w-full" :value="0" :max="subscription.plan.maxStorage"></progress>
              </div>
            </div>
          </div>
        </div>

        <div class="flex gap-3">
          <button class="btn btn-primary" disabled>Cambiar plan</button>
          <button class="btn btn-outline btn-error" disabled>Cancelar suscripción</button>
          <button v-if="subscription.status === 'canceled'" class="btn btn-outline btn-success" disabled>Reactivar</button>
        </div>
      </div>

      <!-- No subscription -->
      <div v-else-if="!isLoading" class="card bg-base-100 shadow-sm border">
        <div class="card-body text-center py-8">
          <p class="text-lg text-base-content/60">No tienes una suscripción activa</p>
        </div>
      </div>

      <!-- Available plans section (always visible) -->
      <div class="card bg-base-100 shadow-sm border">
        <div class="card-body">
          <h2 class="card-title">Planes disponibles</h2>
          <div v-if="plans?.length" class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div
              v-for="plan in plans"
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
                  <button class="btn btn-primary btn-sm w-full" disabled>Contratar</button>
                </div>
              </div>
            </div>
          </div>
          <p v-else class="text-sm text-base-content/60 mt-2">No hay planes disponibles</p>
        </div>
      </div>

      <!-- History section (always visible) -->
      <div class="card bg-base-100 shadow-sm border">
        <div class="card-body">
          <h2 class="card-title">Historial</h2>
          <p class="text-sm text-base-content/60 mt-2">
            Aquí aparecerá el historial de facturación y cambios de plan.
          </p>
        </div>
      </div>
    </div>
  </SettingsLayout>
</template>
