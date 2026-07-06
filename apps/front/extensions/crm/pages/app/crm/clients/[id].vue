<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { toast } from 'vue-sonner';
import FormInput from '@base/ui-app/components/form/FormInput.vue';
import FormSelect from '@base/ui-app/components/form/FormSelect.vue';
import FormTextArea from '@base/ui-app/components/form/FormTextArea.vue';
import FormSwitch from '@base/ui-app/components/form/FormSwitch.vue';
import type {
  Client,
  ClientPayload,
  Contact,
  ContactPayload,
  Interaction,
  InteractionPayload,
  InteractionType,
  Origin,
  PaginatedResponse,
  Project,
  ProjectPayload,
  ProjectStatus,
  ProjectType,
  PaymentStatus,
  Status,
} from '@crm/types';

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const route = useRoute();
const crm = useCrm();

const clientId = computed(() => route.params.id as string);

const loading = ref(false);
const saving = ref(false);
const client = ref<Client | null>(null);
const statuses = ref<Status[]>([]);
const origins = ref<Origin[]>([]);

const activeTab = ref<'data' | 'contacts' | 'interactions' | 'projects'>('data');

// Edit form
const form = ref({
  name: '',
  companyName: '',
  nif: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  region: '',
  country: '',
  statusId: '' as string | number,
  originId: '' as string | number,
  originDetail: '',
  metadata: '',
});

// Contacts
const contacts = ref<Contact[]>([]);
const contactForm = ref({
  name: '',
  position: '',
  email: '',
  phone: '',
  isPrimary: false,
});

// Interactions
const interactions = ref<Interaction[]>([]);
const interactionForm = ref({
  type: 'call' as InteractionType,
  subject: '',
  body: '',
  interactionDate: new Date().toISOString().split('T')[0],
});

// Projects
const projects = ref<Project[]>([]);
const projectForm = ref({
  name: '',
  type: 'consulting' as ProjectType,
  price: '' as string | number,
  status: 'pending' as ProjectStatus,
  paymentStatus: 'pending' as PaymentStatus,
});

const PROJECT_STATUS_LABELS: Record<string, string> = {
  active: 'Activo',
  paused: 'Pausado',
  completed: 'Completado',
  cancelled: 'Cancelado',
  pending: 'Pendiente',
};

const PROJECT_TYPE_LABELS: Record<string, string> = {
  consulting: 'Consultoría',
  design: 'Diseño',
  development: 'Desarrollo',
  marketing: 'Marketing',
  other: 'Otro',
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  paid: 'Pagado',
  partial: 'Parcial',
  overdue: 'Vencido',
};

const INTERACTION_TYPE_LABELS: Record<string, string> = {
  call: 'Llamada',
  email: 'Email',
  meeting: 'Reunión',
  note: 'Nota',
  proposal: 'Propuesta',
  other: 'Otro',
};

const statusOptions = computed(() => [
  { label: 'Sin estado', value: '' },
  ...statuses.value.map((s: any) => ({ label: s.label, value: s.id })),
]);

const originOptions = computed(() => [
  { label: 'Sin origen', value: '' },
  ...origins.value.map((o: any) => ({ label: o.label, value: o.id })),
]);

const interactionTypeOptions = computed(() =>
  Object.entries(INTERACTION_TYPE_LABELS).map(([value, label]) => ({ value, label })),
);

const projectTypeOptions = computed(() =>
  Object.entries(PROJECT_TYPE_LABELS).map(([value, label]) => ({ value, label })),
);

const projectStatusOptions = computed(() =>
  Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => ({ value, label })),
);

const paymentStatusOptions = computed(() =>
  Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => ({ value, label })),
);

async function loadClient() {
  loading.value = true;
  try {
    const data = await crm.getClient(clientId.value);
    client.value = data;
    form.value = {
      name: data.name || '',
      companyName: data.companyName || '',
      nif: data.nif || '',
      email: data.email || '',
      phone: data.phone || '',
      address: data.address || '',
      city: data.city || '',
      region: data.region || '',
      country: data.country || '',
      statusId: data.statusId ?? '',
      originId: data.originId ?? '',
      originDetail: data.originDetail || '',
      metadata: data.metadata ? JSON.stringify(data.metadata, null, 2) : '',
    };
  } catch (err: any) {
    toast.error('Error cargando cliente', { description: err.message });
  } finally {
    loading.value = false;
  }
}

async function loadFilters() {
  try {
    const [stat, orig] = await Promise.all([crm.getStatuses(), crm.getOrigins()]);
    statuses.value = stat;
    origins.value = orig;
  } catch (err: any) {
    toast.error('Error cargando filtros', { description: err.message });
  }
}

async function loadContacts() {
  try {
    contacts.value = await crm.getContacts(clientId.value);
  } catch (err: any) {
    toast.error('Error cargando contactos', { description: err.message });
  }
}

async function loadInteractions() {
  try {
    const res: any = await crm.getInteractions(clientId.value, 1, 100);
    interactions.value = res.data ?? res ?? [];
  } catch (err: any) {
    toast.error('Error cargando interacciones', { description: err.message });
  }
}

async function loadProjects() {
  try {
    const all: any[] = await crm.getProjects(clientId.value);
    projects.value = all ?? [];
  } catch (err: any) {
    toast.error('Error cargando proyectos', { description: err.message });
  }
}

async function saveClient() {
  if (!form.value.name.trim()) {
    toast.error('El nombre es obligatorio');
    return;
  }
  saving.value = true;
  try {
    const payload: Record<string, any> = { ...form.value };
    if (payload.statusId === '') payload.statusId = null;
    if (payload.originId === '') payload.originId = null;
    if (payload.metadata) {
      try {
        payload.metadata = JSON.parse(payload.metadata);
      } catch {
        toast.error('Metadata JSON inválido');
        saving.value = false;
        return;
      }
    } else {
      payload.metadata = null;
    }
    const updated = await crm.updateClient(clientId.value, payload);
    client.value = updated;
    toast.success('Cliente actualizado');
  } catch (err: any) {
    toast.error('Error guardando cliente', { description: err.message });
  } finally {
    saving.value = false;
  }
}

async function addContact() {
  if (!contactForm.value.name.trim()) {
    toast.error('El nombre del contacto es obligatorio');
    return;
  }
  try {
    await crm.createContact(clientId.value, { ...contactForm.value });
    toast.success('Contacto creado');
    contactForm.value = { name: '', position: '', email: '', phone: '', isPrimary: false };
    await loadContacts();
  } catch (err: any) {
    toast.error('Error creando contacto', { description: err.message });
  }
}

async function removeContact(id: number | string) {
  if (!confirm('¿Eliminar contacto?')) return;
  try {
    await crm.deleteContact(id);
    toast.success('Contacto eliminado');
    await loadContacts();
  } catch (err: any) {
    toast.error('Error eliminando contacto', { description: err.message });
  }
}

async function addInteraction() {
  if (!interactionForm.value.subject.trim()) {
    toast.error('El asunto es obligatorio');
    return;
  }
  try {
    await crm.createInteraction(clientId.value, {
      ...interactionForm.value,
      interactionDate: new Date(interactionForm.value.interactionDate).toISOString(),
    });
    toast.success('Interacción creada');
    interactionForm.value = {
      type: 'call',
      subject: '',
      body: '',
      interactionDate: new Date().toISOString().split('T')[0],
    };
    await loadInteractions();
  } catch (err: any) {
    toast.error('Error creando interacción', { description: err.message });
  }
}

async function removeInteraction(id: number | string) {
  if (!confirm('¿Eliminar interacción?')) return;
  try {
    await crm.deleteInteraction(id);
    toast.success('Interacción eliminada');
    await loadInteractions();
  } catch (err: any) {
    toast.error('Error eliminando interacción', { description: err.message });
  }
}

async function addProject() {
  if (!projectForm.value.name.trim()) {
    toast.error('El nombre del proyecto es obligatorio');
    return;
  }
  try {
    await crm.createProject({
      ...projectForm.value,
      clientId: Number(clientId.value),
      price: projectForm.value.price ? Number(projectForm.value.price) : null,
    });
    toast.success('Proyecto creado');
    projectForm.value = { name: '', type: 'consulting', price: '', status: 'pending', paymentStatus: 'pending' };
    await loadProjects();
  } catch (err: any) {
    toast.error('Error creando proyecto', { description: err.message });
  }
}

async function removeProject(id: number | string) {
  if (!confirm('¿Eliminar proyecto?')) return;
  try {
    await crm.deleteProject(id);
    toast.success('Proyecto eliminado');
    await loadProjects();
  } catch (err: any) {
    toast.error('Error eliminando proyecto', { description: err.message });
  }
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// Track which tabs have already been loaded to avoid duplicate fetches
const loadedTabs = ref<Set<string>>(new Set());

onMounted(async () => {
  await Promise.all([loadClient(), loadFilters()]);
  // Only load the default tab data on mount; others load lazily on demand
  loadedTabs.value.add('data');
});

watch(activeTab, async (tab) => {
  if (loadedTabs.value.has(tab)) return;
  loadedTabs.value.add(tab);
  if (tab === 'contacts') await loadContacts();
  else if (tab === 'interactions') await loadInteractions();
  else if (tab === 'projects') await loadProjects();
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
          <NuxtLink to="/app/crm/clients" class="btn btn-ghost btn-sm">
            ← Volver
          </NuxtLink>
          <div>
            <h1 class="text-2xl font-bold">{{ client?.name }}</h1>
            <div class="flex items-center gap-2 mt-1">
              <span v-if="client?.companyName" class="text-sm text-base-content/60">{{ client.companyName }}</span>
              <span
                v-if="client?.status"
                class="badge badge-sm"
                :style="{ backgroundColor: client.status.color, color: '#fff' }"
              >{{ client.status.label }}</span>
              <span v-if="client?.origin" class="badge badge-sm badge-ghost">{{ client.origin.label }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div role="tablist" class="tabs tabs-bordered">
        <button
          role="tab"
          class="tab"
          :class="{ 'tab-active': activeTab === 'data' }"
          @click="activeTab = 'data'"
        >Datos</button>
        <button
          role="tab"
          class="tab"
          :class="{ 'tab-active': activeTab === 'contacts' }"
          @click="activeTab = 'contacts'"
        >Contactos</button>
        <button
          role="tab"
          class="tab"
          :class="{ 'tab-active': activeTab === 'interactions' }"
          @click="activeTab = 'interactions'"
        >Interacciones</button>
        <button
          role="tab"
          class="tab"
          :class="{ 'tab-active': activeTab === 'projects' }"
          @click="activeTab = 'projects'"
        >Proyectos</button>
      </div>

      <!-- Tab: Datos -->
      <div v-if="activeTab === 'data'" class="card bg-base-100 shadow-sm border border-base-300">
        <div class="card-body">
          <h2 class="card-title">Datos del cliente</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormInput v-model="form.name" label="Nombre" required />
            <FormInput v-model="form.companyName" label="Empresa" />
            <FormInput v-model="form.nif" label="NIF" />
            <FormInput v-model="form.email" label="Email" type="email" />
            <FormInput v-model="form.phone" label="Teléfono" />
            <FormInput v-model="form.address" label="Dirección" />
            <FormInput v-model="form.city" label="Ciudad" />
            <FormInput v-model="form.region" label="Región" />
            <FormInput v-model="form.country" label="País" />
            <FormSelect v-model="form.statusId" label="Estado" :options="statusOptions" />
            <FormSelect v-model="form.originId" label="Origen" :options="originOptions" />
            <FormInput v-model="form.originDetail" label="Detalle de origen" />
            <div class="md:col-span-2">
              <FormTextArea v-model="form.metadata" label="Metadata (JSON opcional)" :rows="4" />
            </div>
          </div>
          <div class="card-actions justify-end mt-4">
            <button class="btn btn-primary" :disabled="saving" @click="saveClient">
              <span v-if="saving" class="loading loading-spinner loading-xs"></span>
              Guardar
            </button>
          </div>
        </div>
      </div>

      <!-- Tab: Contactos -->
      <div v-if="activeTab === 'contacts'" class="space-y-4">
        <div class="card bg-base-100 shadow-sm border border-base-300">
          <div class="card-body">
            <h2 class="card-title">Nuevo contacto</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormInput v-model="contactForm.name" label="Nombre" required />
              <FormInput v-model="contactForm.position" label="Cargo" />
              <FormInput v-model="contactForm.email" label="Email" type="email" />
              <FormInput v-model="contactForm.phone" label="Teléfono" />
            </div>
            <div class="mt-2">
              <FormSwitch v-model="contactForm.isPrimary" label="Contacto principal" />
            </div>
            <div class="card-actions justify-end mt-2">
              <button class="btn btn-primary btn-sm" @click="addContact">Añadir contacto</button>
            </div>
          </div>
        </div>

        <div class="card bg-base-100 shadow-sm border border-base-300">
          <div class="card-body p-0">
            <div class="overflow-x-auto">
              <table class="table table-sm">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Cargo</th>
                    <th>Email</th>
                    <th>Teléfono</th>
                    <th>Principal</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="contacts.length === 0">
                    <td colspan="6" class="text-center text-base-content/40 py-6">Sin contactos</td>
                  </tr>
                  <tr v-for="contact in contacts" :key="contact.id">
                    <td class="font-medium">{{ contact.name }}</td>
                    <td>{{ contact.position || '—' }}</td>
                    <td>{{ contact.email || '—' }}</td>
                    <td>{{ contact.phone || '—' }}</td>
                    <td>
                      <span v-if="contact.isPrimary" class="badge badge-xs badge-primary">Sí</span>
                      <span v-else class="text-base-content/40">—</span>
                    </td>
                    <td>
                      <button class="btn btn-ghost btn-xs text-error" @click="removeContact(contact.id)">
                        Eliminar
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab: Interacciones -->
      <div v-if="activeTab === 'interactions'" class="space-y-4">
        <div class="card bg-base-100 shadow-sm border border-base-300">
          <div class="card-body">
            <h2 class="card-title">Nueva interacción</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormSelect v-model="interactionForm.type" label="Tipo" :options="interactionTypeOptions" />
              <FormInput v-model="interactionForm.interactionDate" label="Fecha" type="text" />
              <div class="md:col-span-2">
                <FormInput v-model="interactionForm.subject" label="Asunto" required />
              </div>
              <div class="md:col-span-2">
                <FormTextArea v-model="interactionForm.body" label="Descripción" :rows="3" />
              </div>
            </div>
            <div class="card-actions justify-end mt-2">
              <button class="btn btn-primary btn-sm" @click="addInteraction">Añadir interacción</button>
            </div>
          </div>
        </div>

        <div class="card bg-base-100 shadow-sm border border-base-300">
          <div class="card-body">
            <h2 class="card-title">Historial</h2>
            <div v-if="interactions.length === 0" class="text-sm text-base-content/40 py-6 text-center">
              Sin interacciones
            </div>
            <ul v-else class="timeline timeline-vertical">
              <li v-for="item in interactions" :key="item.id">
                <div class="timeline-start">
                  <span class="badge badge-sm badge-primary">{{ INTERACTION_TYPE_LABELS[item.type] ?? item.type }}</span>
                </div>
                <div class="timeline-middle">
                  <span class="w-2 h-2 rounded-full bg-primary" />
                </div>
                <div class="timeline-end mb-4">
                  <div class="flex items-center justify-between">
                    <span class="text-sm font-medium">{{ item.subject }}</span>
                    <button class="btn btn-ghost btn-xs text-error" @click="removeInteraction(item.id)">
                      Eliminar
                    </button>
                  </div>
                  <div class="text-xs text-base-content/60">{{ formatDate(item.interactionDate) }}</div>
                  <p v-if="item.body" class="text-sm text-base-content/70 mt-1">{{ item.body }}</p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Tab: Proyectos -->
      <div v-if="activeTab === 'projects'" class="space-y-4">
        <div class="card bg-base-100 shadow-sm border border-base-300">
          <div class="card-body">
            <h2 class="card-title">Nuevo proyecto</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormInput v-model="projectForm.name" label="Nombre" required />
              <FormSelect v-model="projectForm.type" label="Tipo" :options="projectTypeOptions" />
              <FormInput v-model="projectForm.price" label="Precio" type="number" />
              <FormSelect v-model="projectForm.status" label="Estado" :options="projectStatusOptions" />
              <FormSelect v-model="projectForm.paymentStatus" label="Estado de pago" :options="paymentStatusOptions" />
            </div>
            <div class="card-actions justify-end mt-2">
              <button class="btn btn-primary btn-sm" @click="addProject">Añadir proyecto</button>
            </div>
          </div>
        </div>

        <div class="card bg-base-100 shadow-sm border border-base-300">
          <div class="card-body p-0">
            <div class="overflow-x-auto">
              <table class="table table-sm">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Tipo</th>
                    <th>Precio</th>
                    <th>Estado</th>
                    <th>Pago</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="projects.length === 0">
                    <td colspan="6" class="text-center text-base-content/40 py-6">Sin proyectos</td>
                  </tr>
                  <tr v-for="project in projects" :key="project.id">
                    <td class="font-medium">{{ project.name }}</td>
                    <td>{{ PROJECT_TYPE_LABELS[project.type] ?? project.type }}</td>
                    <td>{{ project.price != null ? `€${project.price}` : '—' }}</td>
                    <td>
                      <span class="badge badge-sm badge-outline">{{ PROJECT_STATUS_LABELS[project.status] ?? project.status }}</span>
                    </td>
                    <td>
                      <span class="badge badge-sm" :class="{
                        'badge-success': project.paymentStatus === 'paid',
                        'badge-warning': project.paymentStatus === 'partial',
                        'badge-error': project.paymentStatus === 'overdue',
                        'badge-ghost': project.paymentStatus === 'pending',
                      }">
                        {{ PAYMENT_STATUS_LABELS[project.paymentStatus] ?? project.paymentStatus }}
                      </span>
                    </td>
                    <td>
                      <button class="btn btn-ghost btn-xs text-error" @click="removeProject(project.id)">
                        Eliminar
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>