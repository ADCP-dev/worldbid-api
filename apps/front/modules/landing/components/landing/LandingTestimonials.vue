<script setup lang="ts">
import { Star } from "lucide-vue-next";
import { ref } from "vue";

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

      <div class="relative max-w-6xl mx-auto">
        <div class="flex overflow-x-auto gap-6 pb-8 snap-x no-scrollbar">
          <div v-for="(review, index) in reviewList" :key="review.name"
            class="min-w-[300px] md:min-w-[350px] snap-start"
            :data-aos="'fade-up'" :data-aos-delay="index * 100">
            <div class="card bg-muted/50 dark:bg-card border border-base-300 shadow-sm h-full">
              <div class="card-body gap-4">
                <div class="flex gap-1">
                  <Star v-for="i in 5" :key="i" class="size-4 fill-primary text-primary" />
                </div>

                <p class="text-base-content/80 italic">"{{ review.comment }}"</p>

                <div class="flex items-center gap-4 mt-auto pt-4 border-t border-base-300">
                  <div class="avatar">
                    <div class="w-12 rounded-full border border-primary/20 bg-base-300">
                      <img :src="review.image" :alt="review.name" />
                    </div>
                  </div>

                  <div class="flex flex-col">
                    <span class="font-bold text-base">{{ review.name }}</span>
                    <span class="text-xs opacity-60">{{ review.userName }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
