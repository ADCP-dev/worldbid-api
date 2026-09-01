<script setup>
import Layout from './Layout.vue'
import { useConfig, usePlaintext } from '@maizzle/framework'

usePlaintext()

const { subject, title, greeting, bodyText, ownershipText, ctaText, link, ignoreText } =
  useConfig()
</script>

<template>
  <Layout>
    <Html lang="en">
      <Head>
        <title>{{ subject }}</title>
      </Head>
      <Body class="bg-base-100">
        <Container class="bg-base-200 rounded-lg p-8 max-w-600px mx-auto">
          <div class="mb-8 text-center">
            <div class="inline-flex justify-center items-center mb-6 w-16 h-16 bg-accent rounded-full">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="w-8 h-8 text-white"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <!-- lightning bolt: outbid notice -->
                <path d="M13 2L4.09 12.97a1 1 0 00.77 1.64H11l-1.5 6.4a.5.5 0 00.88.42L20.9 10.4a1 1 0 00-.77-1.64H13l1-6.34a.5.5 0 00-.9-.42z" />
              </svg>
            </div>
            <Heading class="mb-3 text-3xl font-bold text-accent">{{ title }}</Heading>
          </div>

          <Text class="mb-8 text-base text-base-content/80">{{ greeting }}</Text>
          <Text class="mb-8 text-base text-base-content/80">{{ bodyText }}</Text>

          <div class="mb-8 rounded-lg border border-base-300 bg-base-300/60 px-6 py-4">
            <Text class="m-0 text-sm uppercase tracking-wide text-base-content/60">
              What changed
            </Text>
            <Text class="m-0 mt-1 text-2xl font-bold text-base-content">
              {{ ownershipText }}
            </Text>
          </div>

          <Text class="mb-8 text-base text-base-content/80">
            Want it back? Place a higher bid — every increment raises the bar.
          </Text>

          <div class="my-8 text-center">
            <Button :href="link" class="px-6 py-3 font-medium text-white bg-accent rounded-lg">
              {{ ctaText }}
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
  --color-primary: #3b82f6;
  --color-primary-content: #ffffff;
  --color-accent: #ef4444;
  --color-base-100: #0b1220;
  --color-base-200: #111a2c;
  --color-base-300: #1b2740;
  --color-base-content: #e6edf6;
}
</style>