<script setup lang="ts">
import { ref, computed, onMounted, h } from 'vue';
import { toast } from 'vue-sonner';
import { Plus, Trash2 } from 'lucide-vue-next';
import FormInput from '@base/ui-app/components/form/FormInput.vue';
import FormTextArea from '@base/ui-app/components/form/FormTextArea.vue';
import FormSwitch from '@base/ui-app/components/form/FormSwitch.vue';
import FormSelect from '@base/ui-app/components/form/FormSelect.vue';
import {
  useProductQuery,
  useUpdateProductMutation,
  useCreatePriceMutation,
  useDeletePriceMutation,
} from '@stripe/composables/useStripe';
import type { PriceInterval } from '@stripe/types';

definePageMeta({ layout: 'default', middleware: ['auth', 'admin'] });

const route = useRoute();
const productId = computed(() => route.params.id as string);

const { data: product, isLoading, refetch } = useProductQuery(productId.value);
const updateMut = useUpdateProductMutation();
const createPriceMut = useCreatePriceMutation();
const deletePriceMut = useDeletePriceMutation();

const saving = ref(false);
const showPriceModal = ref(false);

const form = ref({
  name: '',
  description: '',
  stripeProductId: '',
  active: true,
});

const priceForm = ref({
  unitAmount: 0,
  currency: 'eur',
  interval: 'month' as PriceInterval,
  intervalCount: 1,
  active: true,
});

const intervalOptions = [
  { value: 'day', label: 'Día' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
  { value: 'year', label: 'Año' },
];

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

onMounted(async () => {
  // Wait for product data then populate form
  await refetch();
  if (product.value) {
    form.value = {
      name: product.value.name || '',
      description: product.value.description || '',
      stripeProductId: product.value.stripeProductId || '',
      active: product.value.active,
    };
  }
});

async function saveProduct() {
  if (!form.value.name.trim()) {
    toast.error('El nombre es obligatorio');
    return;
  }
  saving.value = true;
  try {
    await updateMut.mutateAsync({
      id: productId.value,
      payload: {
        name: form.value.name,
        description: form.value.description || null,
        stripeProductId: form.value.stripeProductId || null,
        active: form.value.active,
      },
    });
    toast.success('Producto actualizado');
  } catch (err: unknown) {
    toast.error('Error guardando producto', { description: errorMessage(err) });
  } finally {
    saving.value = false;
  }
}

function openPriceModal() {
  priceForm.value = {
    unitAmount: 0,
    currency: 'eur',
    interval: 'month',
    intervalCount: 1,
    active: true,
  };
  showPriceModal.value = true;
}

function closePriceModal() {
  showPriceModal.value = false;
}

async function addPrice() {
  if (priceForm.value.unitAmount <= 0) {
    toast.error('El importe debe ser mayor que 0');
    return;
  }
  try {
    await createPriceMut.mutateAsync({
      productId: productId.value,
      unitAmount: Number(priceForm.value.unitAmount),
      currency: priceForm.value.currency,
      interval: priceForm.value.interval,
      intervalCount: Number(priceForm.value.intervalCount),
      active: priceForm.value.active,
    });
    toast.success('Precio creado');
    closePriceModal();
    await refetch();
  } catch (err: unknown) {
    toast.error('Error creando precio', { description: errorMessage(err) });
  }
}

async function removePrice(priceId: string) {
  if (!confirm('¿Eliminar este precio?')) return;
  try {
    await deletePriceMut.mutateAsync(priceId);
    toast.success('Precio eliminado');
    await refetch();
  } catch (err: unknown) {
    toast.error('Error eliminando precio', { description: errorMessage(err) });
  }
}

const prices = computed(() => product.value?.prices ?? []);

function formatAmount(cents: number, currency: string): string {
  return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
}
</script>

<template>
  <div class="p-6 space-y-4">
    <div v-if="isLoading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg text-primary" />
    </div>

    <template v-else>
      <div class="flex items-center gap-3">
        <NuxtLink to="/app/stripe/products" class="btn btn-ghost btn-sm">
          ← Volver
        </NuxtLink>
        <h1 class="text-2xl font-bold">{{ product?.name }}</h1>
      </div>

      <!-- Product edit form -->
      <div class="card bg-base-100 shadow-sm border border-base-300">
        <div class="card-body">
          <h2 class="card-title text-base">Datos del producto</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormInput v-model="form.name" label="Nombre" required />
            <FormInput v-model="form.stripeProductId" label="Stripe Product ID" />
            <div class="md:col-span-2">
              <FormTextArea v-model="form.description" label="Descripción" :rows="3" />
            </div>
            <FormSwitch v-model="form.active" label="Activo" />
          </div>
          <div class="card-actions justify-end mt-4">
            <button class="btn btn-primary" :disabled="saving" @click="saveProduct">
              <span v-if="saving" class="loading loading-spinner loading-xs" />
              Guardar
            </button>
          </div>
        </div>
      </div>

      <!-- Prices -->
      <div class="card bg-base-100 shadow-sm border border-base-300">
        <div class="card-body">
          <div class="flex items-center justify-between">
            <h2 class="card-title text-base">Precios</h2>
            <button class="btn btn-primary btn-sm" @click="openPriceModal">
              <Plus class="w-4 h-4" /> Añadir precio
            </button>
          </div>
          <div v-if="prices.length" class="overflow-x-auto mt-3">
            <table class="table table-sm">
              <thead>
                <tr>
                  <th>Importe</th>
                  <th>Moneda</th>
                  <th>Intervalo</th>
                  <th>Activo</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                <tr v-for="price in prices" :key="price.id">
                  <td class="font-medium">
                    {{ formatAmount(price.unitAmount, price.currency) }}
                  </td>
                  <td>{{ price.currency.toUpperCase() }}</td>
                  <td>
                    {{ price.intervalCount ? `${price.intervalCount} ` : '' }}{{ price.interval }}
                  </td>
                  <td>
                    <span
                      class="badge badge-xs"
                      :class="price.active ? 'badge-success' : 'badge-ghost'"
                    >
                      {{ price.active ? 'Sí' : 'No' }}
                    </span>
                  </td>
                  <td>
                    <button
                      class="btn btn-ghost btn-xs text-error"
                      @click="removePrice(price.id)"
                    >
                      <Trash2 class="w-4 h-4" /> Eliminar
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else class="text-sm text-base-content/60 py-6 text-center">
            Sin precios. Añade uno para empezar a vender este producto.
          </p>
        </div>
      </div>

      <!-- Add price modal -->
      <dialog v-if="showPriceModal" class="modal modal-open">
        <div class="modal-box">
          <h3 class="text-lg font-bold">Nuevo precio</h3>
          <div class="py-4 space-y-4">
            <FormInput
              v-model="priceForm.unitAmount"
              label="Importe (céntimos)"
              type="number"
              required
              placeholder="1000 = 10.00 €"
              min="1"
            />
            <FormInput
              v-model="priceForm.currency"
              label="Moneda"
              required
              placeholder="eur"
            />
            <FormSelect
              v-model="priceForm.interval"
              label="Intervalo"
              :options="intervalOptions"
            />
            <FormInput
              v-model="priceForm.intervalCount"
              label="Conteo de intervalo"
              type="number"
              min="1"
            />
            <FormSwitch v-model="priceForm.active" label="Activo" />
          </div>
          <div class="modal-action">
            <button class="btn btn-ghost" @click="closePriceModal">Cancelar</button>
            <button
              class="btn btn-primary"
              :disabled="createPriceMut.isPending.value"
              @click="addPrice"
            >
              <span v-if="createPriceMut.isPending.value" class="loading loading-spinner loading-xs" />
              Crear
            </button>
          </div>
        </div>
        <div class="modal-backdrop" @click="closePriceModal" />
      </dialog>
    </template>
  </div>
</template>