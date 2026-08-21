<script setup>
import Layout from '@emails/Layout.vue'
import { useConfig, usePlaintext } from '@maizzle/framework'

usePlaintext()

const {
  appName,
  appUrl,
  subject,
  greeting,
  name,
  email,
  message,
  lang,
} = useConfig()
</script>

<template>
  <Layout>
    <Html :lang="lang">
      <Head>
        <meta charset="utf-8" />
        <title>{{ subject }}</title>
      </Head>
      <Body class="bg-indigo-50">
        <Container class="bg-white rounded-lg shadow-sm p-8 max-w-600px mx-auto">
          <div class="text-center bg-indigo-600 text-white p-6 rounded-t-lg">
            <Heading class="text-2xl font-bold text-white">{{ subject }}</Heading>
          </div>
          <div class="p-8 text-gray-700">
            <Text>{{ greeting }}</Text>
            <div class="mb-4">
              <Text class="font-bold text-gray-500 text-sm uppercase tracking-wide">{{ lang === 'en' ? 'Name' : 'Nombre' }}</Text>
              <Text class="text-gray-900">{{ name }}</Text>
            </div>
            <div class="mb-4">
              <Text class="font-bold text-gray-500 text-sm uppercase tracking-wide">Email</Text>
              <Text><a :href="`mailto:${email}`" class="text-blue-600">{{ email }}</a></Text>
            </div>
            <div class="mb-4">
              <Text class="font-bold text-gray-500 text-sm uppercase tracking-wide">{{ lang === 'en' ? 'Message' : 'Mensaje' }}</Text>
              <div class="mt-1 p-4 bg-gray-100 rounded whitespace-pre-wrap break-words">
                <Text>{{ message }}</Text>
              </div>
            </div>
          </div>
          <div class="border-t border-gray-200 p-4 text-center text-gray-400 text-xs">
            <Text>{{ lang === 'en' ? 'Sent from the contact form of' : 'Enviado desde el formulario de contacto de' }} {{ appName }}</Text>
          </div>
        </Container>
      </Body>
    </Html>
  </Layout>
</template>

<style>
@import '@maizzle/tailwindcss';

@theme {
  --color-primary: #2563eb;
}
</style>