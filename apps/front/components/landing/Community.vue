<script setup lang="ts">
import { Button } from "@/components/ui/button";
import DiscordIcon from "@/components/icons/DiscordIcon.vue";
</script>

<template>
  <section
    id="community"
    class="py-12"
  >
    <hr />
    <div class="container mx-auto py-20 sm:py-20">
      <div class="max-w-2xl mx-auto">
        <div class="bg-background text-center flex flex-col items-center justify-center">
          <div class="mb-6">
            <h2 class="text-4xl md:text-5xl font-bold">
              <Component
                class="w-20 h-20 mx-auto mb-4"
                :is="DiscordIcon"
              />
              ¿Listo para unirte a esta
              <span
                class="text-transparent bg-gradient-to-r from-secondary to-primary bg-clip-text"
              >
                Comunidad?
              </span>
            </h2>
          </div>
          <div class="text-xl text-muted-foreground mb-8 max-w-lg">
            ¡Únete a nuestra vibrante comunidad de Discord! Conecta, comparte y crece con
            entusiastas afines. ¡Haz clic para sumergirte! 🚀
          </div>

          <Button as-child>
            <a
              href="https://discord.com/"
              target="_blank"
            >
              Únete a Discord
            </a>
          </Button>
        </div>
      </div>
    </div>
    <hr />
  </section>
</template>
