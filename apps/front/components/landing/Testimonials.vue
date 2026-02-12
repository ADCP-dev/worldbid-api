<script setup lang="ts">
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

import { Star } from "lucide-vue-next";

interface ReviewProps {
  image: string;
  name: string;
  userName: string;
  comment: string;
  rating: number;
}

const reviewList: ReviewProps[] = [
  {
    image: "https://github.com/shadcn.png",
    name: "María González",
    userName: "Directora de Marketing",
    comment:
      "Nuestro bot de WhatsApp ahora maneja el 100% de las consultas de clientes automáticamente. Pasamos de 50 tickets diarios a solo 10. El ROI ha sido increíble.",
    rating: 5.0,
  },
  {
    image: "https://github.com/shadcn.png",
    name: "Carlos Rodríguez",
    userName: "Propietario E-commerce",
    comment:
      "Construí un bot asistente de compras en 2 horas que aumentó nuestra tasa de conversión en 35%. Los clientes aman recibir recomendaciones instantáneas vía WhatsApp.",
    rating: 5.0,
  },
  {
    image: "https://github.com/shadcn.png",
    name: "Ana Martínez",
    userName: "Fundadora Startup",
    comment:
      "Nuestro bot de generación de leads califica prospectos 24/7 y agenda llamadas automáticamente. Hemos duplicado nuestros leads calificados sin contratar más vendedores.",
    rating: 4.9,
  },
  {
    image: "https://github.com/shadcn.png",
    name: "David López",
    userName: "CEO SaaS",
    comment:
      "El constructor visual es increíblemente intuitivo. Creé un bot de onboarding que redujo nuestros tickets de soporte en 60% el primer mes.",
    rating: 5.0,
  },
  {
    image: "https://github.com/shadcn.png",
    name: "Laura Fernández",
    userName: "Agente Inmobiliaria",
    comment:
      "Mi bot de consultas inmobiliarias precalifica compradores y agenda visitas vía WhatsApp. Es como tener un asistente virtual trabajando 24/7.",
    rating: 5.0,
  },
  {
    image: "https://github.com/shadcn.png",
    name: "Alejandro Torres",
    userName: "Propietario Agencia",
    comment:
      "Construí bots para 10 clientes en una semana. La opción white-label nos permite ofrecer servicios de chatbot bajo nuestra marca. Plataforma revolucionaria.",
    rating: 5.0,
  },
];
</script>

<template>
  <section
    id="testimonials"
    class="container mx-auto py-24 sm:py-32"
    data-aos="fade-up"
  >
    <div class="max-w-7xl mx-auto">
      <div class="text-center mb-12" data-aos="fade-up">
        <h2 class="text-2xl text-primary font-bold mb-8 tracking-wider">
          Testimonios
        </h2>

        <h2 class="text-3xl md:text-4xl font-bold">
          Confianza de nuestros clientes
        </h2>
      </div>

      <Carousel
        :opts="{
          align: 'start',
        }"
        class="relative max-w-6xl mx-auto overflow-hidden"
      >
      <CarouselContent>
        <CarouselItem
          v-for="(review, index) in reviewList"
          :key="review.name"
          class="md:basis-1/2 lg:basis-1/3"
          :data-aos="'fade-up'"
          :data-aos-delay="index * 100">
          <Card class="bg-muted/50 dark:bg-card">
            <CardContent class="pt-6 pb-0">
              <div class="flex gap-1 pb-6">
                <Star class="size-4 fill-primary text-primary" />
                <Star class="size-4 fill-primary text-primary" />
                <Star class="size-4 fill-primary text-primary" />
                <Star class="size-4 fill-primary text-primary" />
                <Star class="size-4 fill-primary text-primary" />
              </div>

              "{{ review.comment }}"
            </CardContent>

            <CardHeader>
              <div class="flex flex-row items-center gap-4">
                <Avatar>
                  <AvatarImage
                    src="https://www.radix-vue.com/logo.svg"
                    alt="@radix-vue"
                  />
                  <AvatarFallback>SV</AvatarFallback>
                </Avatar>

                <div class="flex flex-col">
                  <CardTitle class="text-lg">{{ review.name }}</CardTitle>
                  <CardDescription>{{ review.userName }}</CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        </CarouselItem>
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
    </div>
  </section>
</template>
