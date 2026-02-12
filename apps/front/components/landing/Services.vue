<script setup lang="ts">

import { Badge } from "@/components/ui/badge";
import {
  Globe,
  Instagram,
  MessageCircle,
  Phone,
  Calendar,
  ShoppingCart,
  Headphones,
  Shield,
  BotMessageSquare,
  Layers
} from "lucide-vue-next";

enum ServiceTier {
  FREE = 0,
  PRO = 1,
}

interface ServiceProps {
  title: string;
  tier: ServiceTier;
  description: string;
  icon: string;
}

const serviceList: ServiceProps[] = [
  {
    title: "Seguridad y RBAC",
    description: "Gestión de roles y permisos granulares ya configurada para que tu app sea segura desde el primer despliegue.",
    tier: 0,
    icon: "shield",
  },
  {
    title: "Pagos con Stripe",
    description: "Sistema de facturación recurrente y portal de cliente listo para monetizar tu plataforma rápidamente.",
    tier: 0,
    icon: "shoppingCart",
  },
  {
    title: "IA Adaptada a tu App",
    description: "Aprovecha LangChain para crear asistentes que consultan tus datos y automatizan flujos complejos.",
    tier: 1,
    icon: "bot",
  },
  {
    title: "Blog y Marketing",
    description:
      "Herramientas de SEO, blog de alto rendimiento y sistema de newsletter integrados para hacer crecer tu audiencia.",
    tier: 0,
    icon: "globe",
  },
  {
    title: "API de Alto Nivel",
    description:
      "Backend en NestJS con arquitectura de microservicios opcional, listo para integrarse con cualquier frontend.",
    tier: 0,
    icon: "layers",
  },
  {
    title: "Google Auth & Social",
    description:
      "Inicio de sesión social preconfigurado para ofrecer la mejor experiencia de usuario desde el registro.",
    tier: 0,
    icon: "instagram",
  },
];

const iconMap: Record<string, any> = {
  globe: Globe,
  instagram: Instagram,
  messageCircle: MessageCircle,
  phone: Phone,
  calendar: Calendar,
  shoppingCart: ShoppingCart,
  headphones: Headphones,
  shield: Shield,
  bot: BotMessageSquare,
  layers: Layers,
};
</script>

<template>
  <section id="services" class="container mx-auto py-24 sm:py-32" data-aos="fade-up">
    <div class="max-w-7xl mx-auto">
      <div class="text-center mb-8" data-aos="fade-up">
        <h2 class="text-2xl text-primary font-bold mb-8 tracking-wider">
          Pilares del Proyecto
        </h2>

        <h2 class="text-3xl md:text-4xl font-bold mb-4">
          Infraestructura lista para tus integraciones.
        </h2>
        <p class="max-w-2xl mx-auto text-xl text-muted-foreground">
          Foundation no es solo una plantilla, es una arquitectura completa
          diseñada para soportar todas las integraciones que tu negocio necesite.
        </p>
      </div>

      <div class="space-y-16 max-w-6xl mx-auto">
        <div v-for="({ title, description, tier, icon }, index) in serviceList" :key="title" :class="[
          'flex flex-col lg:flex-row items-center gap-8 lg:gap-24 my-32',
          index % 2 === 1 ? 'lg:flex-row-reverse' : ''
        ]" :data-aos="'fade-up'" :data-aos-delay="index * 100">
          <!-- Icon Section -->
          <div class="flex-shrink-0 relative">
            <div class="relative">
              <div
                class="w-32 h-32 lg:w-40 lg:h-40 bg-gradient-to-br from-primary/20 to-primary/5 rounded-3xl flex items-center justify-center group hover:scale-105 transition-all duration-300">
                <component :is="iconMap[icon]"
                  class="h-16 w-16 lg:h-20 lg:w-20 text-primary group-hover:scale-110 transition-transform duration-300" />
              </div>
              <Badge v-if="tier === ServiceTier.PRO" variant="secondary" class="absolute -top-2 -right-2 z-10">
                PRO
              </Badge>
              <!-- Decorative elements -->
              <div class="absolute -top-4 -left-4 w-8 h-8 bg-primary/10 rounded-full animate-pulse"></div>
              <div class="absolute -bottom-2 -right-2 w-6 h-6 bg-primary/20 rounded-full animate-pulse delay-300"></div>
            </div>
          </div>

          <!-- Content Section -->
          <div class="flex-1 text-center lg:text-left space-y-4">
            <div class="space-y-2">
              <h3 class="text-2xl lg:text-3xl font-bold text-foreground group-hover:text-primary transition-colors">
                {{ title }}
              </h3>
              <div class="w-16 h-1 bg-gradient-to-r from-primary to-primary/50 mx-auto lg:mx-0 rounded-full"></div>
            </div>
            <p class="text-lg lg:text-xl text-muted-foreground leading-relaxed max-w-2xl">
              {{ description }}
            </p>
            <div class="flex items-center justify-center lg:justify-start gap-2 pt-2">
              <div class="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
              <div class="w-2 h-2 bg-primary/70 rounded-full animate-bounce delay-100"></div>
              <div class="w-2 h-2 bg-primary/40 rounded-full animate-bounce delay-200"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
