<script setup>
import Layout from '@emails/Layout.vue'
import { useConfig, usePlaintext } from '@maizzle/framework'

usePlaintext()

const {
  appName,
  appUrl,
  subject,
  count,
  staleTasks,
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
          <Text class="text-slate-700">
            Hay <strong>{{ count }}</strong> tareas que llevan mas de 24 horas en estado "pending":
          </Text>
          <ul>
            <li v-for="task in staleTasks" :key="task.id">
              {{ task.title }} — creada: {{ task.createdAt }}
            </li>
          </ul>
          <Text>
            <Button :href="`${appUrl}/app/tasks`" class="inline-block px-5 py-2 bg-blue-500 text-white rounded">
              Ver todas las tareas
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