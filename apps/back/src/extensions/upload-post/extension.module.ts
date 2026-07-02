import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
// ScheduleModule is registered globally in InfrastructureModule — no need to re-import

import { UpPostEntity } from '@ext/upload-post/infrastructure/persistence/entities/up-post.entity';
import { UpPostAnalyticsSnapshotEntity } from '@ext/upload-post/infrastructure/persistence/entities/up-post-analytics-snapshot.entity';
import { UpPostAutodmMonitorEntity } from '@ext/upload-post/infrastructure/persistence/entities/up-post-autodm-monitor.entity';

import { uploadPostProvider } from '@ext/upload-post/upload-post.provider';
import { UploadPostClientService } from '@ext/upload-post/services/upload-post-client.service';
import { UploadService } from '@ext/upload-post/services/upload.service';
import { ScheduleService } from '@ext/upload-post/services/schedule.service';
import { AnalyticsService } from '@ext/upload-post/services/analytics.service';
import { AutodmService } from '@ext/upload-post/services/autodm.service';
import { FfmpegService } from '@ext/upload-post/services/ffmpeg.service';
import { WebhooksService } from '@ext/upload-post/services/webhooks.service';
import { QueueService } from '@ext/upload-post/services/queue.service';
import { WeeklyReportService } from '@ext/upload-post/services/weekly-report.service';
import { PlatformsService } from '@ext/upload-post/services/platforms.service';
import { InstagramService } from '@ext/upload-post/services/instagram.service';

import { UploadController } from '@ext/upload-post/controllers/upload.controller';
import { ScheduleController } from '@ext/upload-post/controllers/schedule.controller';
import { AnalyticsController } from '@ext/upload-post/controllers/analytics.controller';
import { AutodmController } from '@ext/upload-post/controllers/autodm.controller';
import { FfmpegController, WebhooksController } from '@ext/upload-post/controllers/ffmpeg-webhooks.controller';
import { QueueController, WeeklyReportController } from '@ext/upload-post/controllers/queue-weekly.controller';
import { PlatformsController, InstagramController } from '@ext/upload-post/controllers/platforms-instagram.controller';

// QueuedMailerService is provided globally by EmailQueueModule (@Global) — no import needed

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      UpPostEntity,
      UpPostAnalyticsSnapshotEntity,
      UpPostAutodmMonitorEntity,
    ]),
  ],
  controllers: [
    UploadController,
    ScheduleController,
    AnalyticsController,
    AutodmController,
    FfmpegController,
    WebhooksController,
    QueueController,
    WeeklyReportController,
    PlatformsController,
    InstagramController,
  ],
  providers: [
    uploadPostProvider,
    UploadPostClientService,
    UploadService,
    ScheduleService,
    AnalyticsService,
    AutodmService,
    FfmpegService,
    WebhooksService,
    QueueService,
    WeeklyReportService,
    PlatformsService,
    InstagramService,
  ],
  exports: [
    UploadPostClientService,
    UploadService,
    AnalyticsService,
    AutodmService,
    FfmpegService,
    WebhooksService,
    QueueService,
    WeeklyReportService,
    PlatformsService,
    InstagramService,
  ],
})
export class UploadPostExtensionModule {}