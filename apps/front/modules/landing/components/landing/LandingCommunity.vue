<script setup lang="ts">
import { MessagesSquare } from "lucide-vue-next";
</script>

<template>
  <section id="community" class="py-12">
    <hr />
    <div class="container mx-auto py-20 sm:py-20">
      <div class="max-w-2xl mx-auto">
        <div class="bg-background text-center flex flex-col items-center justify-center">
          <div class="mb-6">
            <h2 class="text-4xl md:text-5xl font-bold">
              <Component class="w-20 h-20 mx-auto mb-4" :is="MessagesSquare" />
              ¿Listo para unirte a
              <span class="text-transparent bg-gradient-to-r from-secondary to-primary bg-clip-text">
                Foundation?
              </span>
            </h2>
          </div>
          <div class="text-xl text-muted-foreground mb-8 max-w-lg">
            ¡Únete a nuestra comunidad de desarrolladores y emprendedores! Comparte
            tus integraciones, obtén soporte y ayúdanos a construir la base definitiva. 🚀
          </div>

          <a href="https://discord.gg/foundation" target="_blank"
            class="btn btn-primary btn-lg shadow-xl hover:scale-105 transition-transform active:scale-95 group">
            <MessagesSquare class="w-5 h-5 mr-1 group-hover:animate-bounce" />
            Únete a Discord
          </a>
        </div>
      </div>
    </div>
    <hr />
  </section>
</template>
