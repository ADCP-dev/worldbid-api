/**
 * SEO Types for CMS Frontend
 * Mirrors backend RobotsPolicy and hreflang structures
 */

// Robots Policy Interface - controls search engine crawler behavior
export interface RobotsPolicy {
  index?: boolean; // default: true
  follow?: boolean; // default: true
  maxImagePreview?: 'none' | 'small' | 'large';
  maxVideoPreview?: 'none' | 'small' | 'large';
  maxSnippet?: 'none' | number;
  noArchive?: boolean;
  noTranslate?: boolean;
}

// Hreflang Link - represents a alternate link tag for multilingual SEO
export interface HreflangLink {
  locale: string;
  url: string;
}

// SEO Metadata - complete SEO data for a page
export interface SeoMetadata {
  pageId: string;
  lang: string;
  metaTitle: string | null;
  metaDescription: string | null;
  metaKeywords: string[] | null;
  ogImage?: {
    id: string;
    url: string;
    name: string;
  } | null;
  canonicalUrl: string | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
  type?: 'WebPage' | 'Article' | 'WebSite';
  // New fields for enhanced SEO
  robotsPolicy?: RobotsPolicy | null;
  hreflangEnabled?: boolean;
  hreflangAlternateLocales?: string[] | null;
  hreflangCustomUrls?: Record<string, string> | null;
}