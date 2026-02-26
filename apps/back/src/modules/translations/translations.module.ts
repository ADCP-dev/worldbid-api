import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LangEntity } from './infrastructure/entities/lang.entity';
import { TranslationEntity } from './infrastructure/entities/translation.entity';
import { TranslationsService } from './translations.service';
import { TranslationsController } from './translations.controller';
import { TranslationSeedService } from './infrastructure/seeds/translation-seed.service';
import { ConfigModule } from '@nestjs/config';
import { TranslationAgentService } from './translation-agent.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([LangEntity, TranslationEntity]),
    ConfigModule,
  ],
  providers: [
    TranslationsService,
    TranslationSeedService,
    TranslationAgentService,
  ],
  controllers: [TranslationsController],
  exports: [
    TranslationsService,
    TranslationSeedService,
    TranslationAgentService,
  ],
})
export class TranslationsModule {}
