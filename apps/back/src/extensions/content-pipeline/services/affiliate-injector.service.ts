import { Injectable, Logger, ModuleRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllConfigType } from '@src/config/config.type';
import { ContentPipelineProjectEntity } from '@ext/content-pipeline/infrastructure/persistence/entities/project.entity';

export interface AffiliateLink {
  url: string;
  anchorText: string;
  productId?: string;
  program?: string;
  asin?: string;
  injected: boolean;
}

export interface AffiliateInjectionResult {
  blogContent: string;
  affiliateLinks: AffiliateLink[];
  disclosureAdded: boolean;
}

interface AffiliateProgram {
  name?: string;
  network?: string;
  trackingId?: string;
  baseUrl?: string;
  commission?: number;
}
interface AffiliateConfig {
  enabled?: boolean;
  programs?: AffiliateProgram[];
  autoInject?: boolean;
  disclosureText?: string;
}

/**
 * Runtime-checked affiliate injection. If the `affiliate` extension is not
 * loaded OR the project's affiliateConfig is disabled, the service no-ops
 * and returns the content untouched.
 */
@Injectable()
export class AffiliateInjectorService {
  private readonly logger = new Logger(AffiliateInjectorService.name);
  private affiliateService: any | null | undefined;

  constructor(
    private readonly configService: ConfigService<AllConfigType>,
    private readonly moduleRef: ModuleRef,
  ) {}

  /**
   * Lazily resolve the AffiliatePartnerService if the affiliate extension
   * is loaded. If it throws (extension not registered), affiliate is not
   * available. Mirrors the pattern used by PublishingService.
   */
  private getAffiliateService(): any | null {
    if (this.affiliateService !== undefined) return this.affiliateService;
    try {
      this.affiliateService = this.moduleRef.get('AffiliatePartnerService', {
        strict: false,
      });
    } catch {
      this.affiliateService = null;
    }
    return this.affiliateService;
  }

  get affiliateEnabled(): boolean {
    return !!this.getAffiliateService();
  }

  async inject(
    blogContent: string,
    project: ContentPipelineProjectEntity,
  ): Promise<AffiliateInjectionResult> {
    if (!this.affiliateEnabled) {
      this.logger.debug('Affiliate extension not loaded — skipping injection');
      return { blogContent, affiliateLinks: [], disclosureAdded: false };
    }

    const cfg = (project.affiliateConfig ?? {}) as AffiliateConfig;
    if (!cfg.enabled) {
      this.logger.debug(`Project "${project.name}" has affiliate disabled — skipping`);
      return { blogContent, affiliateLinks: [], disclosureAdded: false };
    }

    const programs = cfg.programs ?? [];
    if (programs.length === 0) {
      return { blogContent, affiliateLinks: [], disclosureAdded: false };
    }

    const links: AffiliateLink[] = [];
    let modified = blogContent;

    for (const program of programs) {
      const mentions = this.findProductMentions(modified, project.keywords);
      for (const mention of mentions) {
        const url = this.buildAffiliateUrl(mention, program);
        if (!url) continue;
        // Skip if already linked
        if (modified.includes(`](${url}`)) continue;

        const anchor = mention.anchorText;
        const pattern = new RegExp(
          `(?<![\\[])\\b${this.escapeRegex(anchor)}\\b(?![^<]*>|[^\\[]*\\])`,
          'gi',
        );
        const replacement = `[${anchor}](${url})`;
        const before = modified;
        modified = modified.replace(pattern, replacement);
        if (modified !== before) {
          links.push({
            url,
            anchorText: anchor,
            productId: mention.productId,
            program: program.name,
            injected: true,
          });
        }
      }
    }

    // Add FTC disclosure at the end if any links were injected
    let disclosureAdded = false;
    if (links.length > 0 && cfg.autoInject !== false) {
      const disclosure =
        cfg.disclosureText ??
        '---\n\n*Aviso: este post contiene enlaces de afiliados. Si compras a través de ellos, podemos recibir una comisión sin coste adicional para ti.*';
      if (!modified.includes(disclosure.slice(0, 40))) {
        modified = `${modified.trimEnd()}\n\n${disclosure}`;
        disclosureAdded = true;
      }
    }

    this.logger.log(
      `Affiliate injection for "${project.name}": ${links.length} links, disclosure=${disclosureAdded}`,
    );

    return { blogContent: modified, affiliateLinks: links, disclosureAdded };
  }

  private findProductMentions(
    content: string,
    projectKeywords: string[],
  ): Array<{ anchorText: string; productId: string }> {
    // Use project keywords + capitalized phrases as candidate product mentions.
    const mentions = new Map<string, { anchorText: string; productId: string }>();

    for (const kw of projectKeywords) {
      const re = new RegExp(`\\b${this.escapeRegex(kw)}\\b`, 'gi');
      if (re.test(content)) {
        mentions.set(kw.toLowerCase(), { anchorText: kw, productId: this.slugify(kw) });
      }
    }

    // Detect capitalized multi-word product-like phrases (e.g. "Air Fryer Pro")
    const capPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g;
    let m: RegExpExecArray | null;
    while ((m = capPattern.exec(content)) !== null) {
      const phrase = m[1];
      if (phrase.length > 3 && !mentions.has(phrase.toLowerCase())) {
        mentions.set(phrase.toLowerCase(), {
          anchorText: phrase,
          productId: this.slugify(phrase),
        });
      }
    }

    return Array.from(mentions.values());
  }

  private buildAffiliateUrl(
    mention: { anchorText: string; productId: string },
    program: AffiliateProgram,
  ): string | null {
    const trackingId = program.trackingId;
    if (!trackingId) return null;

    if (program.network?.toLowerCase() === 'amazon') {
      return `https://www.amazon.com/dp/${mention.productId}?tag=${trackingId}`;
    }
    if (program.baseUrl) {
      const sep = program.baseUrl.includes('?') ? '&' : '?';
      return `${program.baseUrl}${sep}ref=${trackingId}&pid=${mention.productId}`;
    }
    return `https://go.${program.name?.toLowerCase() ?? 'affiliate'}.com/${trackingId}/${mention.productId}`;
  }

  private escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private slugify(s: string): string {
    return s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}