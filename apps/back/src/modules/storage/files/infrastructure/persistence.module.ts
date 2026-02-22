import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileEntity } from '@storage/files/infrastructure/entities/file.entity';
import { FileRepository } from '@storage/files/infrastructure/file.repository';

@Module({
  imports: [TypeOrmModule.forFeature([FileEntity])],
  providers: [
    FileRepository,
  ],
  exports: [FileRepository],
})
export class FilePersistenceModule {}
