import { Module } from '@nestjs/common';
import { AuthGoogleService } from '@iam/auth-google/auth-google.service';
import { ConfigModule } from '@nestjs/config';
import { AuthGoogleController } from '@iam/auth-google/auth-google.controller';
import { AuthModule } from '@iam/auth/auth.module';

@Module({
  imports: [ConfigModule, AuthModule],
  providers: [AuthGoogleService],
  exports: [AuthGoogleService],
  controllers: [AuthGoogleController],
})
export class AuthGoogleModule {}
