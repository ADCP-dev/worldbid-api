import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AllConfigType } from '@src/config/config.type';
import type { ContentPipelineConfig } from '@ext/content-pipeline/config/content-pipeline-config.type';
import {
  CarouselGeneratorService,
  SOM_OS_BRAND,
} from '@ext/content-pipeline/services/carousel-generator.service';
import type {
  CarouselSlide,
  BrandConfig,
} from '@ext/content-pipeline/services/carousel-generator.service';
import { HtmlRendererService } from '@ext/content-pipeline/services/html-renderer.service';
import {
  VideoGeneratorService,
} from '@ext/content-pipeline/services/video-generator.service';
import type { VideoSlide } from '@ext/content-pipeline/services/video-generator.service';
import { CtaVideoService } from '@ext/content-pipeline/services/cta-video.service';
import type { GenerateFromTemplateDto } from '@ext/content-pipeline/dto/generate-from-template.dto';

export type TemplateType =
  | 'before-after'
  | 'product-showcase'
  | 'presentation'
  | 'tutorial'
  | 'case-study'
  | 'faq'
  | 'comparison'
  | 'timeline'
  | 'problem-solution'
  | 'quote-insight'
  | 'custom';

export type SlotType =
  | 'before'
  | 'after'
  | 'front'
  | 'back'
  | 'feature'
  | 'title'
  | 'agenda'
  | 'content'
  | 'summary'
  | 'hook'
  | 'step'
  | 'result'
  | 'problem'
  | 'solution'
  | 'implementation'
  | 'metric'
  | 'testimonial'
  | 'cta'
  | 'question'
  | 'answer'
  | 'feature-a'
  | 'feature-b'
  | 'verdict'
  | 'milestone'
  | 'current-state'
  | 'why-fail'
  | 'approach'
  | 'how-it-works'
  | 'quote'
  | 'context'
  | 'expansion'
  | 'takeaway';

export interface TemplateSlot {
  /** Position in the sequence (0-based). */
  position: number;
  /** What type of content fills this slot. */
  slotType: SlotType;
  /** Default label/placeholder for this slot. */
  label: string;
  /** Whether this slot accepts an image URL (vs generated HTML slide). */
  acceptImage?: boolean;
  /** Whether this slot is required. */
  required?: boolean;
}

export interface VideoTemplate {
  type: TemplateType;
  name: string;
  description: string;
  slots: TemplateSlot[];
  defaultTransitions: string[];
  defaultSlideDurationSec: number;
  appendCtaVideo: boolean;
  ctaVideoUrl?: string;
  format: 'portrait' | 'vertical';
}

export interface TemplateFillSlotContent {
  imageUrl?: string;
  slide?: CarouselSlide;
}

export interface TemplateFillData {
  slots: { [position: number]: TemplateFillSlotContent };
  transitions?: string[];
  slideDurationSec?: number;
  ctaVideoUrl?: string;
  format?: 'portrait' | 'vertical';
}

export interface TemplateVideoResult {
  videoPath: string;
  durationSec: number;
  sizeBytes: number;
  carouselHtml: string[];
  postText: string;
  ctaVideoUrl: string;
  templateType: TemplateType;
}

// ---------------------------------------------------------------------------
// Predefined templates
// ---------------------------------------------------------------------------

const BEFORE_AFTER_TEMPLATE: VideoTemplate = {
  type: 'before-after',
  name: 'Antes / Después',
  description:
    'Muestra la transformación: estado anterior → estado después → resultado medible. CTA al final.',
  slots: [
    {
      position: 0,
      slotType: 'before',
      label: 'Estado anterior',
      acceptImage: true,
      required: true,
    },
    {
      position: 1,
      slotType: 'after',
      label: 'Estado después',
      acceptImage: true,
      required: true,
    },
    {
      position: 2,
      slotType: 'metric',
      label: 'Resultado medible',
      required: false,
    },
  ],
  defaultTransitions: ['slideleft', 'fade'],
  defaultSlideDurationSec: 3,
  appendCtaVideo: true,
  format: 'vertical',
};

const PRODUCT_SHOWCASE_TEMPLATE: VideoTemplate = {
  type: 'product-showcase',
  name: 'Product Showcase',
  description:
    'Vista frontal → vista posterior → 2 características destacadas. CTA al final.',
  slots: [
    {
      position: 0,
      slotType: 'front',
      label: 'Vista frontal',
      acceptImage: true,
      required: true,
    },
    {
      position: 1,
      slotType: 'back',
      label: 'Vista posterior',
      acceptImage: true,
      required: true,
    },
    {
      position: 2,
      slotType: 'feature',
      label: 'Característica destacada',
      required: true,
    },
    {
      position: 3,
      slotType: 'feature',
      label: 'Característica destacada',
      required: true,
    },
  ],
  defaultTransitions: ['circleopen', 'slideleft', 'fade'],
  defaultSlideDurationSec: 3,
  appendCtaVideo: true,
  format: 'vertical',
};

const PRESENTATION_TEMPLATE: VideoTemplate = {
  type: 'presentation',
  name: 'Presentation',
  description:
    'Título → agenda → 3 slides de contenido → resumen. CTA al final.',
  slots: [
    {
      position: 0,
      slotType: 'title',
      label: 'Título',
      required: true,
    },
    {
      position: 1,
      slotType: 'agenda',
      label: 'Agenda',
      required: true,
    },
    {
      position: 2,
      slotType: 'content',
      label: 'Contenido',
      required: true,
    },
    {
      position: 3,
      slotType: 'content',
      label: 'Contenido',
      required: true,
    },
    {
      position: 4,
      slotType: 'content',
      label: 'Contenido',
      required: true,
    },
    {
      position: 5,
      slotType: 'summary',
      label: 'Resumen',
      required: true,
    },
  ],
  defaultTransitions: ['fade', 'slideleft', 'slideright', 'fade', 'wipeup'],
  defaultSlideDurationSec: 3,
  appendCtaVideo: true,
  format: 'vertical',
};

const TUTORIAL_TEMPLATE: VideoTemplate = {
  type: 'tutorial',
  name: 'Tutorial',
  description:
    'Hook → Paso 1 → Paso 2 → Paso 3 → Resultado. CTA al final.',
  slots: [
    {
      position: 0,
      slotType: 'hook',
      label: 'Hook',
      required: true,
    },
    {
      position: 1,
      slotType: 'step',
      label: 'Paso N',
      required: true,
    },
    {
      position: 2,
      slotType: 'step',
      label: 'Paso N',
      required: true,
    },
    {
      position: 3,
      slotType: 'step',
      label: 'Paso N',
      required: true,
    },
    {
      position: 4,
      slotType: 'result',
      label: 'Resultado',
      acceptImage: true,
      required: true,
    },
  ],
  defaultTransitions: ['fade', 'slideleft', 'slideup', 'circleopen', 'fade'],
  defaultSlideDurationSec: 3,
  appendCtaVideo: true,
  format: 'vertical',
};

const CASE_STUDY_TEMPLATE: VideoTemplate = {
  type: 'case-study',
  name: 'Case Study',
  description:
    'Problema → solución → implementación → resultados (métricas) → testimonio. CTA al final.',
  slots: [
    {
      position: 0,
      slotType: 'problem',
      label: 'Problema',
      required: true,
    },
    {
      position: 1,
      slotType: 'solution',
      label: 'Solución',
      required: true,
    },
    {
      position: 2,
      slotType: 'implementation',
      label: 'Implementación',
      required: true,
    },
    {
      position: 3,
      slotType: 'metric',
      label: 'Resultados',
      required: true,
    },
    {
      position: 4,
      slotType: 'testimonial',
      label: 'Testimonio',
      required: true,
    },
  ],
  defaultTransitions: ['fade', 'slideleft', 'wipeup', 'circleopen', 'fade'],
  defaultSlideDurationSec: 3,
  appendCtaVideo: true,
  format: 'vertical',
};

const FAQ_TEMPLATE: VideoTemplate = {
  type: 'faq',
  name: 'FAQ',
  description:
    'Tres preguntas frecuentes con sus respuestas. CTA al final. Mínimo 1 Q/A.',
  slots: [
    {
      position: 0,
      slotType: 'question',
      label: 'Pregunta frecuente 1',
      required: true,
    },
    {
      position: 1,
      slotType: 'answer',
      label: 'Respuesta 1',
      required: true,
    },
    {
      position: 2,
      slotType: 'question',
      label: 'Pregunta frecuente 2',
    },
    {
      position: 3,
      slotType: 'answer',
      label: 'Respuesta 2',
    },
    {
      position: 4,
      slotType: 'question',
      label: 'Pregunta frecuente 3',
    },
    {
      position: 5,
      slotType: 'answer',
      label: 'Respuesta 3',
    },
  ],
  defaultTransitions: ['fade', 'slideleft', 'fade', 'slideleft', 'fade'],
  defaultSlideDurationSec: 3,
  appendCtaVideo: true,
  format: 'vertical',
};

const COMPARISON_TEMPLATE: VideoTemplate = {
  type: 'comparison',
  name: 'Comparativa',
  description:
    'Comparativa X vs Y: hook → características A → características B → veredicto. CTA al final.',
  slots: [
    {
      position: 0,
      slotType: 'hook',
      label: 'Comparativa: X vs Y',
      required: true,
    },
    {
      position: 1,
      slotType: 'feature-a',
      label: 'Opción A — Características',
      required: true,
    },
    {
      position: 2,
      slotType: 'feature-b',
      label: 'Opción B — Características',
      required: true,
    },
    {
      position: 3,
      slotType: 'verdict',
      label: 'Veredicto',
      required: true,
    },
  ],
  defaultTransitions: ['slideleft', 'slideright', 'circleopen', 'fade'],
  defaultSlideDurationSec: 3.5,
  appendCtaVideo: true,
  format: 'vertical',
};

const TIMELINE_TEMPLATE: VideoTemplate = {
  type: 'timeline',
  name: 'Línea de tiempo',
  description:
    'Hitos cronológicos: hito inicial → 2-3 hitos → estado actual. CTA al final.',
  slots: [
    {
      position: 0,
      slotType: 'title',
      label: 'Hito inicial',
      required: true,
    },
    {
      position: 1,
      slotType: 'milestone',
      label: 'Hito 2',
      required: true,
    },
    {
      position: 2,
      slotType: 'milestone',
      label: 'Hito 3',
    },
    {
      position: 3,
      slotType: 'milestone',
      label: 'Hito 4',
    },
    {
      position: 4,
      slotType: 'current-state',
      label: 'Estado actual',
      required: true,
    },
  ],
  defaultTransitions: ['wipeup', 'slideleft', 'wipeup', 'fade'],
  defaultSlideDurationSec: 3,
  appendCtaVideo: true,
  format: 'vertical',
};

const PROBLEM_SOLUTION_TEMPLATE: VideoTemplate = {
  type: 'problem-solution',
  name: 'Problema / Solución',
  description:
    'Problema → por qué fallan las soluciones actuales → nuestro enfoque → cómo funciona. CTA al final.',
  slots: [
    {
      position: 0,
      slotType: 'problem',
      label: 'El problema',
      required: true,
    },
    {
      position: 1,
      slotType: 'why-fail',
      label: 'Por qué las soluciones actuales fallan',
      required: true,
    },
    {
      position: 2,
      slotType: 'approach',
      label: 'Nuestro enfoque',
      required: true,
    },
    {
      position: 3,
      slotType: 'how-it-works',
      label: 'Cómo funciona',
      required: true,
    },
  ],
  defaultTransitions: ['fade', 'slideleft', 'circleopen', 'fade'],
  defaultSlideDurationSec: 3.5,
  appendCtaVideo: true,
  format: 'vertical',
};

const QUOTE_INSIGHT_TEMPLATE: VideoTemplate = {
  type: 'quote-insight',
  name: 'Cita / Insight',
  description:
    'Cita o insight → contexto → desarrollo de la idea → takeaway. CTA al final.',
  slots: [
    {
      position: 0,
      slotType: 'quote',
      label: 'Cita/Insight',
      required: true,
    },
    {
      position: 1,
      slotType: 'context',
      label: 'Contexto',
      required: true,
    },
    {
      position: 2,
      slotType: 'expansion',
      label: 'Desarrollo de la idea',
      required: true,
    },
    {
      position: 3,
      slotType: 'takeaway',
      label: 'Takeaway',
      required: true,
    },
  ],
  defaultTransitions: ['fade', 'fade', 'slideleft', 'fade'],
  defaultSlideDurationSec: 4,
  appendCtaVideo: true,
  format: 'vertical',
};

const PREDEFINED_TEMPLATES: Record<Exclude<TemplateType, 'custom'>, VideoTemplate> = {
  'before-after': BEFORE_AFTER_TEMPLATE,
  'product-showcase': PRODUCT_SHOWCASE_TEMPLATE,
  presentation: PRESENTATION_TEMPLATE,
  tutorial: TUTORIAL_TEMPLATE,
  'case-study': CASE_STUDY_TEMPLATE,
  faq: FAQ_TEMPLATE,
  comparison: COMPARISON_TEMPLATE,
  timeline: TIMELINE_TEMPLATE,
  'problem-solution': PROBLEM_SOLUTION_TEMPLATE,
  'quote-insight': QUOTE_INSIGHT_TEMPLATE,
};

const VALID_TEMPLATE_TYPES = new Set<string>(Object.keys(PREDEFINED_TEMPLATES));
VALID_TEMPLATE_TYPES.add('custom');

/**
 * Video Template System.
 *
 * Manages 10 predefined video templates that structure content slides into
 * specific narrative arcs and always append a pre-configured CTA video clip
 * at the end (unless disabled).
 *
 * Pipeline: template slots → carousel HTML (text slots) + images (image slots)
 *           → PNG screenshots → MP4 with xfade transitions → concat CTA video.
 */
@Injectable()
export class VideoTemplateService {
  private readonly logger = new Logger(VideoTemplateService.name);
  private readonly cfg: ContentPipelineConfig | null;
  /** Runtime override for the global CTA video URL (set via setCtaVideo). */
  private ctaVideoUrlOverride: string | null = null;

  constructor(
    private readonly configService: ConfigService<AllConfigType>,
    private readonly carouselGeneratorService: CarouselGeneratorService,
    private readonly htmlRendererService: HtmlRendererService,
    private readonly videoGeneratorService: VideoGeneratorService,
    private readonly ctaVideoService: CtaVideoService,
  ) {
    this.cfg = this.configService.get('content-pipeline', { infer: true }) ?? null;
  }

  /**
   * Return all available predefined templates.
   */
  listTemplates(): VideoTemplate[] {
    return Object.values(PREDEFINED_TEMPLATES);
  }

  /**
   * Return a predefined template by type.
   * Throws if the template type is unknown or 'custom' (custom has no preset).
   */
  getTemplate(type: TemplateType): VideoTemplate {
    if (type === 'custom') {
      throw new Error(
        "Template type 'custom' has no predefined structure — build the VideoTemplate manually",
      );
    }
    const tpl = PREDEFINED_TEMPLATES[type as Exclude<TemplateType, 'custom'>];
    if (!tpl) {
      throw new Error(`Unknown template type: ${type}`);
    }
    return tpl;
  }

  /**
   * Set the global CTA video URL at runtime (overrides config + DB).
   * The URL must point to an existing MP4 (S3 presigned or public).
   */
  setCtaVideo(url: string): void {
    this.ctaVideoUrlOverride = url;
    this.logger.log(`CTA video URL override set: ${url}`);
  }

  /**
   * Return the CTA video URL: runtime override → template override →
   * global config → active CTA video in DB. Returns empty string if none.
   */
  async getCtaVideoUrl(templateOverride?: string): Promise<string> {
    if (this.ctaVideoUrlOverride) return this.ctaVideoUrlOverride;
    if (templateOverride) return templateOverride;
    if (this.cfg?.ctaVideoUrl) return this.cfg.ctaVideoUrl;
    // Fallback: query the active CTA video from the DB.
    return this.ctaVideoService.findActiveUrl();
  }

  /**
   * Orchestrate the full template video pipeline:
   *   1. Get template definition
   *   2. Separate image slots from text slots
   *   3. Generate HTML slides for text slots (CarouselGeneratorService)
   *   4. Render HTML → PNG (HtmlRendererService)
   *   5. Build VideoSlide[] from rendered PNGs + image URLs
   *   6. Generate MP4 with xfade transitions (VideoGeneratorService)
   *   7. Concatenate content video + CTA video (VideoGeneratorService.concatWithCta)
   *   8. Return result with video path, durations, post text
   */
  async generateFromTemplate(params: {
    template: TemplateType;
    fillData: TemplateFillData;
    brandConfig?: BrandConfig;
  }): Promise<TemplateVideoResult> {
    const tpl = this.getTemplate(params.template);
    const fillData = params.fillData ?? { slots: {} };
    const brand = params.brandConfig ?? SOM_OS_BRAND;
    const format = fillData.format ?? tpl.format;
    const slideDuration = fillData.slideDurationSec ?? tpl.defaultSlideDurationSec;
    const transitions = fillData.transitions ?? tpl.defaultTransitions;

    this.logger.log(
      `generateFromTemplate type=${tpl.type}: ${tpl.slots.length} slots, format=${format}, duration=${slideDuration}s`,
    );

    // Validate required slots are filled
    for (const slot of tpl.slots) {
      if (slot.required && !fillData.slots[slot.position]) {
        throw new Error(
          `Required slot ${slot.position} (${slot.slotType}: "${slot.label}") is not filled`,
        );
      }
    }

    // 1. Build ordered list of filled slots
    const ordered = tpl.slots
      .filter((s) => fillData.slots[s.position])
      .sort((a, b) => a.position - b.position);

    if (ordered.length === 0) {
      throw new Error(`No slots filled for template ${tpl.type}`);
    }

    // 2. Separate image-based and text-based slides
    const carouselSlides: CarouselSlide[] = [];
    const carouselSlotIndices: number[] = []; // index in `ordered` for each carousel slide
    const imageSlots: { index: number; imageUrl: string }[] = [];

    for (let i = 0; i < ordered.length; i++) {
      const slot = ordered[i];
      const fill = fillData.slots[slot.position];
      if (!fill) continue;

      if (fill.imageUrl) {
        imageSlots.push({ index: i, imageUrl: fill.imageUrl });
      } else if (fill.slide) {
        carouselSlides.push(this.normalizeSlide(fill.slide, slot));
        carouselSlotIndices.push(i);
      } else {
        // Fallback: build a minimal slide from the slot label
        carouselSlides.push(this.slideFromSlot(slot));
        carouselSlotIndices.push(i);
      }
    }

    // 3. Generate carousel HTML for text slots
    let carouselHtml: string[] = [];
    let postText = '';
    if (carouselSlides.length > 0) {
      const carousel = await this.carouselGeneratorService.generateCarouselSlides({
        title: tpl.name,
        slides: carouselSlides,
        brandConfig: brand,
        format,
      });
      carouselHtml = carousel.htmlContents;
      postText = carousel.postText;
    }

    // 4. Render carousel HTML → PNG
    const pngDir = await mkdtemp(join(tmpdir(), 'cp-tpl-png-'));
    let pngPaths: string[] = [];
    if (carouselHtml.length > 0) {
      const height = format === 'portrait' ? 1350 : 1920;
      pngPaths = await this.htmlRendererService.renderToPng({
        htmlContents: carouselHtml,
        width: 1080,
        height,
        outputDir: pngDir,
      });
    }

    // 5. Build VideoSlide[] ordered by template position
    //    Map each carousel slide → its PNG, image slots → their URL
    const videoSlides: VideoSlide[] = [];
    const carouselPngMap = new Map<number, string>();
    for (let c = 0; c < carouselSlotIndices.length; c++) {
      const orderedIdx = carouselSlotIndices[c];
      const png = pngPaths[c];
      if (png) carouselPngMap.set(orderedIdx, png);
    }
    const imageMap = new Map<number, string>();
    for (const img of imageSlots) {
      imageMap.set(img.index, img.imageUrl);
    }

    for (let i = 0; i < ordered.length; i++) {
      const slot = ordered[i];
      const png = carouselPngMap.get(i);
      const imageUrl = imageMap.get(i);
      if (png) {
        const cs = carouselSlides[carouselSlotIndices.indexOf(i)];
        videoSlides.push({
          imageUrl: png,
          text: cs?.title ?? cs?.body ?? slot.label,
        });
      } else if (imageUrl) {
        videoSlides.push({ imageUrl, text: slot.label });
      }
    }

    if (videoSlides.length === 0) {
      throw new Error(`No video slides produced for template ${tpl.type}`);
    }

    // 6. Generate content MP4 with xfade transitions
    const contentVideoDir = await mkdtemp(join(tmpdir(), 'cp-tpl-content-'));
    const contentVideo = await this.videoGeneratorService.generateVideo({
      slides: videoSlides,
      transitions,
      slideDurationSec: slideDuration,
      enableSubtitles: true,
      outputDir: contentVideoDir,
    });

    // 7. Concatenate CTA video if configured
    let finalVideoPath = contentVideo.videoPath;
    let finalDuration = contentVideo.durationSec;
    let finalSize = contentVideo.sizeBytes;
    let ctaVideoUrl = '';

    if (tpl.appendCtaVideo) {
      ctaVideoUrl =
        fillData.ctaVideoUrl ??
        (await this.getCtaVideoUrl(tpl.ctaVideoUrl));
      if (ctaVideoUrl) {
        this.logger.log(
          `Concatenating CTA video: ${ctaVideoUrl} after content (${contentVideo.durationSec}s)`,
        );
        const ctaOutDir = await mkdtemp(join(tmpdir(), 'cp-tpl-final-'));
        const finalVideo = await this.videoGeneratorService.concatWithCta({
          contentVideoPath: contentVideo.videoPath,
          ctaVideoUrl,
          outputDir: ctaOutDir,
          transitionDuration: 0.5,
        });
        finalVideoPath = finalVideo.videoPath;
        finalDuration = finalVideo.durationSec;
        finalSize = finalVideo.sizeBytes;
      } else {
        this.logger.warn(
          `Template ${tpl.type} has appendCtaVideo=true but no CTA video URL is configured — skipping CTA`,
        );
      }
    }

    this.logger.log(
      `Template video ready: ${finalVideoPath} (${finalDuration}s, ${finalSize} bytes)`,
    );

    return {
      videoPath: finalVideoPath,
      durationSec: finalDuration,
      sizeBytes: finalSize,
      carouselHtml,
      postText,
      ctaVideoUrl,
      templateType: tpl.type,
    };
  }

  /**
   * Adapter for the controller DTO: converts the loose DTO into the internal
   * TemplateFillData structure expected by generateFromTemplate.
   */
  async generateFromDto(dto: GenerateFromTemplateDto): Promise<TemplateVideoResult> {
    const fillData: TemplateFillData = {
      slots: {},
      transitions: dto.transitions,
      slideDurationSec: dto.slideDurationSec,
      ctaVideoUrl: dto.ctaVideoUrl,
      format: dto.format,
    };
    if (dto.slots) {
      for (const [key, val] of Object.entries(dto.slots)) {
        const pos = Number(key);
        if (Number.isNaN(pos)) continue;
        if (!val) continue;
        fillData.slots[pos] = {
          imageUrl: val.imageUrl,
          slide: val.slide as CarouselSlide | undefined,
        };
      }
    }
    return this.generateFromTemplate({
      template: dto.template as TemplateType,
      fillData,
    });
  }

  /** Type guard helper to validate a string is a known TemplateType. */
  isValidTemplateType(type: string): type is TemplateType {
    return VALID_TEMPLATE_TYPES.has(type);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Normalize a loose carousel slide object into a typed CarouselSlide.
   * Maps template slotTypes to CarouselSlide types when the caller did not
   * provide a `type` field on the slide.
   */
  private normalizeSlide(raw: CarouselSlide, slot: TemplateSlot): CarouselSlide {
    const base: CarouselSlide = { ...raw };
    if (!base.type || !this.isCarouselType(base.type)) {
      base.type = this.slotToCarouselType(slot.slotType);
    }
    if (!base.mono) {
      base.mono = slot.label.toUpperCase();
    }
    return base;
  }

  /** Build a minimal placeholder CarouselSlide from a slot definition. */
  private slideFromSlot(slot: TemplateSlot): CarouselSlide {
    return {
      type: this.slotToCarouselType(slot.slotType),
      mono: slot.label.toUpperCase(),
      title: slot.label,
    };
  }

  /** Map a template slotType to the closest CarouselSlide type. */
  private slotToCarouselType(
    slotType: SlotType,
  ): CarouselSlide['type'] {
    const map: Record<SlotType, CarouselSlide['type']> = {
      before: 'context',
      after: 'context',
      front: 'context',
      back: 'context',
      feature: 'context',
      title: 'hook',
      agenda: 'context',
      content: 'context',
      summary: 'summary',
      hook: 'hook',
      step: 'step',
      result: 'summary',
      problem: 'context',
      solution: 'context',
      implementation: 'context',
      metric: 'metric',
      testimonial: 'testimonial',
      cta: 'cta',
      question: 'hook',
      answer: 'context',
      'feature-a': 'step',
      'feature-b': 'step',
      verdict: 'summary',
      milestone: 'step',
      'current-state': 'summary',
      'why-fail': 'context',
      approach: 'hook',
      'how-it-works': 'step',
      quote: 'hook',
      context: 'context',
      expansion: 'step',
      takeaway: 'summary',
    };
    return map[slotType] ?? 'context';
  }

  private isCarouselType(t: string): t is CarouselSlide['type'] {
    return [
      'hook',
      'context',
      'step',
      'metric',
      'testimonial',
      'summary',
      'cta',
    ].includes(t);
  }
}