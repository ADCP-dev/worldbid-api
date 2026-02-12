<script setup lang="ts">
import Navbar from '~/components/landing/Navbar.vue'
import Hero from '~/components/landing/Hero.vue'
import Benefits from '~/components/landing/Benefits.vue'
import Features from '~/components/landing/Features.vue'
import Services from '~/components/landing/Services.vue'
import HowItWorks from '~/components/landing/HowItWorks.vue'
import Sponsors from '~/components/landing/Sponsors.vue'
import Testimonials from '~/components/landing/Testimonials.vue'
import Team from '~/components/landing/Team.vue'
import Pricing from '~/components/landing/Pricing.vue'
import Community from '~/components/landing/Community.vue'
import Contact from '~/components/landing/Contact.vue'
import FAQ from '~/components/landing/FAQ.vue'
import Footer from '~/components/landing/Footer.vue'

definePageMeta({
    layout: 'blank',
})

useHead({
    title: 'Foundation - Base App for Business Integrations',
    meta: [
        {
            name: 'description',
            content: 'A comprehensive base app featuring NuxtJS, NestJS, Shadcn, Redis, Postgres, and LangChain integration. Handles security, auth, payments, AI data, and more.',
        },
    ],
})
</script>

<template>
    <div>
        <Navbar />
        <Hero />
        <Sponsors />
        <Benefits />
        <Features />
        <Services />
        <HowItWorks />
        <Testimonials />
        <Team />
        <Community />
        <Pricing />
        <Contact />
        <FAQ />
        <Footer />
    </div>
</template>
