<script setup lang="ts">
import NumberFlow from "@number-flow/vue";
import { Activity, CreditCard, DollarSign, Users } from "lucide-vue-next";

const dataCard = ref({
  totalRevenue: 0,
  totalRevenueDesc: 0,
  subscriptions: 0,
  subscriptionsDesc: 0,
  sales: 0,
  salesDesc: 0,
  activeNow: 0,
  activeNowDesc: 0,
});

const dataRecentSales = [
  {
    name: "Olivia Martin",
    email: "olivia.martin@email.com",
    amount: 1999,
  },
  {
    name: "Jackson Lee",
    email: "jackson.lee@email.com",
    amount: 39,
  },
  {
    name: "Isabella Nguyen",
    email: "isabella.nguyen@email.com",
    amount: 299,
  },
  {
    name: "William Kim",
    email: "will@email.com",
    amount: 99,
  },
  {
    name: "Sofia Davis",
    email: "sofia.davis@email.com",
    amount: 39,
  },
];

onMounted(() => {
  dataCard.value = {
    totalRevenue: 45231.89,
    totalRevenueDesc: 20.1 / 100,
    subscriptions: 2350,
    subscriptionsDesc: 180.5 / 100,
    sales: 12234,
    salesDesc: 45 / 100,
    activeNow: 573,
    activeNowDesc: 201,
  };
});
</script>

<template>
  <div class="w-full flex flex-col gap-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 class="text-2xl font-bold tracking-tight">Dashboard</h2>
      <div class="flex items-center gap-2">
        <BaseDateRangePicker />
        <button class="btn btn-primary">Download</button>
      </div>
    </div>
    <main class="flex flex-1 flex-col gap-4 md:gap-8">
      <div class="grid gap-4 lg:grid-cols-4 md:grid-cols-2 md:gap-8">
        <DashboardCard
          title="Total Revenue"
          :icon="DollarSign"
          :value="dataCard.totalRevenue"
          :value-format="{
            style: 'currency',
            currency: 'USD',
            trailingZeroDisplay: 'stripIfInteger',
          }"
          :description-value="dataCard.totalRevenueDesc"
          description-prefix="+"
          :description-format="{ style: 'percent', minimumFractionDigits: 1 }"
          description-suffix="from last month"
        />

        <DashboardCard
          title="Subscriptions"
          :icon="Users"
          :value="dataCard.subscriptions"
          value-prefix="+"
          :description-value="dataCard.subscriptionsDesc"
          description-prefix="+"
          :description-format="{ style: 'percent', minimumFractionDigits: 1 }"
          description-suffix="from last month"
        />

        <DashboardCard
          title="Sales"
          :icon="CreditCard"
          :value="dataCard.sales"
          value-prefix="+"
          :description-value="dataCard.salesDesc"
          description-prefix="+"
          :description-format="{ style: 'percent', minimumFractionDigits: 1 }"
          description-suffix="from last month"
        />

        <DashboardCard
          title="Active Now"
          :icon="Activity"
          :value="dataCard.activeNow"
          value-prefix="+"
          :description-value="dataCard.activeNowDesc"
          description-prefix="+"
          description-suffix="since last hour"
        />
      </div>

      <div class="grid gap-4 lg:grid-cols-2 xl:grid-cols-3 md:gap-8">
        <div
          class="card bg-base-100 shadow-sm border border-base-300 xl:col-span-2"
        >
          <div class="card-body p-6">
            <h3 class="card-title text-lg font-semibold">Overview</h3>
            <div class="pl-2">
              <!-- <DashboardOverview /> -->
            </div>
          </div>
        </div>

        <div class="card bg-base-100 shadow-sm border border-base-300">
          <div class="card-body p-6 gap-8">
            <h3 class="card-title text-lg font-semibold">Recent Sales</h3>
            <div class="grid gap-8">
              <div
                v-for="recentSales in dataRecentSales"
                :key="recentSales.name"
                class="flex items-center gap-4"
              >
                <div class="avatar placeholder hidden sm:flex">
                  <div class="bg-neutral text-neutral-content w-9 rounded-full">
                    <span class="text-xs">{{
                      recentSales.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                    }}</span>
                  </div>
                </div>
                <div class="grid gap-1">
                  <p class="text-sm font-medium leading-none">
                    {{ recentSales.name }}
                  </p>
                  <p class="text-sm text-base-content/60">
                    {{ recentSales.email }}
                  </p>
                </div>
                <div class="ml-auto font-medium">
                  <NumberFlow
                    :value="recentSales.amount"
                    :format="{
                      style: 'currency',
                      currency: 'USD',
                      trailingZeroDisplay: 'stripIfInteger',
                    }"
                    prefix="+"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
