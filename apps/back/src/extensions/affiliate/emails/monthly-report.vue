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
      <Body class="bg-base-100">
        <Container class="bg-base-200 rounded-lg p-8 max-w-600px mx-auto">
          <Heading class="text-2xl font-bold text-primary">{{ subject }}</Heading>
          <Text class="text-base-content/80">Hola {{ partnerName }},</Text>
          <Text class="text-base-content/80">
            Aqui tienes el reporte mensual de tu programa de afiliados para el periodo: {{ period }}
          </Text>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr>
              <td style="padding: 8px; border: 1px solid #262626; font-weight: bold; color: #F5F5F5;">Clicks totales</td>
              <td style="padding: 8px; border: 1px solid #262626; color: #F5F5F5;">{{ totalClicks }}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #262626; font-weight: bold; color: #F5F5F5;">Conversiones</td>
              <td style="padding: 8px; border: 1px solid #262626; color: #F5F5F5;">{{ totalConversions }}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border: 1px solid #262626; font-weight: bold; color: #F5F5F5;">Ganancias</td>
              <td style="padding: 8px; border: 1px solid #262626; color: #F5F5F5;">{{ totalEarnings }} {{ currency }}</td>
            </tr>
          </table>
          <Text v-if="details" class="text-base-content/80">{{ details }}</Text>
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
