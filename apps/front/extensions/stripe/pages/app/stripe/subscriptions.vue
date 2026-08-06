<script setup lang="ts">
import { ref, computed, h, watch } from 'vue';
import { toast } from 'vue-sonner';
import { Eye, Ban } from 'lucide-vue-next';
import DataTable from '@base/ui-app/components/data-table/DataTable.vue';
import FormSelect from '@base/ui-app/components/form/FormSelect.vue';
import {
  useSubscriptionsQuery,
  useCancelAdminSubscriptionMutation,
} from '@stripe/composables/useStripe';
import type {
  CellContext,
  Subscription,
  SubscriptionStatus,
} from '@stripe/types';

definePageMeta({ layout: 'default', middleware: ['auth', 'admin'] });

const statusFilter = ref<SubscriptionStatus | ''>('active');
const { data: subsData, isLoading, refetch } = useSubscriptionsQuery(
  statusFilter.value || undefined,
);
const cancelMut = useCancelAdminSubscriptionMutation();

// Refetch when filter changes
watch(statusFilter, () => {
  refetch();
});

const subscriptions = computed<Subscription[]>(() => {
  const d = subsData.value;
  if (!d) return [];
  return Array.isArray(d) ? d : (d.data ?? []);
});

const statusOptions = [
  { value: 'active', label: 'Activas' },
  { value: 'trialing', label: 'En prueba' },
  { value: 'past_due', label: 'Pago vencido' },
  { value: 'canceled', label: 'Canceladas' },
  { value: 'unpaid', label: 'Impagadas' },
];

const cancelTarget = ref<Subscription | null>(null);


async function confirmCancel() {
  if (!cancelTarget.value) return;
  try {
    await cancelMut.mutateAsync(cancelTarget.value.id);
    toast.success('Suscripción cancelada');
    cancelTarget.value = null;
  } catch (err: unknown) {
    toast.error('Error cancelando suscripción', { description: errorMessage(err) });
  }
}

function formatDate(date?: string | null): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function statusBadge(status: string): string {
  switch (status) {
    case 'active':
      return 'badge-success';
    case 'canceled':
      return 'badge-error';
    case 'past_due':
      return 'badge-warning';
    case 'trialing':
      return 'badge-info';
    case 'unpaid':
      return 'badge-error';
    default:
      return 'badge-ghost';
  }
}

const columns = computed(() => [
  {
    accessorKey: 'customerEmail',
    headerName: 'Cliente',
    header: 'Cliente',
    filterType: 'string' as const,
    cell: ({ row }: CellContext<Subscription>) =>
      row.original.customerEmail ||
      h('span', { class: 'text-base-content/40' }, '—'),
  },
  {
    id: 'planName',
    headerName: 'Plan',
    header: 'Plan',
    filterType: 'string' as const,
    cell: ({ row }: CellContext<Subscription>) =>
      row.original.plan?.name || h('span', { class: 'text-base-content/40' }, '—'),
  },
  {
    accessorKey: 'status',
    headerName: 'Estado',
    header: 'Estado',
    filterType: 'select' as const,
    options: statusOptions,
    cell: ({ row }: CellContext<Subscription>) =>
      h(
        'span',
        {
          class: `badge badge-xs ${statusBadge(row.original.status)}`,
        },
        row.original.status,
      ),
  },
  {
    accessorKey: 'currentPeriodEnd',
    headerName: 'Fin de periodo',
    header: 'Fin de periodo',
    filterType: 'date' as const,
    cell: ({ row }: CellContext<Subscription>) =>
      formatDate(row.original.currentPeriodEnd),
  },
  {
    id: 'actions',
    headerName: 'Acciones',
    header: 'Acciones',
    enableSorting: false,
    cell: ({ row }: CellContext<Subscription>) =>
      h('div', { class: 'flex items-center gap-1' }, [
        h('div', { class: 'tooltip', 'data-tip': 'Ver' }, [
          h('button', {
            class: 'btn btn-outline btn-sm w-8 h-8 p-0',
            'aria-label': `Ver ${row.original.customerEmail}`,
            onClick: (e: Event) => {
              e.stopPropagation();
              navigateTo(`/app/stripe/subscriptions/${row.original.id}`);
            },
          }, [h(Eye, { class: 'w-4 h-4' })]),
        ]),
        row.original.status !== 'canceled'
          ? h('div', { class: 'tooltip', 'data-tip': 'Cancelar' }, [
              h('button', {
                class: 'btn btn-error btn-sm w-8 h-8 p-0',
                onClick: (e: Event) => {
                  e.stopPropagation();
                  cancelTarget.value = row.original;
                },
              }, [h(Ban, { class: 'w-4 h-4' })]),
            ])
          : null,
      ]),
  },
]);
</script>

<template>
  <div class="p-6 space-y-4">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">Suscripciones</h1>
    </div>

    <!-- Status filter -->
    <div class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body p-4">
        <div class="max-w-xs">
          <FormSelect
            v-model="statusFilter"
            label="Filtrar por estado"
            :options="statusOptions"
            placeholder="Todas"
          />
        </div>
      </div>
    </div>

    <div class="card bg-base-100 shadow-sm border border-base-300">
      <div class="card-body p-6">
        <div v-if="isLoading" class="flex justify-center py-12">
          <span class="loading loading-spinner loading-lg text-primary" />
        </div>
        <DataTable
          v-else
          :columns="columns"
          :data="subscriptions"
          manual
          table-name="stripe-subscriptions"
          @row-click="(row: Subscription) => navigateTo(`/app/stripe/subscriptions/${row.id}`)"
        />
      </div>
    </div>

    <!-- Cancel confirm dialog -->
    <dialog v-if="cancelTarget" class="modal modal-open">
      <div class="modal-box">
        <h3 class="text-lg font-bold">Cancelar suscripción</h3>
        <p class="py-4">
          ¿Seguro que quieres cancelar la suscripción de
          <strong>{{ cancelTarget.customerEmail || 'este cliente' }}</strong>?
          Se cancelará al final del periodo actual.
        </p>
        <div class="modal-action">
          <button class="btn btn-ghost" @click="cancelTarget = null">Cerrar</button>
          <button
            class="btn btn-error"
            :disabled="cancelMut.isPending.value"
            @click="confirmCancel"
          >
            <span v-if="cancelMut.isPending.value" class="loading loading-spinner loading-xs" />
            Cancelar suscripción
          </button>
        </div>
      </div>
      <div class="modal-backdrop" @click="cancelTarget = null" />
    </dialog>
  </div>
</template>