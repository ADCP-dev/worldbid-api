<script setup>
import Layout from '@emails/Layout.vue'
import { useConfig, usePlaintext } from '@maizzle/framework'

usePlaintext()

const {
  appName,
  appUrl,
  subject,
  invoiceNumber,
  amount,
  currency,
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
          <Heading class="text-2xl font-bold text-gray-800">Factura {{ invoiceNumber }}</Heading>
          <Text class="text-slate-700">
            Adjuntamos tu factura por importe de <strong>{{ amount }} {{ currency }}</strong>.
          </Text>
          <Text class="text-slate-700">Gracias por tu confianza.</Text>
          <div style="border-top: 1px solid #e5e7eb; margin: 20px 0" />
          <Text class="text-sm text-gray-400">Ikiraisolutions - Facturacion automatica</Text>
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