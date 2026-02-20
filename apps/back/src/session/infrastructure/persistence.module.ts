import { Module } from '@nestjs/common';
import { SessionRepository } from './session.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SessionEntity } from './entities/session.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SessionEntity])],
  providers: [
    SessionRepository,
  ],
  exports: [SessionRepository],
})
export class SessionPersistenceModule {}
