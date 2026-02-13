<script setup lang="ts">
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface FAQProps {
  question: string;
  answer: string;
  value: string;
}

const FAQList: FAQProps[] = [
  {
    question: "¿Qué tecnologías utiliza Foundation?",
    answer:
      "Foundation utiliza un monorepo premium con NuxtJS 4 para el frontend y NestJS para el backend. La persistencia se maneja con PostgreSQL y Redis, y la capa de IA está construida sobre LangChain.",
    value: "item-1",
  },
  {
    question: "¿Incluye sistema de autenticación?",
    answer:
      "Sí, viene con un sistema completo de autenticación JWT y roles (RBAC). También incluye integración nativa con Google OAuth para un registro rápido de usuarios.",
    value: "item-2",
  },
  {
    question: "¿Cómo funciona la integración con Stripe?",
    answer:
      "La integración con Stripe está preconfigurada para manejar suscripciones mensuales y anuales, junto con un portal de facturación donde los usuarios pueden gestionar sus métodos de pago.",
    value: "item-3",
  },
  {
    question: "¿Puedo personalizar la IA con mis propios datos?",
    answer:
      "Por supuesto. Gracias a LangChain y la estructura de base de datos preparada, puedes implementar RAG (Retrieval-Augmented Generation) para que tu asistente de IA responda basándose en la información de tu app.",
    value: "item-4",
  },
  {
    question: "¿Es escalable para una aplicación de gran tamaño?",
    answer:
      "Absolutamente. La arquitectura monorepo y el uso de NestJS permiten una separación clara de responsabilidades, facilitando el escalado horizontal y el crecimiento de tu negocio.",
    value: "item-5",
  },
];
</script>

<template>
  <section id="faq" class="container mx-auto py-24 sm:py-32" data-aos="fade-up">
    <div class="max-w-3xl mx-auto">
      <div class="text-center mb-12" data-aos="fade-up">
        <h2 class="text-2xl text-primary font-bold mb-8 tracking-wider">Preguntas frecuentes</h2>

        <h2 class="text-3xl md:text-4xl font-bold">
          Preguntas frecuentes sobre Foundation
        </h2>
      </div>

      <Accordion type="single" collapsible class="AccordionRoot">
        <AccordionItem v-for="{ question, answer, value }, index in FAQList" :key="value" :value="value"
          :data-aos="'fade-up'" :data-aos-delay="index * 100">
          <AccordionTrigger class="text-left text-lg">{{ question }} </AccordionTrigger>

          <AccordionContent class="text-sm text-muted-foreground">{{ answer }}</AccordionContent>
        </AccordionItem>
      </Accordion>

      <h3 class="font-medium mt-4 text-center">
        ¿Aún tienes preguntas?
        <span class="text-muted-foreground">
          <a href="#contact" class="underline">Contáctanos</a>
        </span>
      </h3>
    </div>
  </section>
</template>
