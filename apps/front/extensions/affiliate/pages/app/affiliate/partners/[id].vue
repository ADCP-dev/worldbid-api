<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { toast } from 'vue-sonner';
import FormInput from '@base/ui-app/components/form/FormInput.vue';
import FormSwitch from '@base/ui-app/components/form/FormSwitch.vue';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const route = useRoute();
const affiliate = useAffiliate();

const partnerId = computed(() => route.params.id as string);

const loading = ref(false);
const saving = ref(false);
const inviting = ref(false);
const partner = ref<any>(null);
const referrals = ref<any[]>([]);
const commissions = ref<any[]>([]);

const activeTab = ref<'data' | 'referrals' | 'commissions'>('data');

const name = ref('');
const companyName = ref('');
const email = ref('');
const phone = ref('');
const iban = ref('');
const commissionRate = ref<string | number>('');
const isActive = ref(true);

const REFERRAL_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  contacted: 'Contactado',
  qualified: 'Calificado',
  converted: 'Convertido',
  lost: 'Perdido',
};

const REFERRAL_STATUS_BADGE: Record<string, string> = {
  pending: 'badge-warning',
  contacted: 'badge-info',
  qualified: 'badge-primary',
  converted: 'badge-success',
  lost: 'badge-error',
};

const COMMISSION_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  approved: 'Aprobada',
  paid: 'Pagada',
  rejected: 'Rechazada',
};

const COMMISSION_STATUS_BADGE: Record<string, string> = {
  pending: 'badge-warning',
  approved: 'badge-info',
  paid: 'badge-success',
  rejected: 'badge-error',
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount ?? 0);
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

async function loadPartner() {
  loading.value = true;
  try {
    const data = await affiliate.getPartner(partnerId.value);
    partner.value = data;
    name.value = data.name || '';
    companyName.value = data.companyName || '';
    email.value = data.email || '';
    phone.value = data.phone || '';
    iban.value = data.iban || '';
    commissionRate.value = data.commissionRate ?? '';
    isActive.value = data.isActive ?? true;
  } catch (err: any) {
    toast.error('Error cargando partner', { description: err.message });
  } finally {
    loading.value = false;
  }
}

async function loadReferrals() {
  try {
    const res: any = await affiliate.getReferrals(partnerId.value);
    referrals.value = res.data ?? res ?? [];
  } catch (err: any) {
    toast.error('Error cargando referencias', { description: err.message });
  }
}

async function loadCommissions() {
  try {
    const res: any = await affiliate.getCommissions(partnerId.value);
    commissions.value = res.data ?? res ?? [];
  } catch (err: any) {
    toast.error('Error cargando comisiones', { description: err.message });
  }
}

async function savePartner() {
  if (!name.value.trim()) {
    toast.error('El nombre es obligatorio');
    return;
  }
  saving.value = true;
  try {
    const payload: Record<string, any> = {
      name: name.value,
      companyName: companyName.value,
      email: email.value,
      phone: phone.value,
      iban: iban.value,
      commissionRate: commissionRate.value === '' ? null : Number(commissionRate.value),
      isActive: isActive.value,
    };
    const updated = await affiliate.updatePartner(partnerId.value, payload);
    partner.value = updated;
    toast.success('Partner actualizado');
  } catch (err: any) {
    toast.error('Error guardando partner', { description: err.message });
  } finally {
    saving.value = false;
  }
}

async function inviteToPortal() {
  if (!confirm('¿Invitar al partner al portal? Se enviará un email.')) return;
  inviting.value = true;
  try {
    await affiliate.invitePartner(partnerId.value);
    toast.success('Invitación enviada');
  } catch (err: any) {
    toast.error('Error enviando invitación', { description: err.message });
  } finally {
    inviting.value = false;
  }
}

onMounted(async () => {
  await loadPartner();
  await Promise.all([loadReferrals(), loadCommissions()]);
});
</script>

<template>
  <div class="p-6 space-y-4">
    <div v-if="loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg text-primary" />
    </div>

    <template v-else>
      <!-- Header -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <NuxtLink to="/app/affiliate/partners" class="btn btn-ghost btn-sm">← Volver</NuxtLink>
          <div>
            <h1 class="text-2xl font-bold">{{ partner?.name }}</h1>
            <div class="flex items-center gap-2 mt-1">
              <span v-if="partner?.companyName" class="text-sm text-base-content/60">{{ partner.companyName }}</span>
              <span v-if="partner?.isActive" class="badge badge-sm badge-success">Activo</span>
              <span v-else class="badge badge-sm badge-ghost">Inactivo</span>
            </div>
          </div>
        </div>
        <button class="btn btn-outline btn-sm" :disabled="inviting" @click="inviteToPortal">
          <span v-if="inviting" class="loading loading-spinner loading-xs"></span>
          Invitar al portal
        </button>
      </div>

      <!-- Tabs -->
      <div role="tablist" class="tabs tabs-bordered">
        <button role="tab" class="tab" :class="{ 'tab-active': activeTab === 'data' }" @click="activeTab = 'data'">Datos</button>
        <button role="tab" class="tab" :class="{ 'tab-active': activeTab === 'referrals' }" @click="activeTab = 'referrals'">Referencias</button>
        <button role="tab" class="tab" :class="{ 'tab-active': activeTab === 'commissions' }" @click="activeTab = 'commissions'">Comisiones</button>
      </div>

      <!-- Tab: Datos -->
      <div v-if="activeTab === 'data'" class="card bg-base-100 shadow-sm border border-base-300">
        <div class="card-body">
          <h2 class="card-title">Datos del partner</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormInput
              v-model="name"
              label="Nombre"
              placeholder="Nombre del partner"
              required
            />
            <FormInput
              v-model="companyName"
              label="Empresa"
              placeholder="Empresa"
            />
            <FormInput
              v-model="email"
              label="Email"
              placeholder="email@ejemplo.com"
              type="email"
            />
            <FormInput
              v-model="phone"
              label="Teléfono"
              placeholder="Teléfono"
            />
            <FormInput
              v-model="iban"
              label="IBAN"
              placeholder="ES00 0000 0000 0000 0000 0000"
            />
            <FormInput
              v-model="commissionRate"
              label="Comisión (%)"
              placeholder="0.00"
              type="number"
              step="0.01"
            />
            <div class="md:col-span-2">
              <FormSwitch
                v-model="isActive"
                label="Partner activo"
              />
            </div>
          </div>
          <div class="card-actions justify-end mt-4">
            <button class="btn btn-primary" :disabled="saving" @click="savePartner">
              <span v-if="saving" class="loading loading-spinner loading-xs"></span>
              Guardar
            </button>
          </div>
        </div>
      </div>

      <!-- Tab: Referencias -->
      <div v-if="activeTab === 'referrals'" class="card bg-base-100 shadow-sm border border-base-300">
        <div class="card-body p-0">
          <div class="p-4 border-b border-base-300">
            <h2 class="card-title">Referencias</h2>
          </div>
          <div class="overflow-x-auto">
            <table class="table table-sm">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Empresa</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="referrals.length === 0">
                  <td colspan="4" class="text-center text-base-content/40 py-6">Sin referencias</td>
                </tr>
                <tr v-for="r in referrals" :key="r.id">
                  <td class="font-medium">{{ r.clientName || '—' }}</td>
                  <td>{{ r.companyName || '—' }}</td>
                  <td>
                    <span class="badge badge-sm" :class="REFERRAL_STATUS_BADGE[r.status]">
                      {{ REFERRAL_STATUS_LABELS[r.status] ?? r.status }}
                    </span>
                  </td>
                  <td>{{ formatDate(r.referredDate || r.createdAt) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Tab: Comisiones -->
      <div v-if="activeTab === 'commissions'" class="card bg-base-100 shadow-sm border border-base-300">
        <div class="card-body p-0">
          <div class="p-4 border-b border-base-300">
            <h2 class="card-title">Comisiones</h2>
          </div>
          <div class="overflow-x-auto">
            <table class="table table-sm">
              <thead>
                <tr>
                  <th>Proyecto</th>
                  <th>Comisión</th>
                  <th>Estado</th>
                  <th>Pagada</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="commissions.length === 0">
                  <td colspan="4" class="text-center text-base-content/40 py-6">Sin comisiones</td>
                </tr>
                <tr v-for="c in commissions" :key="c.id">
                  <td class="font-medium">{{ c.project?.name || '—' }}</td>
                  <td class="font-semibold">{{ formatCurrency(c.commissionAmount) }}</td>
                  <td>
                    <span class="badge badge-sm" :class="COMMISSION_STATUS_BADGE[c.status]">
                      {{ COMMISSION_STATUS_LABELS[c.status] ?? c.status }}
                    </span>
                  </td>
                  <td>{{ c.paidDate ? formatDate(c.paidDate) : '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>