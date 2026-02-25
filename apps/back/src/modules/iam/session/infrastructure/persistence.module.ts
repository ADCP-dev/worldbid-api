import { Module } from '@nestjs/common';
import { SessionRepository } from '@iam/session/infrastructure/session.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SessionEntity } from '@iam/session/infrastructure/entities/session.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SessionEntity])],
  providers: [SessionRepository],
  exports: [SessionRepository],
})
export class SessionPersistenceModule {}
