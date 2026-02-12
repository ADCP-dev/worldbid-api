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
    question: "¿Cómo creo un chatbot?",
    answer: "Muy fácil. Solo tienes que rellenar un cuestionario paso a paso y en 5 minutos tendrás tu propio asistente funcionando, sin saber nada de programación.",
    value: "item-1",
  },
  {
    question: "¿Puedo conectar con WhatsApp Business?",
    answer:
      "Sí. Nuestra plataforma se integra directamente con WhatsApp Business, además de Instagram, Web y llamadas telefónicas.",
    value: "item-2",
  },
  {
    question:
      "¿Qué plataformas de mensajería son compatibles?",
    answer:
      "Actualmente: WhatsApp, Instagram, tu propia web y sistema de llamadas. Estamos ampliando constantemente para que siempre tengas más opciones.",
    value: "item-3",
  },
  {
    question: "¿Necesito habilidades técnicas?",
    answer: "No. Atenfy está pensado para que cualquier persona pueda crear y entrenar su asistente sin programar nada.",
    value: "item-4",
  },
  {
    question:
      "¿Cómo funciona el entrenamiento de IA?",
    answer: "Tú tienes el control total. Puedes añadir preguntas, respuestas, información de productos o servicios, y la IA aprende y se adapta a tus cambios en tiempo real",
    value: "item-5",
  },
  {
    question:
      "¿Hay periodo de prueba gratuito?",
    answer: "Sí, puedes probar Atenfy gratis durante 5 días sin compromiso.",
    value: "item-6",
  },
  {
    question:
      "¿Qué pasa si supero el límite de mensajes de mi plan?",
    answer: "No te preocupes: puedes ampliar o cambiar de plan en cualquier momento, sin perder tus datos ni tu configuración.",
    value: "item-7",
  },
  {
    question:
      "¿Qué tipo de soporte ofrecen?",
    answer: "Según tu plan, tienes desde ayuda básica hasta soporte prioritario 24/7 en el plan empresarial. Siempre estamos contigo para que tu asistente funcione sin problemas.",
    value: "item-8",
  },
];
</script>

<template>
  <section
    id="faq"
    class="container mx-auto py-24 sm:py-32"
    data-aos="fade-up"
  >
    <div class="max-w-3xl mx-auto">
      <div class="text-center mb-12" data-aos="fade-up">
        <h2 class="text-2xl text-primary font-bold mb-8 tracking-wider">Preguntas frequentes</h2>

        <h2 class="text-3xl md:text-4xl font-bold">
          Preguntas frecuentes sobre Atenfy
        </h2>
      </div>

      <Accordion
        type="single"
        collapsible
        class="AccordionRoot"
      >
        <AccordionItem
          v-for="{ question, answer, value }, index in FAQList"
          :key="value"
          :value="value"
          :data-aos="'fade-up'"
          :data-aos-delay="index * 100">
         <AccordionTrigger class="text-left text-lg">{{ question }} </AccordionTrigger>

          <AccordionContent class="text-sm text-muted-foreground">{{ answer }}</AccordionContent>
        </AccordionItem>
      </Accordion>

      <h3 class="font-medium mt-4 text-center">
        ¿Aún tienes preguntas?
        <span class="text-muted-foreground">
          <a
            href="#contact"
            class="underline"
          >Contáctanos</a>
        </span>
      </h3>
    </div>
  </section>
</template>
