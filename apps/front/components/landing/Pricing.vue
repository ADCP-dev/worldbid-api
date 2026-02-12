<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Check } from "lucide-vue-next";

import StripeService from "@/services/strie.service";

const stripe = new StripeService()

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
  // Static Spanish pricing plans
  plans.value = [
    {
      title: "Básico",
      popular: false,
      price: 39.99,
      description: "Ideal para empezar a automatizar tu atención al cliente.",
      buttonText: "Empieza tu prueba gratis",
      benefitList: [
        "1 canal integrado (WhatsApp, Instagram o Web)",
        "Hasta 500 mensajes/mes",
        "Panel de gestión intuitivo",
        "IA entrenada con FAQs básicas"
      ],
      currencySymbol: '€'
    },
    {
      title: "Profesional",
      popular: true,
      price: 79.99,
      description: "Para negocios que quieren ir un paso más allá.",
      buttonText: "Empieza tu prueba gratis",
      benefitList: [
        "Hasta 3 canales integrados (WhatsApp, Instagram, Web, otros)",
        "Hasta 2.000 mensajes/mes",
        "60 minutos de llamadas automatizadas/mes",
        "IA avanzada y personalizable",
        "Acceso a estadísticas y gestión de citas"
      ],
      currencySymbol: '€'
    },
    {
      title: "Empresarial",
      popular: false,
      price: 109,
      description: "Máximo rendimiento y automatización total.",
      buttonText: "Empieza tu prueba gratis",
      benefitList: [
        "Hasta 3 canales integrados + llamadas",
        "Mensajes ilimitados",
        "Llamadas automatizadas ilimitadas",
        "Soporte técnico avanzado incluido",
        "IA totalmente entrenable con tu contenido"
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
          Precios
        </h2>

        <h2 class="text-3xl md:text-4xl font-bold mb-4">
          Planes que se adaptan a tu negocio
        </h2>

        <p class="max-w-2xl mx-auto text-xl text-muted-foreground">
          Elige el plan perfecto para tu negocio. Prueba gratuita sin compromiso durante 5 días.
        </p>
      </div>

      <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        <div v-if="plans.length === 0" class="col-span-full text-center py-8">
          <p class="text-muted-foreground">Loading plans...</p>
        </div>
        <Card
v-for="{
          title,
          popular,
          price,
          description,
          buttonText,
          benefitList,
          interval,
          currencySymbol
        }, index in plans" v-else :key="title" :class="{
          'drop-shadow-xl shadow-black/10 dark:shadow-white/10 border-[1.5px] border-primary lg:scale-[1.1]':
            popular,
        }" :data-aos="'fade-up'" :data-aos-delay="index * 100">
          <CardHeader>
            <CardTitle class="pb-2">
              {{ title }}
            </CardTitle>

            <CardDescription class="pb-4">{{ description }}</CardDescription>

            <div>
              <span class="text-3xl font-bold">{{ currencySymbol }}{{ price }}</span>
              <span v-if="interval" class="text-muted-foreground"> /{{ interval }}</span>
              <span v-else class="text-muted-foreground"> /mes</span>
            </div>
          </CardHeader>

          <CardContent class="flex">
            <div class="space-y-4">
              <span v-for="benefit in benefitList" :key="benefit" class="flex">
                <Check class="text-primary mr-2" />
                <h3>{{ benefit }}</h3>
              </span>
            </div>
          </CardContent>

          <CardFooter>
            <Button :variant="popular ? 'default' : 'secondary'" class="w-full">
              {{ buttonText }}
            </Button>
          </CardFooter>
        </Card>
      </div>

      <!-- Custom Plan Contact Card -->
      <div class="mt-16">
        <Card class="max-w-7xl mx-auto border-2 border-primary/20 shadow-lg">
          <div class="p-8 md:p-10">
            <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-12">
              <div class="flex-1">
                <div class="flex items-center gap-3 mb-3">
                  <div class="h-2 w-8 bg-primary rounded-full"/>
                  <span class="text-sm font-semibold text-primary uppercase tracking-wide">Enterprise</span>
                </div>
                <CardTitle class="text-3xl font-bold mb-3 text-foreground">
                  Personalizado
                </CardTitle>
                <CardDescription class="text-lg text-muted-foreground mb-6">
                  Soluciones para grandes empresas y administraciones públicas. Integración con múltiples canales y sistemas, IA totalmente adaptada a tus procesos.
                </CardDescription>
                
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="flex items-start gap-3">
                  <div class="mt-1 bg-primary/10 rounded-full p-1.5">
                    <Check class="text-primary h-4 w-4" />
                  </div>
                  <div>
                    <div class="font-semibold text-sm">Integración múltiple</div>
                    <div class="text-xs text-muted-foreground">Canales y sistemas</div>
                  </div>
                </div>
                
                <div class="flex items-start gap-3">
                  <div class="mt-1 bg-primary/10 rounded-full p-1.5">
                    <Check class="text-primary h-4 w-4" />
                  </div>
                  <div>
                    <div class="font-semibold text-sm">IA personalizada</div>
                    <div class="text-xs text-muted-foreground">Adaptada a tus procesos</div>
                  </div>
                </div>
                
                <div class="flex items-start gap-3">
                  <div class="mt-1 bg-primary/10 rounded-full p-1.5">
                    <Check class="text-primary h-4 w-4" />
                  </div>
                  <div>
                    <div class="font-semibold text-sm">Soporte exclusivo</div>
                    <div class="text-xs text-muted-foreground">Asistencia prioritaria 24/7</div>
                  </div>
                </div>
                
                <div class="flex items-start gap-3">
                  <div class="mt-1 bg-primary/10 rounded-full p-1.5">
                    <Check class="text-primary h-4 w-4" />
                  </div>
                  <div>
                    <div class="font-semibold text-sm">Configuración avanzada</div>
                    <div class="text-xs text-muted-foreground">Para grandes organizaciones</div>
                  </div>
                </div>
              </div>
              
              <div class="flex flex-col items-center gap-4">
                <div class="text-center">
                  <div class="text-3xl font-bold text-foreground">Hablamos</div>
                  <div class="text-sm text-muted-foreground">Precio personalizado</div>
                </div>
                <Button size="lg" class="w-full sm:w-auto px-8 bg-primary hover:bg-primary/90 shadow-lg">
                  Contactar Ventas
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  </section>
</template>
