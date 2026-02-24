<script setup lang="ts">
import { AlertCircle, Mail, MapPin, Phone, Clock } from "lucide-vue-next";
import { ref } from "vue";

const contactForm = ref({
  firstName: "",
  lastName: "",
  email: "",
  subject: "",
  message: "",
});

const invalidInputForm = ref(false);

const handleSubmit = () => {
  if (
    !contactForm.value.firstName ||
    !contactForm.value.lastName ||
    !contactForm.value.email ||
    !contactForm.value.subject ||
    !contactForm.value.message
  ) {
    invalidInputForm.value = true;
    return;
  }

  invalidInputForm.value = false;
  const subject = encodeURIComponent(contactForm.value.subject);
  const body = encodeURIComponent(
    `Name: ${contactForm.value.firstName} ${contactForm.value.lastName}\nEmail: ${contactForm.value.email}\n\nMessage: ${contactForm.value.message}`
  );
  const mailtoLink = `mailto:leomirandadev@gmail.com?subject=${subject}&body=${body}`;
  window.location.href = mailtoLink;

  // Reset form
  contactForm.value = {
    firstName: "",
    lastName: "",
    email: "",
    subject: "",
    message: "",
  };
};
</script>

<template>
  <section id="contact" class="container mx-auto py-24 sm:py-32 overflow-hidden" data-aos="fade-up">
    <div class="max-w-7xl mx-auto">
      <section class="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div class="flex flex-col gap-8" data-aos="fade-right">
          <div>
            <h2 class="text-3xl md:text-4xl font-bold mb-4">
              ¿Listo para dar el siguiente paso?
            </h2>
            <p class="text-muted-foreground max-w-lg">
              ¿Tienes preguntas sobre la arquitectura de Foundation o necesitas una solución personalizada? Nuestro
              equipo está listo para ayudarte con soporte técnico, alianzas o consultoría.
            </p>
          </div>

          <div class="flex flex-col gap-4">
            <div>
              <div class="flex gap-2">
                <Mail />
                <div class="font-bold">Escríbenos</div>
              </div>
              <div>hola@foundation-app.com</div>
            </div>

            <!-- <div>
              <div class="flex gap-2">
                <MapPin />
                <div class="font-bold">Address</div>
              </div>
              <div>Caracas, Venezuela</div>
            </div>

            <div>
              <div class="flex gap-2">
                <Phone />
                <div class="font-bold">Phone</div>
              </div>
              <div>+58 412 123 4567</div>
            </div>

            <div>
              <div class="flex gap-2">
                <Clock />
                <div class="font-bold">Visit Us</div>
              </div>
              <div>
                <div>Monday - Friday</div>
                <div>8AM - 4PM</div>
              </div>
            </div> -->
          </div>
        </div>

        <!-- form -->
        <div class="card bg-muted/60 dark:bg-card border border-base-300 shadow-xl" data-aos="fade-left">
          <div class="card-body">
            <h2 class="card-title text-primary text-2xl mb-4 text-center justify-center">Escríbenos</h2>
            <form class="grid gap-6" @submit.prevent="handleSubmit">
              <div class="flex flex-col md:flex-row gap-6">
                <div class="form-control w-full">
                  <label class="label" for="first-name">
                    <span class="label-text font-semibold">Nombre</span>
                  </label>
                  <input id="first-name" v-model="contactForm.firstName" type="text" placeholder="Juan" class="input input-bordered w-full" />
                </div>

                <div class="form-control w-full">
                  <label class="label" for="last-name">
                    <span class="label-text font-semibold">Apellidos</span>
                  </label>
                  <input id="last-name" v-model="contactForm.lastName" type="text" placeholder="García" class="input input-bordered w-full" />
                </div>
              </div>

              <div class="form-control w-full">
                <label class="label" for="email">
                  <span class="label-text font-semibold">Correo Electrónico</span>
                </label>
                <input id="email" v-model="contactForm.email" type="email" placeholder="juan@empresa.com" class="input input-bordered w-full" />
              </div>

              <div class="form-control w-full">
                <label class="label" for="subject">
                  <span class="label-text font-semibold">Asunto</span>
                </label>
                <select v-model="contactForm.subject" class="select select-bordered w-full">
                  <option disabled selected value="">Selecciona un asunto</option>
                  <option value="Consulta General">Consulta General</option>
                  <option value="Soporte Técnico">Soporte Técnico</option>
                  <option value="Plan Empresarial">Plan Empresarial</option>
                  <option value="Integración Personalizada">Integración Personalizada</option>
                  <option value="Alianzas">Alianzas</option>
                </select>
              </div>

              <div class="form-control w-full flex flex-col">
                <label class="label" for="message">
                  <span class="label-text font-semibold">Mensaje</span>
                </label>
                <textarea id="message" v-model="contactForm.message" placeholder="Cuéntanos sobre tu proyecto..."
                  class="textarea textarea-bordered w-full h-32" />
              </div>

              <div v-if="invalidInputForm" class="alert alert-error shadow-lg">
                <div class="flex items-center gap-2">
                  <AlertCircle class="w-6 h-6" />
                  <div>
                    <h3 class="font-bold">Error</h3>
                    <div class="text-xs text-error-content/80">Hay un error en el formulario. Por favor, revisa los campos.</div>
                  </div>
                </div>
              </div>

              <div class="card-actions mt-4">
                <button class="btn btn-primary btn-block text-lg font-bold shadow-lg">Enviar mensaje</button>
              </div>
            </form>
          </div>
        </div>
      </section>
    </div>
  </section>
</template>
