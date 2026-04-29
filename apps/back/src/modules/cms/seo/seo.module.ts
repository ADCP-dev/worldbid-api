import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeoController } from './seo.controller';
import { SeoService } from './seo.service';
import { SeoMetadataEntity } from './infrastructure/entities/seo-metadata.entity';
import { TranslationsModule } from '@src/modules/translations/translations.module';

@Module({
  imports: [TypeOrmModule.forFeature([SeoMetadataEntity]), TranslationsModule],
  controllers: [SeoController],
  providers: [SeoService],
  exports: [SeoService],
})
export class SeoModule {}
