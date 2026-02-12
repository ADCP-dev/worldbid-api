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
    name: "Alejandro Pérez",
    userName: "CTO de TechScale",
    comment:
      "Tener el monorepo con Nuxt y Nest ya configurado nos ahorró semanas de configuración inicial. La integración con Stripe funcionó a la primera.",
    rating: 5.0,
  },
  {
    image: "https://github.com/shadcn.png",
    name: "Marta Silva",
    userName: "Fundadora de SaaSFast",
    comment:
      "Logré lanzar mi MVP en solo 10 días. La autenticación con Google y el sistema de roles me permitieron centrarme en mi lógica de negocio.",
    rating: 5.0,
  },
  {
    image: "https://github.com/shadcn.png",
    name: "Javier Ruiz",
    userName: "Desarrollador Fullstack",
    comment:
      "La base de LangChain es genial. Pude crear un asistente de IA que consulta mi base de datos de Postgres en una tarde. Muy bien estructurado.",
    rating: 4.9,
  },
  {
    image: "https://github.com/shadcn.png",
    name: "Elena Gómez",
    userName: "Product Manager",
    comment:
      "El blog y la newsletter integrados nos ayudaron a captar nuestros primeros 100 usuarios en una semana. SEO optimizado desde el inicio.",
    rating: 5.0,
  },
  {
    image: "https://github.com/shadcn.png",
    name: "Roberto Díaz",
    userName: "Freelance",
    comment:
      "Es la mejor base de código que he usado. Uso Foundation para todos mis nuevos proyectos de clientes. Todo está donde debería estar.",
    rating: 5.0,
  },
  {
    image: "https://github.com/shadcn.png",
    name: "Sonia Marín",
    userName: "Emprendedora",
    comment:
      "No sabía por dónde empezar mi app y Foundation me dio el mapa completo. El soporte de la comunidad en Discord es excepcional.",
    rating: 5.0,
  },
];
</script>

<template>
  <section id="testimonials" class="container mx-auto py-24 sm:py-32" data-aos="fade-up">
    <div class="max-w-7xl mx-auto">
      <div class="text-center mb-12" data-aos="fade-up">
        <h2 class="text-2xl text-primary font-bold mb-8 tracking-wider">
          Testimonios
        </h2>

        <h2 class="text-3xl md:text-4xl font-bold">
          Confianza de nuestros clientes
        </h2>
      </div>

      <Carousel :opts="{
        align: 'start',
      }" class="relative max-w-6xl mx-auto overflow-hidden">
        <CarouselContent>
          <CarouselItem v-for="(review, index) in reviewList" :key="review.name" class="md:basis-1/2 lg:basis-1/3"
            :data-aos="'fade-up'" :data-aos-delay="index * 100">
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
                    <AvatarImage src="https://www.radix-vue.com/logo.svg" alt="@radix-vue" />
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
