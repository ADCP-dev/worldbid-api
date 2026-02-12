<script setup lang="ts">
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Zap, Code, Image } from "lucide-vue-next";
import { useColorMode } from "@vueuse/core";
import Logo from "./components/Logo.vue";
const mode = useColorMode();

</script>

<template>
  <section class="container mx-auto">
    <div class="grid place-items-center lg:max-w-screen-xl gap-8 mx-auto py-20 md:py-32">
      <div class="text-center space-y-8">
        <div class="flex justify-center">
          <Logo size-logo="md" size-text="lg" />
        </div>

        <div class="max-w-screen-lg mx-auto text-center text-5xl md:text-6xl font-bold">
          <h1>
            <span class="text-transparent bg-gradient-to-r to-secondary/90 from-primary bg-clip-text">Atención al
              cliente 24/7
            </span>
            con IA que responde por ti
          </h1>
        </div>

        <p class="max-w-screen-md mx-auto text-xl text-muted-foreground">
          Atenfy lleva la atención al cliente a otro nivel. Asistentes virtuales que aprenden de tu negocio, se
          adaptan y ofrecen soporte excepcional en cualquier canal.
        </p>

        <div class="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Button class="w-full sm:w-auto font-bold group/arrow px-8 py-5 text-md">
            <Zap class="size-6 mr-2" />
            Empieza gratis ahora
            <ArrowRight class="size-6 ml-2 group-hover/arrow:translate-x-1 transition-transform" />
          </Button>

          <Button as-child variant="outline" class="w-full sm:w-auto font-bold px-8 py-5 text-md">
            <a href="#how-it-works">
              <Code class="size-6 mr-2" />
              Ver Cómo Funciona
            </a>
          </Button>
        </div>
      </div>

      <div class="relative group mt-14">
        <!-- gradient shadow -->
        <div
          class="absolute -top-6 right-12 w-[90%] h-12 lg:h-[80%] bg-primary/50 blur-3xl rounded-full img-shadow-animation" />

        <img class="w-full md:w-[1200px] mx-auto rounded-lg relative rouded-lg leading-none flex items-center" :src="mode == 'light' ? 'hero-image-dark.png' : 'hero-image-dark.png'
          " alt="dashboard using shadcn-vue">

        <!-- gradient effect img -->
        <div
          class="absolute bottom-0 left-0 w-full h-20 md:h-28 bg-gradient-to-b from-background/0 via-background/50 to-background rounded-lg" />
      </div>
    </div>
  </section>
</template>

<style>
.img-shadow-animation {
  animation-name: img-shadow-animation;
  animation-iteration-count: infinite;
  animation-duration: 3s;
  animation-timing-function: ease-in-out;
  animation-direction: alternate;
}

@keyframes img-shadow-animation {
  from {
    opacity: 0.5;
    transform: translateY(30px);
  }

  to {
    opacity: 1;
    transform: translateY(0px);
  }
}
</style>
