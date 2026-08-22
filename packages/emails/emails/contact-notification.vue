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
  logoUrl,
  replyUrl,
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
      <Body class="bg-base-100 font-sans">
        <Container class="bg-base-100 max-w-600px mx-auto p-0">
          <Img
            v-if="logoUrl"
            :src="logoUrl"
            alt="Foundation"
            class="w-32 h-auto my-6 mx-auto"
          />
          <Heading class="text-2xl font-bold text-primary px-6 pt-4">
            {{ subject }}
          </Heading>
          <Container class="bg-base-200 rounded-lg p-6 my-4 mx-6">
            <Text class="text-base-content font-semibold mb-2">
              {{ lang === 'en' ? 'Name' : 'Nombre' }}
            </Text>
            <Text class="text-base-content/70 mb-4">{{ name }}</Text>
            <Text class="text-base-content font-semibold mb-2">Email</Text>
            <Link :href="`mailto:${email}`" class="text-primary mb-4 block">
              {{ email }}
            </Link>
            <Text class="text-base-content font-semibold mb-2">
              {{ lang === 'en' ? 'Message' : 'Mensaje' }}
            </Text>
            <Text class="text-base-content/70 whitespace-pre-line">
              {{ message }}
            </Text>
          </Container>
          <Container class="px-6 pb-6">
            <Button
              :href="replyUrl"
              class="bg-primary text-primary-content rounded-lg px-6 py-3 no-underline"
            >
              {{ lang === 'en' ? 'Reply' : 'Responder' }}
            </Button>
          </Container>
          <Hr class="border-base-300 my-6 mx-6" />
          <Text class="text-base-content/50 text-xs text-center px-6 pb-6">
            © {{ new Date().getFullYear() }} {{ appName }}. {{
              lang === 'en' ? 'All rights reserved.' : 'Todos los derechos reservados.'
            }}
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
