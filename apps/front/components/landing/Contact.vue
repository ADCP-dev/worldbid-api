<script setup lang="ts">
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
              ¿Busca algo más? Hablamos de tu caso
            </h2>
            <p class="text-muted-foreground max-w-lg">
              ¿Tienes preguntas sobre nuestros asistentes virtuales? Estamos aquí para ayudarte. Contacta con nuestro equipo para soporte, alianzas o soluciones personalizadas.
            </p>
          </div>

          <div class="flex flex-col gap-4">
            <div>
              <div class="flex gap-2">
                <Mail />
                <div class="font-bold">Escríbenos</div>
              </div>
              <div>soporte@atenfy.com</div>
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
        <Card class="bg-muted/60 dark:bg-card" data-aos="fade-left">
          <CardHeader class="text-primary text-2xl"/>
          <CardContent>
            <form
              class="grid gap-4"
              @submit.prevent="handleSubmit"
            >
              <div class="flex flex-col md:flex-row gap-8">
                <div class="flex flex-col w-full gap-1.5">
                  <Label for="first-name">Nombre</Label>
                  <Input
                    id="first-name"
                    v-model="contactForm.firstName"
                    type="text"
                    placeholder="Juan"
                  />
                </div>

                <div class="flex flex-col w-full gap-1.5">
                  <Label for="last-name">Apellidos</Label>
                  <Input
                    id="last-name"
                    v-model="contactForm.lastName"
                    type="text"
                    placeholder="García"
                  />
                </div>
              </div>

              <div class="flex flex-col gap-1.5">
                <Label for="email">Correo Electrónico</Label>
                <Input
                  id="email"
                  v-model="contactForm.email"
                  type="email"
                  placeholder="juan@empresa.com"
                />
              </div>

              <div class="flex flex-col gap-1.5">
                <Label for="subject">Asunto</Label>

                <Select v-model="contactForm.subject">
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un asunto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="Consulta General">
                        Consulta General
                      </SelectItem>
                      <SelectItem value="Soporte Técnico">
                        Soporte Técnico
                      </SelectItem>
                      <SelectItem value="Plan Empresarial"> Plan Empresarial </SelectItem>
                      <SelectItem value="Integración Personalizada"> Integración Personalizada </SelectItem>
                      <SelectItem value="Alianzas">
                        Alianzas
                      </SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <div class="flex flex-col gap-1.5">
                <Label for="message">Mensaje</Label>
                <Textarea
                  id="message"
                  v-model="contactForm.message"
                  placeholder="Cuéntanos sobre tu proyecto..."
                  rows="5"
                />
              </div>

              <Alert
                v-if="invalidInputForm"
                variant="destructive"
              >
                <AlertCircle class="w-4 h-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  Hay un error en el formulario. Por favor, revisa los campos.
                </AlertDescription>
              </Alert>

              <Button class="mt-4">Enviar mensaje</Button>
            </form>
          </CardContent>

          <CardFooter/>
        </Card>
      </section>
    </div>
  </section>
</template>
