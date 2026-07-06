import { Injectable, Logger } from '@nestjs/common';
import { ContentPipelineProjectEntity } from '@ext/content-pipeline/infrastructure/persistence/entities/project.entity';
import { ContentPipelineIdeaEntity } from '@ext/content-pipeline/infrastructure/persistence/entities/idea.entity';

export interface SeoMetadata {
  metaTitle: string;
  metaDescription: string;
  focusKeyword: string;
  slug: string;
  jsonLd: Record<string, unknown>;
  canonicalUrl?: string;
}

/**
 * Pure functions — no external API calls. Derives SEO metadata from the
 * generated blog content, idea, and project.
 */
@Injectable()
export class SeoOptimizerService {
  private readonly logger = new Logger(SeoOptimizerService.name);

  optimize(params: {
    blogContent: string;
    idea: ContentPipelineIdeaEntity;
    project: ContentPipelineProjectEntity;
  }): SeoMetadata {
    const { blogContent, idea, project } = params;

    const focusKeyword =
      idea.keywords[0] ?? project.keywords[0] ?? this.firstSignificantWord(idea.title);

    const metaTitle = this.buildMetaTitle(idea.title, project.name, focusKeyword);
    const metaDescription = this.buildMetaDescription(
      blogContent,
      idea.angle,
      focusKeyword,
    );
    const slug = this.slugify(idea.title);
    const jsonLd = this.buildJsonLd(idea.contentType, idea.title, project, slug);

    this.logger.debug(
      `SEO optimized for "${idea.title}": slug=${slug}, title=${metaTitle.length}c, desc=${metaDescription.length}c`,
    );

    return {
      metaTitle,
      metaDescription,
      focusKeyword,
      slug,
      jsonLd,
    };
  }

  private buildMetaTitle(title: string, projectName: string, keyword: string): string {
    // Try to fit title + brand, prioritize keyword presence
    const brand = ` | ${projectName}`;
    const max = 60;

    if (title.length + brand.length <= max) {
      return `${title}${brand}`;
    }

    // Trim title to fit keyword + brand
    const budget = max - brand.length;
    let trimmed = title.slice(0, budget).trim();
    // Ensure keyword present if possible
    if (keyword && !trimmed.toLowerCase().includes(keyword.toLowerCase())) {
      const kwWithSep = `${trimmed} ${keyword}`.trim();
      if (kwWithSep.length <= max) trimmed = kwWithSep;
    }
    return `${trimmed}${brand}`;
  }

  private buildMetaDescription(
    blogContent: string,
    angle: string | null,
    keyword: string,
  ): string {
    const max = 160;
    const source = angle?.trim() || this.stripMarkdown(blogContent).trim();
    if (!source) return keyword.slice(0, max);

    let desc = source.slice(0, max);
    // Prefer ending at a sentence boundary
    const lastDot = desc.lastIndexOf('.');
    if (lastDot > 80) desc = desc.slice(0, lastDot + 1);

    if (keyword && !desc.toLowerCase().includes(keyword.toLowerCase())) {
      const withKw = `${desc} ${keyword}`.trim();
      if (withKw.length <= max) desc = withKw;
    }

    return desc.slice(0, max);
  }

  private slugify(input: string): string {
    return input
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // strip accents
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  }

  private buildJsonLd(
    contentType: string,
    title: string,
    project: ContentPipelineProjectEntity,
    slug: string,
  ): Record<string, unknown> {
    const base = {
      '@context': 'https://schema.org',
      headline: title,
      author: {
        '@type': 'Person',
        name: (project.authorPersona?.name as string) ?? project.name,
      },
      publisher: {
        '@type': 'Organization',
        name: project.name,
      },
    };

    switch (contentType) {
      case 'recipe':
        return {
          ...base,
          '@type': 'Recipe',
          name: title,
          recipeCuisine: project.niche,
          keywords: project.keywords.join(', '),
        };
      case 'review':
        return {
          ...base,
          '@type': 'Product',
          name: title,
          description: project.description ?? '',
          brand: { '@type': 'Brand', name: project.name },
        };
      case 'listicle':
        return {
          ...base,
          '@type': 'FAQPage',
          mainEntity: project.keywords.map((k) => ({
            '@type': 'Question',
            name: k,
            acceptedAnswer: { '@type': 'Answer', text: '' },
          })),
        };
      case 'guide':
      case 'comparison':
      case 'tips':
      default:
        return {
          ...base,
          '@type': 'Article',
          articleSection: project.niche,
          keywords: project.keywords.join(', '),
          url: slug,
        };
    }
  }

  private stripMarkdown(md: string): string {
    return md
      .replace(/^#+\s+/gm, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\n+/g, ' ');
  }

  private firstSignificantWord(title: string): string {
    const stop = new Set([
      'the','a','an','el','la','los','las','de','del','how','to','best','guide',
    ]);
    return (
      title
        .split(/\s+/)
        .map((w) => w.toLowerCase().replace(/[^a-záéíóúñ]/g, ''))
        .find((w) => w.length > 3 && !stop.has(w)) ?? title.split(/\s+/)[0] ?? ''
    );
  }
}