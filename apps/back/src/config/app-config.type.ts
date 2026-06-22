export type AppConfig = {
  nodeEnv: string;
  name: string;
  workingDirectory: string;
  frontendDomain?: string;
  frontendDomains?: string;
  backendDomain: string;
  port: number;
  apiPrefix: string;
  fallbackLanguage: string;
  headerLanguage: string;
  bunnyCdnUrl?: string;
  cdnBaseUrl?: string;
  openRouterApiKey?: string;
  translationModel?: string;
};
