import { Module } from '@nestjs/common';
import { AuthFacebookService } from '@iam/auth-facebook/auth-facebook.service';
import { ConfigModule } from '@nestjs/config';
import { AuthFacebookController } from '@iam/auth-facebook/auth-facebook.controller';
import { AuthModule } from '@iam/auth/auth.module';

@Module({
  imports: [ConfigModule, AuthModule],
  providers: [AuthFacebookService],
  exports: [AuthFacebookService],
  controllers: [AuthFacebookController],
})
export class AuthFacebookModule {}
