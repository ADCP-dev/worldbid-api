/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly API_URL: string;
  readonly REVALIDATE_SECRET: string;
  readonly PUBLIC_SITE_URL: string;
  readonly ASTRO_URL: string;
  readonly NOTIFICATION_EMAIL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}