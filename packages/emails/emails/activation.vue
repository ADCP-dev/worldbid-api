<script setup>
import Layout from './Layout.vue'
import { useConfig, usePlaintext } from '@maizzle/framework'

usePlaintext()

const {
  appName,
  appUrl,
  subject,
  title,
  greeting,
  bodyText,
  buttonText,
  link,
  ignoreText,
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
          <div class="mb-8 text-center">
            <div class="inline-flex justify-center items-center mb-6 w-16 h-16 bg-primary-100 rounded-full">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-primary-600" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
              </svg>
            </div>
            <Heading class="mb-3 text-3xl font-bold text-gray-800">{{ title }}</Heading>
          </div>

          <Text class="mb-8 text-base text-gray-600">{{ greeting }}</Text>
          <Text class="mb-8 text-base text-gray-600">{{ bodyText }}</Text>

          <div class="my-8 text-center">
            <Button :href="link" class="px-6 py-3 font-medium text-white bg-primary-600 rounded-lg shadow-md">
              {{ buttonText }}
            </Button>
          </div>

          <Text v-if="ignoreText" class="text-sm text-gray-400">{{ ignoreText }}</Text>
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