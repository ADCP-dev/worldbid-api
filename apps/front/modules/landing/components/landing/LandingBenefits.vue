<script setup lang="ts">
import {
  Sparkle,
  Code,
  FileSpreadsheet,
  Zap,
  Database,
  Shield,
  Plug,
  Hourglass,
  ChartLine,
  ClockFading,
  PanelsTopLeft,
  CalendarClock,
} from "lucide-vue-next";
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

interface BenefitsProps {
  icon: string;
  title: string;
  description: string;
}

const benefitList: BenefitsProps[] = [
  {
    icon: "hourGlass",
    title: "Acelera tu Desarrollo",
    description:
      "No pierdas meses configurando lo básico. Tienes Auth, DB y UI listos desde el primer día.",
  },
  {
    icon: "clockPlus",
    title: "Arquitectura Monorepo",
    description:
      "Backend (NestJS) y Frontend (Nuxt) en un solo lugar con tipos compartidos y máxima eficiencia.",
  },
  {
    icon: "chartLine",
    title: t('mod.landing.features.list.layers.title'),
    description:
      t('mod.landing.features.list.layers.description'),
  },
  {
    icon: "panel",
    title: "Portal de Administración",
    description:
      "Gestiona usuarios, roles y permisos desde un dashboard premium ya integrado.",
  },
  {
    icon: "calendar",
    title: "Pagos con Stripe",
    description:
      "Sistema de suscripciones y pagos listo para configurar tus claves y empezar a facturar.",
  },
  {
    icon: "api",
    title: "SEO y CMS Integrado",
    description:
      "Blog y Newsletter diseñados para posicionar tu marca y retener a tus usuarios desde el inicio.",
  },
];

const iconMap: Record<
  string,
  | typeof Plug
> = {
  hourGlass: Hourglass,
  clockPlus: ClockFading,
  chartLine: ChartLine,
  panel: PanelsTopLeft,
  calendar: CalendarClock,
  api: Plug,
};
</script>

<template>
  <section id="benefits" class="container mx-auto py-24 sm:py-32" data-aos="fade-up">
    <div class="max-w-7xl mx-auto">
      <div class="space-y-12">
        <div class="text-center space-y-8" data-aos="fade-up">
          <h2 class="text-2xl text-primary font-bold mb-8 tracking-wider">Beneficios</h2>

          <h2 class="text-3xl md:text-4xl max-w-5xl mx-auto font-bold">
            Construye apps complejas sin preocuparte por la infraestructura.
          </h2>
          <p class="text-xl text-muted-foreground max-w-3xl mx-auto">
            Foundation te ofrece todos los pilares necesarios para que te concentres
            en lo que hace única a tu idea de negocio.
          </p>
        </div>

        <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div
v-for="({ icon, title, description }, index) in benefitList" :key="title"
            class="card bg-muted/50 dark:bg-card hover:bg-base-100 transition-all delay-75 group/number border border-base-300 shadow-sm"
            :data-aos="'fade-up'" :data-aos-delay="index * 100">
            <div class="card-body">
              <div class="flex justify-between items-start">
                <component :is="iconMap[icon]" class="size-8 mb-6 text-primary" />

                <span
                  class="text-6xl text-base-content/10 font-black transition-all delay-75 group-hover/number:text-primary/20 leading-none">0{{
                    index + 1 }}</span>
              </div>

              <h3 class="card-title text-xl font-bold mb-2">{{ title }}</h3>

              <p class="text-base-content/60 leading-relaxed">
                {{ description }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
