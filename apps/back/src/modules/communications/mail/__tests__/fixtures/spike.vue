---
<template>
  <Html>
    <Head>
      <title>{{ subject }}</title>
    </Head>
    <Body class="bg-slate-50">
      <Container class="bg-white rounded-lg shadow-sm p-8 max-w-600px mx-auto">
        <Heading class="text-2xl font-bold text-slate-900">{{ title }}</Heading>
        <Text class="text-slate-700">{{ greeting }}</Text>
        <Text class="text-slate-700">{{ bodyText }}</Text>
        <Button :href="link" class="bg-primary text-white rounded px-6 py-3">
          {{ buttonText }}
        </Button>
      </Container>
    </Body>
  </Html>
</template>

<script setup>
import { useConfig, usePlaintext } from '@maizzle/framework'

usePlaintext()

const { subject, title, greeting, bodyText, buttonText, link } = useConfig()
</script>

<style>
@import '@maizzle/tailwindcss';

@theme {
  --color-primary: #2563eb;
}
</style>