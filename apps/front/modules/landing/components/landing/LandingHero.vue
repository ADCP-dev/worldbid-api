<script setup lang="ts">
import { ArrowRight, Zap, Code, Image } from "lucide-vue-next";
import { useColorMode } from "@vueuse/core";

const mode = useColorMode();
const localePath = useLocalePath();
</script>

<template>
  <section class="container mx-auto">
    <div class="grid place-items-center lg:max-w-screen-xl gap-8 mx-auto py-20 md:py-32">
      <div class="text-center space-y-8">
        <div class="flex justify-center">
          <AppLogo size-logo="md" size-text="lg" />
        </div>

        <div class="max-w-screen-lg mx-auto text-center text-5xl md:text-6xl font-bold">
          <h1>
            <span class="text-transparent bg-gradient-to-r to-secondary/90 from-primary bg-clip-text">
              {{ $t('landing.hero.title.prefix') }}
            </span>
            {{ $t('landing.hero.title.suffix') }}
          </h1>
        </div>

        <p class="max-w-screen-md mx-auto text-xl text-muted-foreground">
          {{ $t('landing.hero.description') }}
        </p>

        <div class="flex flex-col sm:flex-row gap-6 justify-center items-center">
          <NuxtLink :to="localePath('/login')" class="btn btn-primary btn-lg w-full sm:w-auto font-black px-10 shadow-2xl hover:scale-105 transition-transform active:scale-95 group/arrow">
            <Zap class="size-6 mr-1" />
            {{ $t('landing.hero.start') }}
            <ArrowRight class="size-6 ml-1 group-hover/arrow:translate-x-2 transition-transform" />
          </NuxtLink>

          <a href="#how-it-works" class="btn btn-outline btn-lg w-full sm:w-auto font-black px-10 hover:bg-base-200 hover:text-base-content border-2">
            <Code class="size-6 mr-1" />
            {{ $t('landing.hero.howItWorks') }}
          </a>
        </div>
      </div>

      <div class="relative group mt-14">
        <!-- gradient shadow -->
        <div
          class="absolute -top-6 right-12 w-[90%] h-12 lg:h-[80%] bg-primary/50 blur-3xl rounded-full img-shadow-animation" />

        <img class="w-full md:w-[1200px] mx-auto rounded-lg relative rouded-lg leading-none flex items-center" :src="mode == 'light' ? 'hero-image-dark.png' : 'hero-image-dark.png'
          " alt="dashboard using Foundation" />

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
