import { Module } from '@nestjs/common';
import { AuthModule } from '@iam/auth/auth.module';
import { AuthFacebookModule } from '@iam/auth-facebook/auth-facebook.module';
import { AuthGoogleModule } from '@iam/auth-google/auth-google.module';
import { AuthAppleModule } from '@iam/auth-apple/auth-apple.module';
import { SessionModule } from '@iam/session/session.module';
import { ApiKeysModule } from '@iam/api-keys/api-keys.module';

@Module({
  imports: [
    AuthModule,
    AuthFacebookModule,
    AuthGoogleModule,
    AuthAppleModule,
    SessionModule,
    ApiKeysModule,
  ],
  exports: [AuthModule, SessionModule, ApiKeysModule],
})
export class IamModule {}
