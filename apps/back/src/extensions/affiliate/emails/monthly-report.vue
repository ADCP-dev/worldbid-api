<script setup>
import Layout from '@emails/Layout.vue'
import { useConfig, usePlaintext } from '@maizzle/framework'

usePlaintext()

const {
  appName,
  appUrl,
  subject,
  partnerName,
  period,
  totalClicks,
  totalConversions,
  totalEarnings,
  currency,
  details,
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
          <Text class="text-slate-700">Hola {{ partnerName }},</Text>
          <Text class="text-slate-700">
            Aqui tienes el reporte mensual de tu programa de afiliados para el periodo: {{ period }}
          </Text>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr>
              <td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Clicks totales</td>
              <td style="padding: 8px; border: 1px solid #e5e7eb;">{{ totalClicks }}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Conversiones</td>
              <td style="padding: 8px; border: 1px solid #e5e7eb;">{{ totalConversions }}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #e5e7eb; font-weight: bold;">Ganancias</td>
              <td style="padding: 8px; border: 1px solid #e5e7eb;">{{ totalEarnings }} {{ currency }}</td>
            </tr>
          </table>
          <Text v-if="details" class="text-slate-700">{{ details }}</Text>
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