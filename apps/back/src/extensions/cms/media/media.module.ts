import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { FileEntity } from '@storage/files/infrastructure/entities/file.entity';
import { FilesLocalModule } from '@storage/files/infrastructure/uploader/local/files.module';

@Module({
  imports: [TypeOrmModule.forFeature([FileEntity]), FilesLocalModule],
  controllers: [MediaController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
