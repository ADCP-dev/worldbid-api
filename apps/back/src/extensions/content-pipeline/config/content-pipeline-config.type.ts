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
  /** Path to FFmpeg binary (preinstalled in Docker via apk add ffmpeg). */
  ffmpegPath?: string;
  /** Public URL to TTF font file for video subtitles (CDN/S3). Downloaded once per process. */
  fontUrl?: string;
  /** Path to Chromium binary (preinstalled in Docker via apk add chromium). */
  chromiumPath?: string;
  /** Default CTA video URL (S3 presigned or public). Per-template override via DB. */
  ctaVideoUrl?: string;
  /** Legacy alias kept for the provider's inert check. */
  llmApiKey?: string;
};