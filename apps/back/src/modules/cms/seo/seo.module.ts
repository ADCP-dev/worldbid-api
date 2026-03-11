import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeoController } from './seo.controller';
import { SeoService } from './seo.service';
import { SeoMetadataEntity } from './infrastructure/entities/seo-metadata.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SeoMetadataEntity])],
  controllers: [SeoController],
  providers: [SeoService],
  exports: [SeoService],
})
export class SeoModule {}
