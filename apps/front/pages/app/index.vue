<script setup lang="ts">
definePageMeta({
  layout: 'default',
  middleware: ['auth', 'admin'],
});

interface DashboardLink {
  id: string;
  title: string;
  description: string;
  icon: string;
  link: string;
  color: string;
}

const extensionDashboards = useState<DashboardLink[]>('app:dashboards', () => []);
const localePath = useLocalePath();

const icons: Record<string, any> = {
  Users: null,
  TrendingUp: null,
  FileText: null,
  Calendar: null,
  CreditCard: null,
};

// Try to import icons — if available
try {
  const { Users, TrendingUp, FileText, Calendar, CreditCard } = await import('lucide-vue-next');
  icons.Users = Users;
  icons.TrendingUp = TrendingUp;
  icons.FileText = FileText;
  icons.Calendar = Calendar;
  icons.CreditCard = CreditCard;
} catch {
  // Icons not available — use text fallback
}
</script>

<template>
  <div class="w-full flex flex-col gap-6">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 class="text-2xl font-bold tracking-tight">Dashboard</h2>
    </div>

    <div v-if="extensionDashboards.length === 0" class="text-center py-12">
      <p class="text-base-content/60">No hay dashboards de extensiones instalados.</p>
    </div>

    <div v-else class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      <NuxtLink
        v-for="dash in extensionDashboards"
        :key="dash.id"
        :to="localePath(dash.link)"
        class="card bg-base-100 shadow-sm border hover:shadow-md hover:border-primary/30 transition-all"
      >
        <div class="card-body">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg flex items-center justify-center" :class="`bg-${dash.color}/10`">
              <component :is="icons[dash.icon]" v-if="icons[dash.icon]" :class="`w-5 h-5 text-${dash.color}`" />
              <span v-else class="text-xl">📊</span>
            </div>
            <h3 class="card-title text-lg">{{ dash.title }}</h3>
          </div>
          <p class="text-sm text-base-content/60 mt-1">{{ dash.description }}</p>
          <div class="card-actions mt-3">
            <span class="text-sm text-primary font-medium">Ver dashboard →</span>
          </div>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>