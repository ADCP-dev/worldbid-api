import { Module } from '@nestjs/common';
import { UserRepository } from '@users/infrastructure/user.repository';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '@users/infrastructure/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
  providers: [
    UserRepository,
  ],
  exports: [UserRepository],
})
export class UserPersistenceModule {}
