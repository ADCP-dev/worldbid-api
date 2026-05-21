<script setup lang="ts">
/**
 * CmsSeoMeta Component
 * Enhanced SEO meta tags including robots, hreflang, and canonical URL
 *
 * Provides:
 * - Standard meta tags (title, description, og tags, twitter cards)
 * - Robots meta tag for crawler control
 * - Hreflang alternate links for multilingual SEO
 * - Canonical URL
 * - JSON-LD structured data
 */

import type { RobotsPolicy } from '@cms/types/seo';

// Props interface - enhanced with new SEO fields
interface Props {
  seo: {
    metaTitle?: string | null;
    metaDescription?: string | null;
    metaKeywords?: string | null;
    ogImage?: string | null;
    customJsonLd?: Record<string, any> | null;
    // New fields
    canonicalUrl?: string | null;
    ogTitle?: string | null;
    ogDescription?: string | null;
    robotsPolicy?: RobotsPolicy | null;
    hreflangEnabled?: boolean;
    hreflangAlternateLocales?: string[] | null;
    hreflangCustomUrls?: Record<string, string> | null;
  };
  type?: 'WebPage' | 'Article' | 'WebSite';
  // Allow explicit props for direct usage without seo object
  pageId?: string;
  lang?: string;
}

const props = withDefaults(defineProps<Props>(), {
  type: 'WebPage',
  lang: 'es',
  hreflangEnabled: true,
});

const config = useRuntimeConfig();
const appUrl = config.public.appUrl;

// Use i18n for locale-aware meta
const { locale, locales } = useI18n();

// Compute effective seo object - allow direct props to override
const seoData = computed(() => {
  return {
    metaTitle: props.seo?.metaTitle || '',
    metaDescription: props.seo?.metaDescription || '',
    metaKeywords: props.seo?.metaKeywords || '',
    ogImage: props.seo?.ogImage || '',
    customJsonLd: props.seo?.customJsonLd || null,
    canonicalUrl: props.seo?.canonicalUrl || null,
    ogTitle: props.seo?.ogTitle || null,
    ogDescription: props.seo?.ogDescription || null,
    robotsPolicy: props.seo?.robotsPolicy || null,
    hreflangEnabled: props.seo?.hreflangEnabled !== false && props.hreflangEnabled,
    hreflangAlternateLocales: props.seo?.hreflangAlternateLocales || null,
    hreflangCustomUrls: props.seo?.hreflangCustomUrls || null,
  };
});

// Locale for OG tags
const localeOg = computed(() => {
  const lang = props.lang || locale.value;
  return lang === 'en' ? 'en_US' : 'es_ES';
});

// Build robots meta content
const robotsContent = computed(() => {
  const policy = seoData.value.robotsPolicy;
  if (!policy) return null;

  const parts: string[] = [];

  // Index directive (default is index)
  parts.push(policy.index === false ? 'noindex' : 'index');

  // Follow directive (default is follow)
  parts.push(policy.follow === false ? 'nofollow' : 'follow');

  // Max image preview
  if (policy.maxImagePreview) {
    parts.push(`max-image-preview:${policy.maxImagePreview}`);
  }

  // Max video preview
  if (policy.maxVideoPreview) {
    parts.push(`max-video-preview:${policy.maxVideoPreview}`);
  }

  // Max snippet
  if (policy.maxSnippet !== undefined) {
    if (policy.maxSnippet === 'none') {
      parts.push('max-snippet:none');
    } else if (typeof policy.maxSnippet === 'number') {
      parts.push(`max-snippet:${policy.maxSnippet}`);
    }
  }

  // Archive directive
  if (policy.noArchive) {
    parts.push('noarchive');
  }

  // Translate directive
  if (policy.noTranslate) {
    parts.push('notranslate');
  }

  return parts.join(', ');
});

// Build hreflang links
const hreflangLinks = computed(() => {
  if (!seoData.value.hreflangEnabled) return [];

  // Get locales to use
  let localeCodes: string[];
  if (seoData.value.hreflangAlternateLocales && seoData.value.hreflangAlternateLocales.length > 0) {
    localeCodes = seoData.value.hreflangAlternateLocales;
  } else {
    // Fall back to i18n configured locales
    const localeConfig = locales.value;
    if (Array.isArray(localeConfig)) {
      localeCodes = localeConfig.map((l) => (typeof l === 'string' ? l : l.code));
    } else {
      localeCodes = Object.keys(localeConfig || {});
    }
  }

  // Get current path from canonical URL or default
  const currentPath = seoData.value.canonicalUrl
    ? new URL(seoData.value.canonicalUrl, appUrl).pathname
    : '';

  // Determine default locale (no prefix with prefix_except_default)
  const defaultLocale = props.lang || 'es';

  const links: Array<{ rel: 'alternate'; hreflang: string; href: string }> = [];

  for (const loc of localeCodes) {
    const customUrl = seoData.value.hreflangCustomUrls?.[loc];
    // prefix_except_default: default locale has no /{lang}/ prefix
    const href = customUrl || (loc === defaultLocale
      ? `${appUrl}${currentPath}`
      : `${appUrl}/${loc}${currentPath}`);

    links.push({
      rel: 'alternate',
      hreflang: loc,
      href,
    });
  }

  // x-default: same as default locale (no prefix)
  const xDefaultCustomUrl = seoData.value.hreflangCustomUrls?.['x-default'] ||
                            seoData.value.hreflangCustomUrls?.[defaultLocale];
  const xDefaultHref = xDefaultCustomUrl || `${appUrl}${currentPath}`;

  links.push({
    rel: 'alternate',
    hreflang: 'x-default',
    href: xDefaultHref,
  });

  return links;
});

// Build meta array
const metaTags = computed(() => {
  const tags: Array<Record<string, string>> = [];

  // Description
  if (seoData.value.metaDescription) {
    tags.push({ name: 'description', content: seoData.value.metaDescription });
  }

  // Keywords
  if (seoData.value.metaKeywords) {
    tags.push({ name: 'keywords', content: seoData.value.metaKeywords });
  }

  // OG tags
  const ogTitle = seoData.value.ogTitle || seoData.value.metaTitle;
  const ogDesc = seoData.value.ogDescription || seoData.value.metaDescription;

  if (ogTitle) {
    tags.push({ property: 'og:title', content: ogTitle });
  }
  if (ogDesc) {
    tags.push({ property: 'og:description', content: ogDesc });
  }

  // OG image handled by nuxt-og-image module (defineOgImageComponent)

  tags.push({ property: 'og:type', content: props.type === 'Article' ? 'article' : 'website' });
  tags.push({ property: 'og:locale', content: localeOg.value });

  // OG URL (canonical)
  if (seoData.value.canonicalUrl) {
    tags.push({ property: 'og:url', content: seoData.value.canonicalUrl });
  }

  // OG site name
  const siteName = config.public.appName || '';
  tags.push({ property: 'og:site_name', content: siteName });

  // Twitter cards
  tags.push({ name: 'twitter:card', content: 'summary_large_image' });
  if (ogTitle) {
    tags.push({ name: 'twitter:title', content: ogTitle });
  }
  if (ogDesc) {
    tags.push({ name: 'twitter:description', content: ogDesc });
  }
  // Twitter image handled by nuxt-og-image module

  // Robots meta
  if (robotsContent.value) {
    tags.push({ name: 'robots', content: robotsContent.value });
  }

  return tags;
});

// Build link array
const linkTags = computed(() => {
  const links: Array<{ rel: string; hreflang?: string; href: string }> = [];

  // Canonical URL
  if (seoData.value.canonicalUrl) {
    links.push({ rel: 'canonical', href: seoData.value.canonicalUrl });
  }

  // Hreflang links
  for (const link of hreflangLinks.value) {
    links.push({
      rel: link.rel,
      hreflang: link.hreflang,
      href: link.href,
    });
  }

  return links;
});

// Build script array for JSON-LD
// Deduplicate BreadcrumbList: if Breadcrumbs.vue already injects one, skip it here
const jsonLdScripts = computed(() => {
  if (!seoData.value.customJsonLd) return [];

  const items = Array.isArray(seoData.value.customJsonLd)
    ? seoData.value.customJsonLd
    : [seoData.value.customJsonLd];

  // Filter out BreadcrumbList entries to prevent duplication with Breadcrumbs.vue
  const filtered = items.filter(
    (item: Record<string, unknown>) => item?.['@type'] !== 'BreadcrumbList'
  );

  if (filtered.length === 0) return [];

  const payload = filtered.length === 1 ? filtered[0] : filtered;

  return [
    {
      type: 'application/ld+json' as const,
      children: () => JSON.stringify(payload),
    },
  ];
});

// Use Nuxt's useHead to inject all SEO meta
useHead({
  title: seoData.value.metaTitle,
  meta: metaTags.value,
  link: linkTags.value,
  script: jsonLdScripts.value,
});
</script>

<template>
  <!-- Component is head-only - no visible render needed -->
  <!-- All SEO meta injected via useHead() -->
</template>