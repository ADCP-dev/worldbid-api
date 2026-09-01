<script setup>
import Layout from './Layout.vue'
import { useConfig, usePlaintext } from '@maizzle/framework'

usePlaintext()

const { appName, appUrl, subject, title, greeting, bodyText, ownershipText, ctaText, link, ignoreText, lang } =
  useConfig()
</script>

<template>
  <Layout>
    <Html :lang="lang">
      <Head>
        <title>{{ subject }}</title>
      </Head>
      <Body class="bg-base-100">
        <Container class="bg-base-200 rounded-lg p-8 max-w-600px mx-auto">
          <div class="mb-8 text-center">
            <div class="inline-flex justify-center items-center mb-6 w-16 h-16 bg-primary rounded-full">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="w-8 h-8 text-primary-content"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <!-- globe with bid ping -->
                <path
                  d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 2a8 8 0 015.29 2H15a4 4 0 00-6 3.46V7h-2.6A8 8 0 0112 4zM4.26 9H9v2H4.26a8.06 8.06 0 000-2H4.26zm.01 4H9v2H5.08A7.9 7.9 0 014.27 13h-.01zM12 20a8 8 0 01-5.29-2H9v-3h6v3h2.29A8 8 0 0112 20zm5.74-7H15v-2h4.74a8.06 8.06 0 010 2h.01z"
                />
              </svg>
            </div>
            <Heading class="mb-3 text-3xl font-bold text-primary">{{ title }}</Heading>
          </div>

          <Text class="mb-8 text-base text-base-content/80">{{ greeting }}</Text>
          <Text class="mb-8 text-base text-base-content/80">{{ bodyText }}</Text>

          <div
            class="mb-8 rounded-lg border border-base-300 bg-base-300/60 px-6 py-4"
          >
            <Text class="m-0 text-sm uppercase tracking-wide text-base-content/60">
              Your bid
            </Text>
            <Text class="m-0 mt-1 text-2xl font-bold text-base-content">
              {{ ownershipText }}
            </Text>
          </div>

          <Text class="mb-8 text-base text-base-content/80">
            You own the spot until someone outbids you. If that happens, we'll
            email you right away.
          </Text>

          <div class="my-8 text-center">
            <Button :href="link" class="px-6 py-3 font-medium text-primary-content bg-primary rounded-lg">
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
  --color-base-100: #0b1220;
  --color-base-200: #111a2c;
  --color-base-300: #1b2740;
  --color-base-content: #e6edf6;
}
</style>