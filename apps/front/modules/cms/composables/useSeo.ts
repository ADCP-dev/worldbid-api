/**
 * useSeo Composable
 * Provides SEO utilities for building meta tags, hreflang links, and robots content
 * Designed to work with the CMS SEO module and Nuxt i18n
 *
 * Usage:
 * ```ts
 * const { buildHreflangLinks, buildRobotsContent, setSeoMeta } = useSeo()
 *
 * // Build hreflang links for current page
 * const hreflangs = buildHreflangLinks(currentPath, customUrls)
 *
 * // Build robots meta content
 * const robots = buildRobotsContent(robotsPolicy)
 *
 * // Set all SEO meta tags
 * setSeoMeta(seoMetadata)
 * ```
 */

import type { RobotsPolicy, SeoMetadata } from '../types/seo';
import type { SchemaType } from '../types/json-ld';

// Types for hreflang link output
export interface HreflangLinkOutput {
  rel: 'alternate';
  hreflang: string;
  href: string;
}

export function useSeo() {
  const config = useRuntimeConfig();
  const { locale, locales } = useI18n();
  const appUrl = config.public.apiUrl || 'https://example.com';

  // Get active locales from i18n configuration
  const activeLocales = computed<Array<{ code: string }>>(() => {
    const localeConfig = locales.value;
    if (Array.isArray(localeConfig)) {
      return localeConfig as Array<{ code: string }>;
    }
    // Fallback for object-style locale config
    return Object.values(localeConfig as Record<string, { code: string }>);
  });

  /**
   * Build hreflang links for multilingual SEO
   * Generates alternate link tags for all configured locales
   *
   * @param currentPath - Current page path (e.g., '/blog/my-post')
   * @param customUrls - Optional custom URL mapping per locale { 'en': '/en/blog/post', 'es': '/blog/post' }
   * @param includeXDefault - Whether to include x-default hreflang (default: true)
   * @returns Array of hreflang link objects
   */
  function buildHreflangLinks(
    currentPath: string,
    customUrls?: Record<string, string>,
    includeXDefault = true,
  ): HreflangLinkOutput[] {
    const links: HreflangLinkOutput[] = [];

    for (const loc of activeLocales.value) {
      const localeCode = loc.code;
      const customUrl = customUrls?.[localeCode];

      // Use custom URL if provided, otherwise generate from pattern /{locale}{path}
      const href = customUrl || `${appUrl}/${localeCode}${currentPath}`;

      links.push({
        rel: 'alternate',
        hreflang: localeCode,
        href,
      });
    }

    // Add x-default hreflang
    if (includeXDefault) {
      const defaultLocale = config.public.defaultLocale || 'es';
      const defaultCustomUrl = customUrls?.['x-default'] || customUrls?.[defaultLocale];
      const defaultHref = defaultCustomUrl || `${appUrl}/${defaultLocale}${currentPath}`;

      links.push({
        rel: 'alternate',
        hreflang: 'x-default',
        href: defaultHref,
      });
    }

    return links;
  }

  /**
   * Build robots meta content string
   * Converts RobotsPolicy object to robots meta content (e.g., "index, follow, noarchive")
   *
   * @param policy - RobotsPolicy object with crawler directives
   * @returns Robots meta content string or null if no policy
   */
  function buildRobotsContent(policy?: RobotsPolicy | null): string | null {
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
  }

  /**
   * Set SEO meta tags using Nuxt's useHead composable
   * This is a convenience wrapper that sets all SEO-related head tags
   *
   * @param seo - SeoMetadata object with all SEO fields
   * @param options - Optional configuration for additional behavior
   */
  function setSeoMeta(
    seo: SeoMetadata,
    options: {
      currentPath?: string;
      useHreflang?: boolean;
      useRobots?: boolean;
    } = {},
  ): void {
    const { currentPath = '', useHreflang = true, useRobots = true } = options;

    // Build title and description
    const title = seo.metaTitle || '';
    const description = seo.metaDescription || '';

    // Build base head object
    const headData: Record<string, unknown> = {
      title,
    };

    // Add meta tags
    if (description) {
      headData.meta = [
        { name: 'description', content: description },
        { property: 'og:title', content: seo.ogTitle || title },
        { property: 'og:description', content: seo.ogDescription || description },
        { property: 'og:type', content: seo.type || 'website' },
      ];
    }

    // Add canonical URL
    if (seo.canonicalUrl) {
      headData.link = [{ rel: 'canonical', href: seo.canonicalUrl }];
    }

    // Add robots meta if policy exists and is enabled
    if (useRobots && seo.robotsPolicy) {
      const robotsContent = buildRobotsContent(seo.robotsPolicy);
      if (robotsContent) {
        const metaArray = (headData.meta as Array<Record<string, string>>) || [];
        metaArray.push({ name: 'robots', content: robotsContent });
        headData.meta = metaArray;
      }
    }

    // Build hreflang links if enabled
    if (useHreflang && seo.hreflangEnabled !== false) {
      const hreflangs = buildHreflangLinks(
        currentPath,
        seo.hreflangCustomUrls || undefined,
      );

      const linkArray = (headData.link as HreflangLinkOutput[]) || [];
      for (const hreflang of hreflangs) {
        linkArray.push({
          rel: hreflang.rel,
          hreflang: hreflang.hreflang,
          href: hreflang.href,
        });
      }
      headData.link = linkArray;
    }

    // Apply head data
    useHead(headData);
  }

  /**
   * Build Open Graph image URL with full origin
   * Ensures OG image URLs are absolute
   */
  function buildOgImageUrl(ogImage?: { url: string } | null): string | undefined {
    if (!ogImage?.url) return undefined;

    // If already absolute, return as-is
    if (ogImage.url.startsWith('http://') || ogImage.url.startsWith('https://')) {
      return ogImage.url;
    }

    // Make relative URL absolute
    return `${appUrl}${ogImage.url}`;
  }

  return {
    // Active locales from i18n
    activeLocales,

    // Build hreflang links array
    buildHreflangLinks,

    // Build robots content string
    buildRobotsContent,

    // Set all SEO meta tags at once
    setSeoMeta,

    // Build full OG image URL
    buildOgImageUrl,
  };
}