import { Injectable, Logger } from '@nestjs/common';

export type CarouselSlideType =
  | 'hook'
  | 'context'
  | 'step'
  | 'metric'
  | 'testimonial'
  | 'summary'
  | 'cta';

export interface CarouselSlide {
  type: CarouselSlideType;
  /** Uppercase label above title. */
  mono?: string;
  /** Main headline (can contain HTML for gradient text). */
  title?: string;
  /** Supporting text. */
  body?: string;
  /** "01", "02" etc for step slides. */
  stepNumber?: string;
  /** "62%" for metric slides. */
  metricValue?: string;
  /** Description of the metric. */
  metricLabel?: string;
  /** For testimonial slides. */
  quote?: string;
  /** For testimonial slides. */
  quoteAuthor?: string;
  /** For CTA slides. */
  ctaText?: string;
  /** Button text. */
  ctaButton?: string;
}

export interface BrandConfig {
  /** "SOM-OS" */
  name: string;
  /** "#07070a" */
  bg: string;
  /** "#f4f4f6" */
  text: string;
  /** "rgba(244,244,246,0.66)" */
  t2: string;
  /** "rgba(244,244,246,0.4)" */
  t3: string;
  /** "#b56cff" */
  accent: string;
  /** Full CSS gradient. */
  gradient: string;
  /** "Inter Tight" */
  fontName: string;
  /** "SOM-OS.dev · Desliza →" */
  followTag: string;
}

export interface GenerateCarouselParams {
  title: string;
  slides: CarouselSlide[];
  brandConfig?: BrandConfig;
  /** 1080x1350 (LinkedIn 4:5) or 1080x1920 (9:16 video). */
  format?: 'portrait' | 'vertical';
}

export interface GeneratedCarousel {
  htmlContents: string[];
  postText: string;
}

/** SOM-OS default brand configuration. */
export const SOM_OS_BRAND: BrandConfig = {
  name: 'SOM-OS',
  bg: '#07070a',
  text: '#f4f4f6',
  t2: 'rgba(244,244,246,0.66)',
  t3: 'rgba(244,244,246,0.4)',
  accent: '#b56cff',
  gradient:
    'linear-gradient(110deg,#00f0ff 0%,#6c8cff 28%,#b56cff 55%,#ff5fd2 82%,#ffb86c 100%)',
  fontName: 'Inter Tight',
  followTag: 'SOM-OS.dev · Desliza →',
};

interface Dimensions {
  width: number;
  height: number;
  padding: number;
  scale: number;
}

const PORTRAIT_DIMS: Dimensions = {
  width: 1080,
  height: 1350,
  padding: 80,
  scale: 0.75,
};

const VERTICAL_DIMS: Dimensions = {
  width: 1080,
  height: 1920,
  padding: 100,
  scale: 1,
};

/**
 * Generates LinkedIn carousel slides as self-contained HTML documents,
 * ready to be rendered to PNG by `HtmlRendererService`.
 *
 * Uses the SOM-OS design system (dark bg, gradient accent, Inter Tight font).
 * Each slide is a complete `<!doctype html>` with inline CSS.
 *
 * Also generates the accompanying LinkedIn post text (100-200 words).
 */
@Injectable()
export class CarouselGeneratorService {
  private readonly logger = new Logger(CarouselGeneratorService.name);

  async generateCarouselSlides(
    params: GenerateCarouselParams,
  ): Promise<GeneratedCarousel> {
    const slides = params.slides ?? [];
    if (slides.length === 0) {
      throw new Error('Cannot generate carousel: no slides provided');
    }

    const brand = params.brandConfig ?? SOM_OS_BRAND;
    const format = params.format ?? 'vertical';
    const dims = format === 'portrait' ? PORTRAIT_DIMS : VERTICAL_DIMS;

    this.logger.log(
      `Generating ${slides.length} carousel slides (${dims.width}x${dims.height}), brand=${brand.name}`,
    );

    const htmlContents = slides.map((slide, i) =>
      this.buildSlideHtml(slide, i, slides.length, brand, dims),
    );

    const postText = this.buildPostText(params.title, slides, brand);

    this.logger.log(
      `Generated ${htmlContents.length} HTML slides + post text (${postText.length} chars)`,
    );

    return { htmlContents, postText };
  }

  // ---------------------------------------------------------------------------
  // HTML building
  // ---------------------------------------------------------------------------

  private buildSlideHtml(
    slide: CarouselSlide,
    index: number,
    total: number,
    brand: BrandConfig,
    dims: Dimensions,
  ): string {
    const pageNum = `${index + 1}/${total}`;
    const css = this.buildCss(brand, dims);
    const content = this.buildSlideContent(slide, dims);

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=${dims.width}, initial-scale=1">
<style>
${css}
</style>
</head>
<body>
<div class="slide">
  <div class="brand">${this.escapeHtml(brand.name)}</div>
  ${content}
  <div class="follow">${this.escapeHtml(brand.followTag)}</div>
  <div class="page-num">${pageNum}</div>
</div>
</body>
</html>`;
  }

  private buildCss(brand: BrandConfig, dims: Dimensions): string {
    const s = dims.scale;
    const px = (v: number) => `${Math.round(v * s)}px`;

    return `:root {
  --bg:${brand.bg}; --text:${brand.text};
  --t2:${brand.t2}; --t3:${brand.t3};
  --line:rgba(255,255,255,0.08);
  --grad:${brand.gradient};
  --accent:${brand.accent};
}
* { margin:0; padding:0; box-sizing:border-box; }
body { width:${dims.width}px; height:${dims.height}px; background:var(--bg); font-family:'${brand.fontName}',sans-serif; color:var(--text); }
.slide { width:${dims.width}px; height:${dims.height}px; background:var(--bg); position:relative; overflow:hidden;
  display:flex; flex-direction:column; justify-content:center; padding:${dims.padding}px; }
.slide::before { content:""; position:absolute; inset:0; pointer-events:none; z-index:0;
  background:radial-gradient(ellipse at 80% 20%, rgba(108,140,255,0.08) 0%, transparent 50%),
             radial-gradient(ellipse at 20% 80%, rgba(181,108,255,0.06) 0%, transparent 45%); }
.slide > * { position:relative; z-index:1; }
.brand { position:absolute; top:${px(48)}px; left:${dims.padding}px; font-size:${px(28)}px; font-weight:800; color:var(--accent); }
.page-num { position:absolute; bottom:${px(48)}px; right:${dims.padding}px; font-size:${px(22)}px; color:var(--t3); }
.follow { position:absolute; bottom:${px(48)}px; left:${dims.padding}px; font-size:${px(20)}px; color:var(--t3); }
.mono { font-size:${px(24)}px; letter-spacing:0.18em; text-transform:uppercase; color:var(--t3); font-weight:500; margin-bottom:${px(32)}px; }
.grad-text { background:var(--grad); -webkit-background-clip:text; background-clip:text; -webkit-text-fill-color:transparent; }
.h1 { font-size:${px(88)}px; font-weight:900; line-height:0.95; letter-spacing:-0.04em; }
.body { font-size:${px(38)}px; line-height:1.5; color:var(--t2); margin-top:${px(40)}px; max-width:${Math.round(800 * s)}px; }
.step-num { font-size:${px(28)}px; font-weight:800; color:transparent; background:var(--grad); -webkit-background-clip:text; background-clip:text; margin-bottom:${px(12)}px; }
.step-title { font-size:${px(52)}px; font-weight:800; margin:0 0 ${px(20)}px; letter-spacing:-0.03em; }
.step-desc { font-size:${px(34)}px; line-height:1.45; color:var(--t2); }
.metric-val { font-size:${px(120)}px; font-weight:900; letter-spacing:-0.04em; line-height:0.9; margin-bottom:${px(12)}px; }
.metric-label { font-size:${px(32)}px; font-weight:600; color:var(--text); margin-bottom:${px(8)}px; }
.cta-box { border:1.5px solid rgba(255,255,255,0.14); border-radius:${px(24)}px; padding:${px(56)}px; background:#0d0d12; }
.cta-box h2 { font-size:${px(64)}px; font-weight:900; letter-spacing:-0.03em; line-height:1.05; margin:0 0 ${px(20)}px; }
.cta-box p { font-size:${px(30)}px; color:var(--t2); margin:0 0 ${px(32)}px; }
.cta-btn { display:inline-flex; background:var(--grad); color:#07070a; font-weight:800; font-size:${px(28)}px; padding:${px(20)}px ${px(44)}px; border-radius:999px; }
.quote-block { border-left:4px solid var(--accent); padding-left:${px(40)}px; }
.quote-text { font-size:${px(48)}px; font-weight:700; line-height:1.3; letter-spacing:-0.02em; }
.quote-author { font-size:${px(28)}px; color:var(--t3); margin-top:${px(32)}px; font-weight:600; }`;
  }

  private buildSlideContent(slide: CarouselSlide, dims: Dimensions): string {
    const s = dims.scale;
    const mono = slide.mono
      ? `<div class="mono">${this.escapeHtml(slide.mono)}</div>`
      : '';

    switch (slide.type) {
      case 'hook':
        return `${mono}
  <h1 class="h1">${slide.title ?? ''}</h1>
  ${slide.body ? `<p class="body">${slide.body}</p>` : ''}`;

      case 'context':
        return `${mono}
  <h1 class="h1">${slide.title ?? ''}</h1>
  ${slide.body ? `<p class="body">${slide.body}</p>` : ''}`;

      case 'step':
        return `${mono}
  ${slide.stepNumber ? `<div class="step-num">${this.escapeHtml(slide.stepNumber)}</div>` : ''}
  <h2 class="step-title">${slide.title ?? ''}</h2>
  ${slide.body ? `<p class="step-desc">${slide.body}</p>` : ''}`;

      case 'metric':
        return `${mono}
  ${slide.metricValue ? `<div class="metric-val grad-text">${this.escapeHtml(slide.metricValue)}</div>` : ''}
  ${slide.metricLabel ? `<div class="metric-label">${this.escapeHtml(slide.metricLabel)}</div>` : ''}
  ${slide.body ? `<p class="body" style="margin-top:${Math.round(24 * s)}px">${slide.body}</p>` : ''}`;

      case 'testimonial':
        return `${mono}
  <div class="quote-block">
    <p class="quote-text">"${this.escapeHtml(slide.quote ?? '')}"</p>
    ${slide.quoteAuthor ? `<div class="quote-author">— ${this.escapeHtml(slide.quoteAuthor)}</div>` : ''}
  </div>`;

      case 'summary':
        return `${mono}
  <h1 class="h1">${slide.title ?? ''}</h1>
  ${slide.body ? `<p class="body">${slide.body}</p>` : ''}`;

      case 'cta':
        return `${mono}
  <div class="cta-box">
    <h2>${slide.ctaText ?? slide.title ?? ''}</h2>
    ${slide.body ? `<p>${slide.body}</p>` : ''}
    ${slide.ctaButton ? `<span class="cta-btn">${this.escapeHtml(slide.ctaButton)}</span>` : ''}
  </div>`;

      default:
        return `${mono}
  <h1 class="h1">${slide.title ?? ''}</h1>
  ${slide.body ? `<p class="body">${slide.body}</p>` : ''}`;
    }
  }

  // ---------------------------------------------------------------------------
  // Post text
  // ---------------------------------------------------------------------------

  private buildPostText(
    title: string,
    slides: CarouselSlide[],
    brand: BrandConfig,
  ): string {
    // Build a 100-200 word LinkedIn post from the slide content.
    const hook = slides.find((sl) => sl.type === 'hook');
    const summary = slides.find((sl) => sl.type === 'summary');
    const cta = slides.find((sl) => sl.type === 'cta');

    const headline = hook?.title ?? title;
    const summaryText = summary?.body ?? '';
    const ctaText = cta?.ctaText ?? '';

    const parts: string[] = [
      headline,
      '',
      summaryText,
      '',
      ctaText
        ? `${ctaText}`
        : `Swipe through the carousel for the full breakdown →`,
      '',
      `Follow ${brand.name} for more.`,
    ].filter((p) => p !== null);

    let post = parts.join('\n');
    // Trim if too long (LinkedIn max ~3000 chars, but we target 100-200 words)
    if (post.length > 1200) {
      post = post.slice(0, 1200).trim() + '…';
    }
    return post;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
