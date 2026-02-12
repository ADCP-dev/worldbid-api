<script setup lang="ts">
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
    title: "IA con LangChain",
    description:
      "Integra modelos de lenguaje con tus propios datos fácilmente gracias a la estructura preconfigurada.",
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
          <Card v-for="({ icon, title, description }, index) in benefitList" :key="title"
            class="bg-muted/50 dark:bg-card hover:bg-background dark:hover:bg-background transition-all delay-75 group/number"
            :data-aos="'fade-up'" :data-aos-delay="index * 100">
            <CardHeader>
              <div class="flex justify-between">
                <component class="size-8 mb-6 text-primary" :is="iconMap[icon]" />

                <span
                  class="text-5xl text-muted-foreground/15 font-medium transition-all delay-75 group-hover/number:text-muted-foreground/30">0{{
                    index + 1 }}</span>
              </div>

              <CardTitle class="text-xl font-bold">{{ title }}</CardTitle>
            </CardHeader>

            <CardContent class="text-muted-foreground">
              {{ description }}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  </section>
</template>
