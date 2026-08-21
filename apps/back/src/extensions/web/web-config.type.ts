export interface WebConfig {
  revalidateSecret: string | undefined;
  astroUrl: string | undefined;
}

export const WEB_EXTENSION_KEY = 'web' as const;