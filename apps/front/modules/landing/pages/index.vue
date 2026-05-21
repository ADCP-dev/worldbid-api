<script setup lang="ts">



definePageMeta({
    layout: 'landing',
})

useHead({
    title: 'Foundation - Base App for Business Integrations',
    meta: [
        {
            name: 'description',
            content: 'A comprehensive base app featuring NuxtJS, NestJS, DaisyUI, Redis, Postgres, and LangChain integration. Handles security, auth, payments, AI data, and more.',
        },
    ],
})
</script>

<template>
    <div>
        <LandingHero />
        <LandingSponsors />
        <LandingBenefits />
        <LandingFeatures />
        <LandingServices />
        <LandingHowItWorks />
        <LandingTestimonials />
        <LandingTeam />
        <LandingCommunity />
        <LandingPricing />
        <LandingContact />
        <LandingFAQ />
    </div>
</template>
