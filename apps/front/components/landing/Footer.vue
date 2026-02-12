<script setup lang="ts">
import { BotMessageSquare } from "lucide-vue-next";
import Separator from "@/components/ui/separator/Separator.vue";
import Logo from "./components/Logo.vue";

const config = useRuntimeConfig();
</script>

<template>
  <footer id="footer" class="container mx-auto py-24 pb-16 sm:py-32 sm:pb-24" data-aos="fade-up">
    <div class="max-w-7xl mx-auto p-10 bg-muted/50 dark:bg-card border rounded-2xl">
      <div class="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-x-12 gap-y-8">
        <div class="col-span-full xl:col-span-2" data-aos="fade-right">
          <Logo />
        </div>

        <div class="flex flex-col gap-2" data-aos="fade-up" data-aos-delay="100">
          <h3 class="font-bold text-lg">Contacto</h3>
          <div>
            <a href="#" class="opacity-60 hover:opacity-100">
              Github
            </a>
          </div>

          <div>
            <a href="#" class="opacity-60 hover:opacity-100">
              Twitter
            </a>
          </div>

          <div>
            <a href="#" class="opacity-60 hover:opacity-100">
              Instagram
            </a>
          </div>
        </div>

        <div class="flex flex-col gap-2" data-aos="fade-up" data-aos-delay="200">
          <h3 class="font-bold text-lg">Tecnologías</h3>
          <div>
            <a href="#" class="opacity-60 hover:opacity-100">
              NuxtJS & NestJS
            </a>
          </div>

          <div>
            <a href="#" class="opacity-60 hover:opacity-100">
              Postgres & Redis
            </a>
          </div>

          <div>
            <a href="#" class="opacity-60 hover:opacity-100">
              LangChain & AI
            </a>
          </div>
        </div>

        <div class="flex flex-col gap-2" data-aos="fade-up" data-aos-delay="300">
          <h3 class="font-bold text-lg">Recursos</h3>
          <div>
            <a href="#features" class="opacity-60 hover:opacity-100">
              Características
            </a>
          </div>

          <div>
            <a href="#faq" class="opacity-60 hover:opacity-100">
              Preguntas Frecuentes
            </a>
          </div>

          <div>
            <a href="https://discord.gg/foundation" class="opacity-60 hover:opacity-100">
              Comunidad
            </a>
          </div>
        </div>

        <div class="flex flex-col gap-2" data-aos="fade-up" data-aos-delay="400">
          <h3 class="font-bold text-lg">Legal</h3>
          <div>
            <NuxtLink href="/terms-of-service" class="opacity-60 hover:opacity-100">
              Términos de Servicio
            </NuxtLink>
          </div>

          <div>
            <NuxtLink href="/private-policy" class="opacity-60 hover:opacity-100">
              Política de Privacidad
            </NuxtLink>
          </div>

          <div>
            <a href="#" class="opacity-60 hover:opacity-100">
              GDPR
            </a>
          </div>
        </div>
      </div>

      <Separator class="my-6" />
      <section className="">
        <div class="flex flex-col md:flex-row justify-between items-center gap-4">
          <h3 class="text-center md:text-left">
            &copy; {{ new Date().getFullYear() }} {{ config.public.appName }}
          </h3>
          <div class="flex flex-col md:flex-row items-center gap-4 text-sm text-muted-foreground">
            <span class="font-semibold text-primary">La base definitiva para tu negocio</span>
            <span>•</span>
            <span>Monorepo Premium</span>
            <span>•</span>
            <span>Seguro y Escalable</span>
          </div>
        </div>
      </section>
    </div>
  </footer>
</template>
