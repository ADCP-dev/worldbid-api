<script setup>
import Layout from '@emails/Layout.vue'
import { useConfig, usePlaintext } from '@maizzle/framework'

usePlaintext()

const {
  appName,
  appUrl,
  subject,
  partnerName,
  greeting,
  bodyText,
  link,
  buttonText,
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
          <Text class="text-base-content/80">{{ greeting }}</Text>
          <Text class="text-base-content/80">{{ bodyText }}</Text>
          <div v-if="link" class="my-8 text-center">
            <Button :href="link" class="px-6 py-3 font-medium text-primary-content bg-primary rounded-lg">
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
  --color-primary: #F97316;
  --color-primary-content: #0A0A0A;
  --color-base-100: #161616;
  --color-base-200: #1e1e1e;
  --color-base-300: #262626;
  --color-base-content: #F5F5F5;
}
</style>
