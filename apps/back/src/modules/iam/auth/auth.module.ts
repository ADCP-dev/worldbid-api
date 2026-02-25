import { Module } from '@nestjs/common';
import { AuthController } from '@iam/auth/auth.controller';
import { AuthService } from '@iam/auth/auth.service';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from '@iam/auth/strategies/jwt.strategy';
import { AnonymousStrategy } from '@iam/auth/strategies/anonymous.strategy';
import { JwtRefreshStrategy } from '@iam/auth/strategies/jwt-refresh.strategy';
import { ApiKeyStrategy } from '@iam/auth/strategies/api-key.strategy';
import { MailModule } from '@comms/mail/mail.module';
import { SessionModule } from '@iam/session/session.module';
import { UsersModule } from '@users/users.module';
import { ApiKeysModule } from '@iam/api-keys/api-keys.module';

@Module({
  imports: [
    UsersModule,
    SessionModule,
    PassportModule,
    MailModule,
    JwtModule.register({}),
    ApiKeysModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    JwtRefreshStrategy,
    AnonymousStrategy,
    ApiKeyStrategy,
  ],
  exports: [AuthService],
})
export class AuthModule {}
