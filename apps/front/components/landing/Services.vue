<script setup lang="ts">

import { Badge } from "@/components/ui/badge";
import {
  Globe,
  Instagram,
  MessageCircle,
  Phone,
  Calendar,
  ShoppingCart,
  Headphones
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
    title: "Agenda y Ventas",
    description: "Automatiza la programación de citas y procesos de venta con bots que califican leads y cierran ventas.",
    tier: 0,
    icon: "calendar",
  },
  {
    title: "Atención al Cliente",
    description: "Agentes IA especializados que resuelven consultas, procesan reclamos y escalan casos complejos.",
    tier: 0,
    icon: "headphones",
  },
  {
    title: "Llamadas Automatizadas",
    description: "Sistema de llamadas con IA que agenda citas, confirma reservas y brinda atención telefónica automatizada.",
    tier: 1,
    icon: "phone",
  },
  {
    title: "Chatbot Web",
    description:
      "Asistentes virtuales para tu sitio web que atienden visitantes, generan ventas y brindan atención al cliente 24/7.",
    tier: 0,
    icon: "globe",
  },
  {
    title: "Instagram",
    description:
      "Automatiza respuestas en Instagram, gestiona consultas de productos y agenda citas directamente desde DMs.",
    tier: 0,
    icon: "instagram",
  },
  {
    title: "WhatsApp",
    description:
      "Bots inteligentes para WhatsApp que procesan pedidos, agendan citas y brindan soporte al cliente.",
    tier: 0,
    icon: "messageCircle",
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
};
</script>

<template>
  <section id="services" class="container mx-auto py-24 sm:py-32" data-aos="fade-up">
    <div class="max-w-7xl mx-auto">
      <div class="text-center mb-8" data-aos="fade-up">
        <h2 class="text-2xl text-primary font-bold mb-8 tracking-wider">
          Servicios
        </h2>

        <h2 class="text-3xl md:text-4xl font-bold mb-4">
          Conversaciones inteligentes que venden por ti.
        </h2>
        <p class="max-w-2xl mx-auto text-xl text-muted-foreground">
          Desde tu web hasta WhatsApp e Instagram, nuestros agentes IA atienden,
          venden y resuelven 24/7 para que tu negocio no se detenga nunca.

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
