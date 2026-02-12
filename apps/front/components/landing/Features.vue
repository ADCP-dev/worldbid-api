<script setup lang="ts">
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import {
  Code,
  Zap,
  Layers,
  Globe,
  Database,
  Shield,
  Workflow,
  BarChart3,
} from "lucide-vue-next";

interface FeaturesProps {
  icon: string;
  title: string;
  description: string;
}

const featureList: FeaturesProps[] = [
  {
    icon: "code",
    title: "Constructor Visual",
    description:
      "Interfaz de arrastrar y soltar para crear flujos conversacionales complejos sin conocimientos de programación.",
  },
  {
    icon: "zap",
    title: "Integración WhatsApp",
    description:
      "Conecta perfectamente tus chatbots con WhatsApp Business API para comunicación instantánea con clientes.",
  },
  {
    icon: "layers",
    title: "Entrenamiento IA",
    description:
      "Entrena tus agentes con datos personalizados, FAQs y bases de conocimiento para respuestas precisas y contextuales.",
  },
  {
    icon: "database",
    title: "Gestión de Leads",
    description:
      "Captura, califica y gestiona prospectos automáticamente a través de flujos conversacionales inteligentes.",
  },
  {
    icon: "workflow",
    title: "Soporte Multicanal",
    description:
      "Despliega tus agentes en chat web, WhatsApp, Instagram y otras plataformas de mensajería.",
  },
  {
    icon: "barChart3",
    title: "Analíticas Conversacionales",
    description:
      "Rastrea tasas de engagement, métricas de conversión y satisfacción del cliente con analíticas detalladas.",
  },
];

const iconMap: Record<
  string,
  | typeof Code
  | typeof Zap
  | typeof Layers
  | typeof Globe
  | typeof Database
  | typeof Shield
  | typeof Workflow
  | typeof BarChart3
> = {
  code: Code,
  zap: Zap,
  layers: Layers,
  globe: Globe,
  workflow: Workflow,
  barChart3: BarChart3,
};
</script>

<template>
  <section
    id="features"
    class="container mx-auto py-24 sm:py-32"
    data-aos="fade-up"
  >
    <div class="max-w-7xl mx-auto">
      <div class="text-center mb-8" data-aos="fade-up">
        <h2 class="text-lg text-primary mb-2 tracking-wider">
          Características de la Plataforma
        </h2>

        <h2 class="text-3xl md:text-4xl font-bold mb-4">
          Todo lo que Necesitas para Crear Agentes IA
        </h2>

        <p class="max-w-2xl mx-auto text-xl text-muted-foreground">
          Plataforma completa para construir, entrenar y desplegar chatbots inteligentes 
          y automatización de WhatsApp. Desde bots simples de Q&A hasta agentes complejos de atención al cliente.
        </p>
      </div>

      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <div
        v-for="{ icon, title, description }, index in featureList"
        :key="title"
        :data-aos="'fade-up'"
        :data-aos-delay="index * 100">
        <Card class="h-full bg-background border-0 shadow-none">
          <CardHeader class="flex justify-center items-center flex-col">
            <div
              class="bg-primary/20 p-2 rounded-full ring-8 ring-primary/10 mb-4"
            >
              <component
                :is="iconMap[icon]"
                class="size-6 text-primary"
              />
              
            </div>
            <CardTitle>
              {{ title }}
            </CardTitle>
          </CardHeader>

          <CardContent class="text-muted-foreground text-center">
            {{ description }}
          </CardContent>
        </Card>
      </div>
    </div>
    </div>
  </section>
</template>

<style lang="less" scoped></style>
