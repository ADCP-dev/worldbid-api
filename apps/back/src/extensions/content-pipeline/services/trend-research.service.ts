import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllConfigType } from '@src/config/config.type';
import { ContentPipelineConfig } from '@ext/content-pipeline/config/content-pipeline-config.type';
import { ContentPipelineProjectEntity } from '@ext/content-pipeline/infrastructure/persistence/entities/project.entity';

export interface ResearchResult {
  ideas: {
    title: string;
    angle: string;
    keywords: string[];
    targetPlatforms: string[];
    contentType: string;
    researchData: {
      trendingTopics: string[];
      searchVolume?: number;
      difficulty?: string;
      competitorUrls?: string[];
      relatedKeywords?: string[];
    };
  }[];
}

@Injectable()
export class TrendResearchService {
  private readonly logger = new Logger(TrendResearchService.name);
  private readonly cfg: ContentPipelineConfig | null;

  constructor(
    private readonly configService: ConfigService<AllConfigType>,
  ) {
    this.cfg = this.configService.get('content-pipeline', { infer: true }) ?? null;
  }

  get isConfigured(): boolean {
    return !!this.cfg?.tavilyApiKey;
  }

  /**
   * Research trending topics for a project niche via Tavily.
   * Returns structured ideas with research data.
   */
  async research(project: ContentPipelineProjectEntity): Promise<ResearchResult> {
    if (!this.isConfigured) {
      this.logger.warn('Tavily API key not configured — returning empty research');
      return { ideas: [] };
    }

    const maxIdeas = this.cfg?.maxIdeasPerRun ?? 5;
    const niche = project.niche;
    const keywords = project.keywords;
    const language = project.language;

    // Build search queries based on project niche + keywords
    const queries = this.buildResearchQueries(niche, keywords, language);

    const allResults: any[] = [];
    for (const query of queries) {
      try {
        const results = await this.tavilySearch(query);
        allResults.push(...results);
      } catch (err) {
        this.logger.error(`Tavily search failed for "${query}": ${err}`);
      }
    }

    // Deduplicate and rank results
    const ranked = this.rankResults(allResults, keywords);

    // Generate structured ideas from top results
    const ideas = ranked.slice(0, maxIdeas).map((r) => this.resultToIdea(r, project));

    this.logger.log(`Research for project "${project.name}": ${ideas.length} ideas generated`);
    return { ideas };
  }

  private buildResearchQueries(niche: string, keywords: string[], language: string): string[] {
    const langSuffix = language === 'es' ? 'España 2025 2026' : '2025 2026';
    const baseQueries = [
      `${niche} trending topics ${langSuffix}`,
      `best ${niche} blog content ideas ${langSuffix}`,
      `${niche} social media viral content ${langSuffix}`,
    ];

    // Add keyword-specific queries
    if (keywords.length > 0) {
      baseQueries.push(`${keywords.slice(0, 3).join(' ')} popular content ${langSuffix}`);
    }

    return baseQueries;
  }

  private async tavilySearch(query: string): Promise<any[]> {
    const apiKey = this.cfg!.tavilyApiKey!;
    const baseUrl = this.cfg!.tavilyBaseUrl!;
    const maxResults = this.cfg?.tavilyMaxResults ?? 8;
    const timeoutMs = 30_000;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let res: Response;
    try {
      res = await fetch(`${baseUrl}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          query,
          max_results: maxResults,
          search_depth: 'advanced',
        }),
        signal: controller.signal,
      });
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        this.logger.error(`Tavily request timed out after ${timeoutMs}ms`);
      } else {
        this.logger.error(`Tavily request failed: ${(err as Error)?.message ?? err}`);
      }
      return [];
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      this.logger.error(`Tavily API error: ${res.status} ${res.statusText}`);
      return [];
    }

    const data = await res.json() as any;
    return data.results ?? [];
  }

  private rankResults(results: any[], projectKeywords: string[]): any[] {
    // Score by keyword overlap + title relevance
    const scored = results.map((r) => {
      const title = (r.title || '').toLowerCase();
      const content = (r.content || '').toLowerCase();
      let score = 0;
      for (const kw of projectKeywords) {
        if (title.includes(kw.toLowerCase())) score += 3;
        if (content.includes(kw.toLowerCase())) score += 1;
      }
      return { ...r, _score: score };
    });

    scored.sort((a, b) => b._score - a._score);
    // Deduplicate by URL
    const seen = new Set<string>();
    return scored.filter((r) => {
      if (seen.has(r.url)) return false;
      seen.add(r.url);
      return true;
    });
  }

  private resultToIdea(r: any, project: ContentPipelineProjectEntity): ResearchResult['ideas'][0] {
    const title = r.title || 'Untitled idea';
    const content = r.content || '';

    // Guess content type from title
    const titleLower = title.toLowerCase();
    let contentType = 'tips';
    if (titleLower.includes('receta') || titleLower.includes('recipe')) contentType = 'recipe';
    else if (titleLower.includes('compar') || titleLower.includes('best') || titleLower.includes('mejor')) contentType = 'comparison';
    else if (titleLower.includes('review') || titleLower.includes('analisis')) contentType = 'review';
    else if (titleLower.includes('guia') || titleLower.includes('guide')) contentType = 'guide';
    else if (titleLower.match(/\d+\s+(recetas|tips|trucos|formas)/)) contentType = 'listicle';

    return {
      title: title.substring(0, 500),
      angle: content.substring(0, 300),
      keywords: project.keywords.slice(0, 5),
      targetPlatforms: this.guessPlatforms(contentType, project),
      contentType,
      researchData: {
        trendingTopics: [title],
        competitorUrls: [r.url].filter(Boolean),
        relatedKeywords: [],
      },
    };
  }

  private guessPlatforms(
    contentType: string,
    project: ContentPipelineProjectEntity,
  ): string[] {
    const fromProject = (project.socialConfig?.platforms as string[]) ?? [];
    if (fromProject.length > 0) return ['blog', ...fromProject];
    const map: Record<string, string[]> = {
      recipe: ['blog', 'pinterest', 'instagram'],
      listicle: ['blog', 'pinterest', 'tiktok'],
      comparison: ['blog'],
      review: ['blog', 'youtube'],
      guide: ['blog', 'pinterest'],
      tips: ['blog', 'instagram', 'tiktok'],
    };
    return map[contentType] ?? ['blog', 'instagram'];
  }
}