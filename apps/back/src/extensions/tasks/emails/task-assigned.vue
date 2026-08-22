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
      <Body class="bg-base-100">
        <Container class="bg-base-200 rounded-lg p-8 max-w-600px mx-auto">
          <Heading class="text-2xl font-bold text-primary">{{ subject }}</Heading>
          <Text class="text-base-content/80">Te han asignado una nueva tarea:</Text>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px; border: 1px solid #262626; font-weight: bold; color: #F5F5F5;">Titulo</td>
              <td style="padding: 8px; border: 1px solid #262626; color: #F5F5F5;">{{ entity.title }}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #262626; font-weight: bold; color: #F5F5F5;">Prioridad</td>
              <td style="padding: 8px; border: 1px solid #262626; color: #F5F5F5;">{{ entity.priority }}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #262626; font-weight: bold; color: #F5F5F5;">Estado</td>
              <td style="padding: 8px; border: 1px solid #262626; color: #F5F5F5;">{{ entity.status }}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #262626; font-weight: bold; color: #F5F5F5;">Fecha limite</td>
              <td style="padding: 8px; border: 1px solid #262626; color: #F5F5F5;">{{ entity.dueDate }}</td>
            </tr>
          </table>
          <Text>
            <Button :href="`${appUrl}/app/tasks/${entity.id}`" class="inline-block px-5 py-2 bg-primary text-primary-content rounded">
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
  --color-primary: #F97316;
  --color-primary-content: #0A0A0A;
  --color-base-100: #161616;
  --color-base-200: #1e1e1e;
  --color-base-300: #262626;
  --color-base-content: #F5F5F5;
}
</style>
