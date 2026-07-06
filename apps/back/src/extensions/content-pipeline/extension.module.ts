import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';

import { ContentPipelineProjectEntity } from '@ext/content-pipeline/infrastructure/persistence/entities/project.entity';
import { ContentPipelineIdeaEntity } from '@ext/content-pipeline/infrastructure/persistence/entities/idea.entity';
import { ContentPipelineDraftEntity } from '@ext/content-pipeline/infrastructure/persistence/entities/draft.entity';
import { ContentPipelineMetricsEntity } from '@ext/content-pipeline/infrastructure/persistence/entities/metrics.entity';

import {
  contentPipelineProvider,
  CONTENT_PIPELINE_PROVIDER,
} from '@ext/content-pipeline/content-pipeline.provider';

import { ProjectService } from '@ext/content-pipeline/services/project.service';
import { IdeaService } from '@ext/content-pipeline/services/idea.service';
import { DraftService } from '@ext/content-pipeline/services/draft.service';
import { TrendResearchService } from '@ext/content-pipeline/services/trend-research.service';
import { ContentGeneratorService } from '@ext/content-pipeline/services/content-generator.service';
import { ImageGeneratorService } from '@ext/content-pipeline/services/image-generator.service';
import { SeoOptimizerService } from '@ext/content-pipeline/services/seo-optimizer.service';
import { AffiliateInjectorService } from '@ext/content-pipeline/services/affiliate-injector.service';
import { PublishingService } from '@ext/content-pipeline/services/publishing.service';
import { VideoGeneratorService } from '@ext/content-pipeline/services/video-generator.service';
import { HtmlRendererService } from '@ext/content-pipeline/services/html-renderer.service';
import { CarouselGeneratorService } from '@ext/content-pipeline/services/carousel-generator.service';
import { VideoTemplateService } from '@ext/content-pipeline/services/video-template.service';
import { DesignSystemLoaderService } from '@ext/content-pipeline/services/design-system-loader.service';
import { MetricsService } from '@ext/content-pipeline/services/metrics.service';

import { ProjectController } from '@ext/content-pipeline/controllers/project.controller';
import { IdeaController } from '@ext/content-pipeline/controllers/idea.controller';
import { DraftController } from '@ext/content-pipeline/controllers/draft.controller';
import { MetricsController } from '@ext/content-pipeline/controllers/metrics.controller';
import { TemplateController } from '@ext/content-pipeline/controllers/template.controller';

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue({ name: 'content-pipeline' }),
    TypeOrmModule.forFeature([
      ContentPipelineProjectEntity,
      ContentPipelineIdeaEntity,
      ContentPipelineDraftEntity,
      ContentPipelineMetricsEntity,
    ]),
  ],
  controllers: [
    ProjectController,
    IdeaController,
    DraftController,
    MetricsController,
    TemplateController,
  ],
  providers: [
    contentPipelineProvider,
    ProjectService,
    IdeaService,
    DraftService,
    TrendResearchService,
    ContentGeneratorService,
    ImageGeneratorService,
    SeoOptimizerService,
    AffiliateInjectorService,
    PublishingService,
    VideoGeneratorService,
    HtmlRendererService,
    CarouselGeneratorService,
    VideoTemplateService,
    DesignSystemLoaderService,
    MetricsService,
  ],
  exports: [
    CONTENT_PIPELINE_PROVIDER,
    ProjectService,
    IdeaService,
    DraftService,
    TrendResearchService,
    ContentGeneratorService,
    ImageGeneratorService,
    SeoOptimizerService,
    AffiliateInjectorService,
    PublishingService,
    VideoGeneratorService,
    HtmlRendererService,
    CarouselGeneratorService,
    VideoTemplateService,
    DesignSystemLoaderService,
    MetricsService,
  ],
})
export class ContentPipelineExtensionModule {}