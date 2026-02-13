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
    icon: "shield",
    title: "Auth & Seguridad",
    description:
      "JWT, Google OAuth y sistema de roles (RBAC) con permisos granulares integrados en el core.",
  },
  {
    icon: "zap",
    title: "Stripe & Facturación",
    description:
      "Integración completa con Stripe para gestionar suscripciones, cobros y portal del cliente.",
  },
  {
    icon: "layers",
    title: "IA con LangChain",
    description:
      "Arquitectura preparada para agentes de IA que pueden interactuar con la base de datos de tu app.",
  },
  {
    icon: "database",
    title: "Redis & Postgres",
    description:
      "Pila tecnológica robusta con PostgreSQL para datos persistentes y Redis para colas y caché.",
  },
  {
    icon: "workflow",
    title: "CMS & Newsletter",
    description:
      "Sistema de blog profesional y gestión de newsletters listo para usar y atraer usuarios.",
  },
  {
    icon: "barChart3",
    title: "Dashboard Premium",
    description:
      "Interfaz de administración completa construida con Shadcn UI para el control total de tu plataforma.",
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
  database: Database,
  shield: Shield,
  workflow: Workflow,
  barChart3: BarChart3,
};
</script>

<template>
  <section id="features" class="container mx-auto py-24 sm:py-32" data-aos="fade-up">
    <div class="max-w-7xl mx-auto">
      <div class="text-center mb-8" data-aos="fade-up">
        <h2 class="text-lg text-primary mb-2 tracking-wider">
          Características Técnicas
        </h2>

        <h2 class="text-3xl md:text-4xl font-bold mb-4">
          Potencia tu Negocio con el Stack Definitivo
        </h2>

        <p class="max-w-2xl mx-auto text-xl text-muted-foreground">
          Una base sólida construida con las tecnologías más modernas para que
          puedas centrarte en las integraciones y funcionalidades que importan.
        </p>
      </div>

      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div v-for="{ icon, title, description }, index in featureList" :key="title" :data-aos="'fade-up'"
          :data-aos-delay="index * 100">
          <Card class="h-full bg-background border-0 shadow-none">
            <CardHeader class="flex justify-center items-center flex-col">
              <div class="bg-primary/20 p-2 rounded-full ring-8 ring-primary/10 mb-4">
                <component :is="iconMap[icon]" class="size-6 text-primary" />

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
