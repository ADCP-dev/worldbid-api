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
      <Body class="bg-slate-50">
        <Container class="bg-white rounded-lg shadow-sm p-8 max-w-600px mx-auto">
          <Heading class="text-2xl font-bold text-gray-800">{{ subject }}</Heading>
          <Text class="text-slate-700">{{ greeting }}</Text>
          <Text class="text-slate-700">{{ bodyText }}</Text>
          <div v-if="link" class="my-8 text-center">
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