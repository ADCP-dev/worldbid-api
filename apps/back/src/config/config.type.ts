import { AppConfig } from './app-config.type';
import { AppleConfig } from '@iam/auth-apple/config/apple-config.type';
import { AuthConfig } from '@iam/auth/config/auth-config.type';
import { DatabaseConfig } from '@infra/database/config/database-config.type';
import { FacebookConfig } from '@iam/auth-facebook/config/facebook-config.type';
import { FileConfig } from '@storage/files/config/file-config.type';
import { GoogleConfig } from '@iam/auth-google/config/google-config.type';
import { MailConfig } from '@comms/mail/config/mail-config.type';
import { StripeConfig } from '@ext/stripe/config/stripe-config.type';
import { UploadPostConfig } from '@ext/upload-post/config/upload-post-config.type';
import { WorkerConfig } from './worker-config.type';

export type AllConfigType = {
  app: AppConfig;
  apple: AppleConfig;
  auth: AuthConfig;
  database: DatabaseConfig;
  facebook: FacebookConfig;
  file: FileConfig;
  google: GoogleConfig;
  mail: MailConfig;
  stripe: StripeConfig;
  'upload-post': UploadPostConfig;
  worker: WorkerConfig;
};
