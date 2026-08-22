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
                <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd" />
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

          <div class="pt-4 mt-6 text-sm text-base-content/50 border-t border-base-300">
            <Text>{{ ignoreText }}</Text>
          </div>
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
