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
      <Body class="bg-base-100">
        <Container class="bg-base-200 rounded-lg p-8 max-w-600px mx-auto">
          <div class="mb-8 text-center">
            <div class="inline-flex justify-center items-center mb-6 w-16 h-16 bg-primary rounded-full">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-primary-content" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
              </svg>
            </div>
            <Heading class="mb-3 text-3xl font-bold text-primary">{{ title }}</Heading>
          </div>

          <Text class="mb-8 text-base text-base-content/80">{{ greeting }}</Text>
          <Text class="mb-8 text-base text-base-content/80">{{ bodyText }}</Text>

          <div class="my-8 text-center">
            <Button :href="link" class="px-6 py-3 font-medium text-primary-content bg-primary rounded-lg">
              {{ buttonText }}
            </Button>
          </div>

          <Text v-if="ignoreText" class="text-sm text-base-content/50">{{ ignoreText }}</Text>
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
