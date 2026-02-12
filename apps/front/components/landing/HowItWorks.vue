<script setup lang="ts">
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import hljs from 'highlight.js/lib/core';
import json from 'highlight.js/lib/languages/json';
import '@catppuccin/highlightjs/css/catppuccin-mocha.css';

hljs.registerLanguage('json', json);

interface HowItWorksProps {
  step: number;
  title: string;
  description: string;
  image: string;
}

const HowItWorksList: HowItWorksProps[] = [
  {
    step: 1,
    title: "Configura y Entrena tu Agente",
    description:
      "Cuéntale a tu IA sobre tu negocio, productos y servicios. Define su tono y personalidad para que hable como tú.",
    image: "/landing/howitworks/1.jpg",
  },
  {
    step: 2,
    title: "Conecta los Canales",
    description:
      "Integra tu agente en web, WhatsApp, Instagram y sistema de llamadas. Configuración simple con un solo clic.",
    image: "/landing/howitworks/2.jpg",
  },
  {
    step: 3,
    title: "Prueba y Lanza",
    description:
      "Testea tu asistente antes de publicarlo: revisa cómo responde, ajusta lo que necesites y, cuando estés listo, lánzalo en minutos.",
    image: "/landing/howitworks/3.jpg",
  },
];
</script>

<template>
  <section id="how-it-works" class="container mx-auto py-24 sm:py-32" data-aos="fade-up">
    <div class="max-w-7xl mx-auto">
      <div class="text-center mb-12" data-aos="fade-up">
        <h2 class="text-2xl text-primary font-bold mb-8 tracking-wider">
          Cómo Funciona
        </h2>

        <h2 class="text-3xl md:text-4xl font-bold">
          Construye tu Agente IA en 3 Pasos
        </h2>
      </div>

      <div class="max-w-6xl mx-auto">
        <div v-for="(
{ step, title, description, image }, index
          ) in HowItWorksList" :key="title" :class="[
            'flex flex-col md:flex-row gap-8 items-center mb-12 last:mb-0',
            { 'md:flex-row-reverse': index % 2 !== 0 },
          ]" :data-aos="'fade-up'" :data-aos-delay="index * 200">
          <div class="flex-1">
            <Card class="h-full bg-transparent border-0 shadow-none">
              <CardHeader>
                <div class="pb-4">
                  <Badge variant="outline">Paso {{ step }}</Badge>
                </div>

                <CardTitle class="text-2xl font-bold">
                  {{ title }}
                </CardTitle>
              </CardHeader>

              <CardContent class="text-muted-foreground">
                {{ description }}
              </CardContent>
            </Card>
          </div>

          <div class="flex-1">
            <div class="rounded-lg overflow-hidden border">
              <img :src="image" :alt="title" class="w-full h-96 object-cover rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
