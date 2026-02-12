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
    title: "Ahorra tiempo y dinero",
    description:
      "Más clientes atendidos, menos esfuerzo para tu equipo, menos esperas.",
  },
  {
    icon: "clockPlus",
    title: "Atención 24/7 en todos tus canales",
    description:
      "WhatsApp, Instagram, web y llamadas — sin esfuerzo.",
  },
  {
    icon: "chartLine",
    title: "Escalabilidad.",
    description:
      "Con asistentes inteligentes atiendes más, mejor y sin complicaciones.",
  },
  {
    icon: "panel",
    title: "Todo desde un solo portal",
    description:
      "Monitoriza tu negocio y datos fácilmente.",
  },
  {
    icon: "calendar",
    title: "Reservas automatizadas",
    description:
      "Tus clientes agendan y gestionan citas al instante.",
  },
  {
    icon: "api",
    title: "Personalización sin límites",
    description:
      "Adapta la IA a tu negocio: modifica entrenamientos, añade funciones y crea tus propios flujos.",
  },
];

const iconMap: Record<
  string,
  | typeof Plug
> = {
  zap: Zap,
  database: Database,
  hourGlass: Hourglass,
  chartLine: ChartLine,
  clockPlus: ClockFading,
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
            Tus clientes quieren respuestas rápidas, y tu negocio también.
          </h2>
          <p class="text-xl text-muted-foreground max-w-3xl mx-auto">
            Activa tu IA hoy y empieza a ahorrar tiempo y dinero con asistentes que
            trabajan 24/7 para ti.
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
