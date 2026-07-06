export type ContentPipelineConfig = {
  tavilyApiKey?: string;
  tavilyBaseUrl: string;
  tavilyMaxResults?: number;
  maxIdeasPerRun?: number;
  ollamaBaseUrl: string;
  ollamaModel: string;
  ollamaApiKey?: string;
  ollamaTimeoutMs?: number;
  wavespeedApiKey?: string;
  wavespeedDefaultModel: string;
  wavespeedBaseUrl?: string;
  notificationEmail?: string;
  /** Path to FFmpeg binary (static build). Used by VideoGeneratorService. */
  ffmpegPath?: string;
  /** Path to TTF font file for subtitle overlays. */
  fontPath?: string;
  /** Path to chrome-headless-shell binary (Playwright bundled). */
  chromiumPath?: string;
  /** Path to shared libraries directory for LD_LIBRARY_PATH. */
  chromiumLibDir?: string;
  /** Legacy alias kept for the provider's inert check. */
  llmApiKey?: string;
  /** Path to a pre-configured CTA video clip (MP4) appended by VideoTemplateService. */
  ctaVideoPath?: string;
  /** Path to DESIGN.md or brand document injected into LLM prompts for style consistency. */
  designDocPath?: string;
};