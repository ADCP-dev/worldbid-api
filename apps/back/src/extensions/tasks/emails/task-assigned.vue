<script setup>
import Layout from '@emails/Layout.vue'
import { useConfig, usePlaintext } from '@maizzle/framework'

usePlaintext()

const {
  appName,
  appUrl,
  subject,
  title,
  entity,
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
      <Body class="bg-slate-50">
        <Container class="bg-white rounded-lg shadow-sm p-8 max-w-600px mx-auto">
          <Heading class="text-2xl font-bold text-gray-800">{{ subject }}</Heading>
          <Text class="text-slate-700">Te han asignado una nueva tarea:</Text>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Titulo</td>
              <td style="padding: 8px; border: 1px solid #e5e7eb;">{{ entity.title }}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Prioridad</td>
              <td style="padding: 8px; border: 1px solid #e5e7eb;">{{ entity.priority }}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Estado</td>
              <td style="padding: 8px; border: 1px solid #e5e7eb;">{{ entity.status }}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Fecha limite</td>
              <td style="padding: 8px; border: 1px solid #e5e7eb;">{{ entity.dueDate }}</td>
            </tr>
          </table>
          <Text>
            <Button :href="`${appUrl}/app/tasks/${entity.id}`" class="inline-block px-5 py-2 bg-blue-500 text-white rounded">
              Ver tarea
            </Button>
          </Text>
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