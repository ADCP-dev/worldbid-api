<script setup lang="ts">


interface HowItWorksProps {
  step: number;
  title: string;
  description: string;
  image: string;
}

const HowItWorksList: HowItWorksProps[] = [
  {
    step: 1,
    title: "Clona la Estructura Base",
    description:
      "Descarga el monorepo con NuxtJS y NestJS ya vinculados. Todo el boilerplate de autenticación y base de datos está listo.",
    image: "/landing/howitworks/1.jpg",
  },
  {
    step: 2,
    title: "Configura tus Integraciones",
    description:
      "Añade tus credenciales de Google, Stripe y OpenAI. La arquitectura está diseñada para que solo tengas que conectar tus servicios.",
    image: "/landing/howitworks/2.jpg",
  },
  {
    step: 3,
    title: "Despliega y Escala",
    description:
      "Lanza tu plataforma al mercado en tiempo récord. Tienes blog, newsletter e IA listos para empezar a operar y crecer.",
    image: "/landing/howitworks/3.jpg",
  },
];
</script>

<template>
  <section id="how-it-works" class="container mx-auto py-24 sm:py-32" data-aos="fade-up">
    <div class="max-w-7xl mx-auto">
      <div class="text-center mb-12" data-aos="fade-up">
        <h2 class="text-2xl text-primary font-bold mb-8 tracking-wider">
          Cómo Iniciar
        </h2>

        <h2 class="text-3xl md:text-4xl font-bold">
          Lanza tu Aplicación en 3 Pasos
        </h2>
      </div>

      <div class="max-w-6xl mx-auto">
        <div
v-for="(
{ step, title, description, image }, index
          ) in HowItWorksList" :key="title" :class="[
            'flex flex-col md:flex-row gap-8 items-center mb-12 last:mb-0',
            { 'md:flex-row-reverse': index % 2 !== 0 },
          ]" :data-aos="'fade-up'" :data-aos-delay="index * 200">
          <div class="flex-1">
            <div class="p-6">
              <div class="pb-4">
                <div class="badge badge-outline badge-primary">Paso {{ step }}</div>
              </div>

              <h3 class="text-3xl font-black mb-4 tracking-tight">
                {{ title }}
              </h3>

              <p class="text-xl text-base-content/60 leading-relaxed">
                {{ description }}
              </p>
            </div>
          </div>

          <div class="flex-1">
            <div class="rounded-lg overflow-hidden border">
              <img :src="image" :alt="title" class="w-full h-96 object-cover rounded-lg" >
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
