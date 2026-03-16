<script setup lang="ts">



definePageMeta({
    layout: 'blank',
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
        <LandingNavbar />
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
        <LandingFooter />
    </div>
</template>
