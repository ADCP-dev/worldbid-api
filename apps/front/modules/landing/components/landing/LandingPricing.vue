<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { Check } from "lucide-vue-next";

const { t } = useI18n();

interface PlanProps {
  title: string;
  popular: boolean;
  price: number;
  description: string;
  buttonText: string;
  benefitList: string[];
  interval?: string;
  currencySymbol?: string;
}

const plans = ref<PlanProps[]>([]);

const currencySymbols: { [key: string]: string } = {
  eur: '€',
  usd: '$',
  gbp: '£',
  jpy: '¥',
};

const loadPlans = async () => {
  // Static Spanish pricing plans for Foundation
  plans.value = [
    {
      title: "landing.pricing.plans.developer.title",
      popular: false,
      price: 0,
      description: "landing.pricing.plans.developer.description",
      buttonText: "landing.pricing.plans.developer.button",
      benefitList: [
        "landing.pricing.plans.developer.benefits[0]",
        "landing.pricing.plans.developer.benefits[1]",
        "landing.pricing.plans.developer.benefits[2]",
        "landing.pricing.plans.developer.benefits[3]",
      ],
      currencySymbol: '€'
    },
    {
      title: "landing.pricing.plans.startup.title",
      popular: true,
      price: 49.99,
      description: "landing.pricing.plans.startup.description",
      buttonText: "landing.pricing.plans.startup.button",
      benefitList: [
        "landing.pricing.plans.startup.benefits[0]",
        "landing.pricing.plans.startup.benefits[1]",
        "landing.pricing.plans.startup.benefits[2]",
        "landing.pricing.plans.startup.benefits[3]",
        "landing.pricing.plans.startup.benefits[4]",
      ],
      currencySymbol: '€'
    },
    {
      title: "landing.pricing.plans.enterprise.title",
      popular: false,
      price: 199,
      description: "landing.pricing.plans.enterprise.description",
      buttonText: "landing.pricing.plans.enterprise.button",
      benefitList: [
        "landing.pricing.plans.enterprise.benefits[0]",
        "landing.pricing.plans.enterprise.benefits[1]",
        "landing.pricing.plans.enterprise.benefits[2]",
        "landing.pricing.plans.enterprise.benefits[3]",
        "landing.pricing.plans.enterprise.benefits[4]",
      ],
      currencySymbol: '€'
    }
  ];
};

onMounted(() => {
  loadPlans();
});
</script>

<template>
  <section id="plans" class="container mx-auto py-24 sm:py-32" data-aos="fade-up">
    <div class="max-w-7xl mx-auto">
      <div class="text-center mb-12" data-aos="fade-up">
        <h2 class="text-2xl text-primary font-bold mb-8 tracking-wider">
          {{ $t('landing.pricing.title.badge') }}
        </h2>

        <h2 class="text-3xl md:text-4xl font-bold mb-4">
          {{ $t('landing.pricing.title.main') }}
        </h2>

        <p class="max-w-2xl mx-auto text-xl text-muted-foreground">
          {{ $t('landing.pricing.title.description') }}
        </p>
      </div>

      <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        <div v-if="plans.length === 0" class="col-span-full text-center py-8">
          <p class="text-base-content/60">{{ $t('landing.pricing.loading') }}</p>
        </div>
        <div
v-for="{
          title,
          popular,
          price,
          description,
          buttonText,
          benefitList,
          interval,
          currencySymbol
        }, index in plans" v-else :key="title"
          class="card bg-base-100 border border-base-300 shadow-xl transition-all duration-300"
          :class="{
            'ring-2 ring-primary scale-105 z-10': popular,
          }"
          :data-aos="'fade-up'" :data-aos-delay="index * 100">

          <div class="card-body">
            <div v-if="popular" class="badge badge-primary absolute top-4 right-4 animate-pulse">POPULAR</div>
            <h2 class="card-title text-2xl font-bold">
              {{ $t(title) }}
            </h2>

            <p class="text-base-content/60 flex-grow">{{ $t(description) }}</p>

            <div class="my-4">
              <span class="text-4xl font-extrabold">{{ currencySymbol }}{{ price }}</span>
              <span class="text-base-content/60 ml-1">
                {{ interval ? `/${interval}` : $t('landing.pricing.month') }}
              </span>
            </div>

            <div class="divider my-2"/>

            <ul class="space-y-3 mb-6">
              <li v-for="benefit in benefitList" :key="benefit" class="flex items-start gap-3">
                <Check class="text-primary h-5 w-5 shrink-0" />
                <span class="text-sm">{{ $t(benefit) }}</span>
              </li>
            </ul>

            <div class="card-actions mt-auto">
              <button class="btn w-full" :class="popular ? 'btn-primary' : 'btn-outline'">
                {{ $t(buttonText) }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Custom Plan Contact Card -->
      <div class="mt-20">
        <div class="card bg-primary text-primary-content shadow-2xl overflow-hidden relative border-none">
          <!-- Decorative patterns can be added here if needed -->
          <div class="card-body p-8 md:p-12 relative z-10">
            <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-12">
              <div class="flex-1">
                <div class="badge badge-secondary mb-4 font-bold tracking-wider uppercase">
                  {{ $t('landing.pricing.custom.badge') }}
                </div>
                <h2 class="text-4xl font-black mb-4 tracking-tight">
                  {{ $t('landing.pricing.custom.title') }}
                </h2>
                <p class="text-xl opacity-90 leading-relaxed max-w-2xl">
                  {{ $t('landing.pricing.custom.description') }}
                </p>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-10">
                  <div
v-for="feature in [
                    { title: 'landing.pricing.custom.features.integration.title', desc: 'landing.pricing.custom.features.integration.description' },
                    { title: 'landing.pricing.custom.features.ai.title', desc: 'landing.pricing.custom.features.ai.description' },
                    { title: 'landing.pricing.custom.features.support.title', desc: 'landing.pricing.custom.features.support.description' },
                    { title: 'landing.pricing.custom.features.config.title', desc: 'landing.pricing.custom.features.config.description' }
                  ]" :key="feature.title" class="flex items-start gap-3">
                    <div class="bg-primary-content/20 rounded-lg p-1">
                      <Check class="h-4 w-4" />
                    </div>
                    <div>
                      <div class="font-bold text-lg leading-none mb-1">{{ $t(feature.title) }}</div>
                      <div class="text-sm opacity-80">{{ $t(feature.desc) }}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="flex flex-col items-center lg:items-end gap-6 lg:min-w-[300px]">
                <div class="text-center lg:text-right">
                  <div class="text-4xl font-black mb-2">{{ $t('landing.pricing.custom.contact.title') }}</div>
                  <div class="text-lg opacity-90">{{ $t('landing.pricing.custom.contact.description') }}</div>
                </div>
                <button class="btn btn-secondary btn-lg px-12 text-lg shadow-xl hover:scale-105 transition-transform active:scale-95 border-none">
                  {{ $t('landing.pricing.custom.contact.button') }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
