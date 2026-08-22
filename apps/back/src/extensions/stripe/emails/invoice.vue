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
      <Body class="bg-base-100">
        <Container class="bg-base-200 rounded-lg p-8 max-w-600px mx-auto">
          <Heading class="text-2xl font-bold text-primary">Factura {{ invoiceNumber }}</Heading>
          <Text class="text-base-content/80">
            Adjuntamos tu factura por importe de <strong>{{ amount }} {{ currency }}</strong>.
          </Text>
          <Text class="text-base-content/80">Gracias por tu confianza.</Text>
          <Hr class="border-base-300 my-6" />
          <Text class="text-sm text-base-content/50">{{ appName }} - Facturacion automatica</Text>
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
