import type { AppConfig } from './app-config.type';
import type { AppleConfig } from '@iam/auth-apple/config/apple-config.type';
import type { AuthConfig } from '@iam/auth/config/auth-config.type';
import type { DatabaseConfig } from '@infra/database/config/database-config.type';
import type { FacebookConfig } from '@iam/auth-facebook/config/facebook-config.type';
import type { FileConfig } from '@storage/files/config/file-config.type';
import type { GoogleConfig } from '@iam/auth-google/config/google-config.type';
import type { MailConfig } from '@comms/mail/config/mail-config.type';
import type { StripeConfig } from '@ext/stripe/config/stripe-config.type';
import type { UploadPostConfig } from '@ext/upload-post/config/upload-post-config.type';
import type { ContentPipelineConfig } from '@ext/content-pipeline/config/content-pipeline-config.type';
import type { AutonomousAgentConfig } from '@ext/autonomous-agent/config/autonomous-agent-config.type';
import type { WorkerConfig } from './worker-config.type';

/**
 * Aggregated config type for `ConfigService<AllConfigType>`.
 *
 * Extension config keys are OPTIONAL (`?`). When an extension is removed,
 * only its `import type` line above needs deleting — runtime is unaffected
 * because type-only imports are erased by the TypeScript compiler.
 *
 * Core (non-extension) keys remain required: they belong to the app itself
 * and cannot be deleted independently.
 */
export type AllConfigType = {
  app: AppConfig;
  apple: AppleConfig;
  auth: AuthConfig;
  database: DatabaseConfig;
  facebook: FacebookConfig;
  file: FileConfig;
  google: GoogleConfig;
  mail: MailConfig;
  // Extension config keys — optional, decoupled from core.
  stripe?: StripeConfig;
  'upload-post'?: UploadPostConfig;
  'content-pipeline'?: ContentPipelineConfig;
  'autonomous-agent'?: AutonomousAgentConfig;
  worker: WorkerConfig;
};