<script setup>
import Layout from '../../Layout.vue'
import { useConfig } from '@maizzle/framework'

const { subject, slotText } = useConfig()
</script>

<template>
  <Layout>
    <Html>
      <Head>
        <title>{{ subject }}</title>
      </Head>
      <Body class="bg-slate-50">
        <Container class="bg-white p-8 max-w-600px mx-auto">
          <Text>{{ slotText }}</Text>
        </Container>
      </Body>
    </Html>
  </Layout>
</template>