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
  /** Legacy alias kept for the provider's inert check. */
  llmApiKey?: string;
};