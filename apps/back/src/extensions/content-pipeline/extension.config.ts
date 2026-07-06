import { registerAs } from '@nestjs/config';
import { IsString, IsOptional } from 'class-validator';
import validateConfig from '@infra/utils/validate-config';
import type { ContentPipelineConfig } from '@ext/content-pipeline/config/content-pipeline-config.type';

class EnvironmentVariablesValidator {
  @IsString() @IsOptional()
  TAVILY_API_KEY: string;

  @IsString() @IsOptional()
  TAVILY_BASE_URL: string;

  @IsString() @IsOptional()
  TAVILY_MAX_RESULTS: string;

  @IsString() @IsOptional()
  OLLAMA_BASE_URL: string;

  @IsString() @IsOptional()
  OLLAMA_MODEL: string;

  @IsString() @IsOptional()
  OLLAMA_API_KEY: string;

  @IsString() @IsOptional()
  WAVESPEED_API_KEY: string;

  @IsString() @IsOptional()
  WAVESPEED_DEFAULT_MODEL: string;

  @IsString() @IsOptional()
  WAVESPEED_BASE_URL: string;

  @IsString() @IsOptional()
  CONTENT_PIPELINE_MAX_IDEAS: string;

  @IsString() @IsOptional()
  CONTENT_PIPELINE_NOTIFICATION_EMAIL: string;

  @IsString() @IsOptional()
  CONTENT_PIPELINE_FFMPEG_PATH: string;

  @IsString() @IsOptional()
  CONTENT_PIPELINE_FONT_PATH: string;

  @IsString() @IsOptional()
  CONTENT_PIPELINE_CHROMIUM_PATH: string;

  @IsString() @IsOptional()
  CONTENT_PIPELINE_CHROMIUM_LIB_DIR: string;

  @IsString() @IsOptional()
  CONTENT_PIPELINE_CTA_VIDEO_PATH: string;
}

export default registerAs<ContentPipelineConfig>('content-pipeline', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);
  return {
    tavilyApiKey: process.env.TAVILY_API_KEY,
    tavilyBaseUrl: process.env.TAVILY_BASE_URL ?? 'https://api.tavily.com',
    tavilyMaxResults: process.env.TAVILY_MAX_RESULTS
      ? Number(process.env.TAVILY_MAX_RESULTS)
      : 8,
    maxIdeasPerRun: process.env.CONTENT_PIPELINE_MAX_IDEAS
      ? Number(process.env.CONTENT_PIPELINE_MAX_IDEAS)
      : 5,
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? 'https://api.ollama.cloud/v1',
    ollamaModel: process.env.OLLAMA_MODEL ?? 'glm-5.2',
    ollamaApiKey: process.env.OLLAMA_API_KEY,
    ollamaTimeoutMs: 60_000,
    wavespeedApiKey: process.env.WAVESPEED_API_KEY,
    wavespeedDefaultModel:
      process.env.WAVESPEED_DEFAULT_MODEL ?? 'flux-2-klein',
    wavespeedBaseUrl:
      process.env.WAVESPEED_BASE_URL ?? 'https://api.wavespeed.ai',
    notificationEmail: process.env.CONTENT_PIPELINE_NOTIFICATION_EMAIL,
    llmApiKey: process.env.OLLAMA_API_KEY,
    ffmpegPath:
      process.env.CONTENT_PIPELINE_FFMPEG_PATH ??
      '/home/hermeswebui/.local/bin/ffmpeg',
    fontPath:
      process.env.CONTENT_PIPELINE_FONT_PATH ??
      '/home/hermeswebui/.local/share/fonts/DejaVuSans-Bold.ttf',
    chromiumPath:
      process.env.CONTENT_PIPELINE_CHROMIUM_PATH ??
      '/home/hermeswebui/.hermes/home/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell',
    chromiumLibDir:
      process.env.CONTENT_PIPELINE_CHROMIUM_LIB_DIR ??
      '/home/hermeswebui/.hermes/home/.local/lib/usr/lib/x86_64-linux-gnu',
    ctaVideoPath: process.env.CONTENT_PIPELINE_CTA_VIDEO_PATH,
  };
});