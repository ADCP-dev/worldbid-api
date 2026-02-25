import { Module } from '@nestjs/common';
import { AuthAppleService } from '@iam/auth-apple/auth-apple.service';
import { ConfigModule } from '@nestjs/config';
import { AuthAppleController } from '@iam/auth-apple/auth-apple.controller';
import { AuthModule } from '@iam/auth/auth.module';

@Module({
  imports: [ConfigModule, AuthModule],
  providers: [AuthAppleService],
  exports: [AuthAppleService],
  controllers: [AuthAppleController],
})
export class AuthAppleModule {}
