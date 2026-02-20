import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FileEntity } from './entities/file.entity';
import { FileRepository } from './file.repository';

@Module({
  imports: [TypeOrmModule.forFeature([FileEntity])],
  providers: [
    FileRepository,
  ],
  exports: [FileRepository],
})
export class FilePersistenceModule {}
