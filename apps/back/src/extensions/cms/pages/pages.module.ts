import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PagesController } from './pages.controller';
import { PagesService } from './pages.service';
import { PageEntity } from './infrastructure/entities/page.entity';
import { TranslationEntity } from '@src/modules/translations/infrastructure/entities/translation.entity';
import { SeoModule } from '../seo/seo.module';
import { TranslationsModule } from '@src/modules/translations/translations.module';
import { FilesModule } from '@storage/files/files.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PageEntity, TranslationEntity]),
    SeoModule,
    TranslationsModule,
    FilesModule.register(),
  ],
  controllers: [PagesController],
  providers: [PagesService],
  exports: [PagesService],
})
export class PagesModule {}
