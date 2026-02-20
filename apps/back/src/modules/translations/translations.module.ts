import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LangEntity } from './infrastructure/entities/lang.entity';
import { TranslationEntity } from './infrastructure/entities/translation.entity';
import { TranslationsService } from './translations.service';
import { TranslationsController } from './translations.controller';
import { TranslationSeedService } from './infrastructure/seeds/translation-seed.service';

@Module({
  imports: [TypeOrmModule.forFeature([LangEntity, TranslationEntity])],
  providers: [TranslationsService, TranslationSeedService],
  controllers: [TranslationsController],
  exports: [TranslationsService, TranslationSeedService],
})
export class TranslationsModule {}
