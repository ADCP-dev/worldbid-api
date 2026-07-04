<script setup lang="ts">
definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

const extensionWidgets = useState<any[]>('app:dashboardWidgets', () => []);
const widgetData = ref<Record<string, any>>({});
const loading = ref(true);

async function loadWidgets() {
  loading.value = true;
  for (const widget of extensionWidgets.value) {
    try {
      if (widget.loadData) {
        widgetData.value[widget.id] = await widget.loadData();
      }
    } catch (err: any) {
      console.error(`Failed to load widget ${widget.id}:`, err?.message);
    }
  }
  loading.value = false;
}

onMounted(loadWidgets);
</script>

<template>
  <div class="w-full flex flex-col gap-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 class="text-2xl font-bold tracking-tight">Dashboard</h2>
    </div>
    
    <div v-if="loading" class="flex justify-center py-12">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <div v-else-if="extensionWidgets.length === 0" class="text-center py-12">
      <p class="text-base-content/60">No hay widgets de extensiones instalados.</p>
    </div>

    <div v-else class="flex flex-col gap-6">
      <div v-for="widget in extensionWidgets" :key="widget.id">
        <h3 class="text-lg font-semibold mb-3">{{ widget.title }}</h3>
        
        <!-- Stat cards widget -->
        <div v-if="widget.type === 'stat-cards'" class="grid gap-4 lg:grid-cols-4 md:grid-cols-2">
          <div v-for="stat in (widgetData[widget.id] || [])" :key="stat.label" class="card bg-base-100 shadow-sm border">
            <div class="card-body items-center text-center p-4">
              <span class="text-2xl font-bold text-primary">{{ stat.value }}</span>
              <span class="text-sm opacity-70">{{ stat.label }}</span>
            </div>
          </div>
        </div>

        <!-- Table widget -->
        <div v-else-if="widget.type === 'table'" class="card bg-base-100 shadow-sm border">
          <div class="card-body p-4">
            <table class="table table-sm">
              <thead>
                <tr>
                  <th v-for="col in widget.columns" :key="col">{{ col.label }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, i) in (widgetData[widget.id] || [])" :key="i">
                  <td v-for="col in widget.columns" :key="col.key">{{ row[col.key] }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>