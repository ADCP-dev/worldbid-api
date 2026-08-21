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
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
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