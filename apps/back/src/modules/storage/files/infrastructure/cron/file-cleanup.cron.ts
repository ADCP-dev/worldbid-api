import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FileCleanupErrorRepository } from '@storage/files/infrastructure/file-cleanup-error.repository';
import fileConfig from '@storage/files/config/file.config';
import { FileConfig } from '@storage/files/config/file-config.type';

@Injectable()
export class FileCleanupCronService {
  private readonly logger = new Logger(FileCleanupCronService.name);

  constructor(
    private readonly cleanupErrorRepository: FileCleanupErrorRepository,
    @Inject('FILE_UPLOADER_SERVICE')
    private readonly fileUploaderService: any,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM, {
    name: 'file-cleanup-orphaned-files',
    timeZone: 'Europe/Madrid',
  })
  async handleOrphanedFilesCleanup() {
    this.logger.log('Starting orphaned files cleanup cron job...');
    const currentDriver = (fileConfig() as FileConfig).driver;

    // We fetch a batch to prevent out of memory during massive cloud outage
    const errors = await this.cleanupErrorRepository.findPending(100);

    if (errors.length === 0) {
      this.logger.log('No orphaned files to clean up today. All good!');
      return;
    }

    this.logger.log(`Found ${errors.length} orphaned files to retry deletion.`);

    let successCount = 0;
    let failCount = 0;

    for (const errorRecord of errors) {
      // If the driver of the orphaned record doesn't match the current active driver,
      // skip it. (e.g. Server is running in Local but orphan is S3).
      if (errorRecord.driver !== currentDriver) {
        this.logger.warn(
          `Skipping cleanup for file ${errorRecord.fileUri} because it belongs to driver '${errorRecord.driver}' but current driver is '${currentDriver}'.`,
        );
        continue;
      }

      try {
        await this.fileUploaderService.deletePhysicalFile(errorRecord.fileUri);

        // If physical deletion is successful, we can safely drop the dead-letter queue record.
        await this.cleanupErrorRepository.remove(errorRecord);
        successCount++;
      } catch (error) {
        // Log the failure and persist it so it tries again tomorrow.
        failCount++;
        errorRecord.attempts += 1;
        errorRecord.errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        await this.cleanupErrorRepository.save(errorRecord);

        this.logger.error(
          `Failed to retry deletion for orphaned file ${errorRecord.fileUri}: ${errorRecord.errorMessage}`,
        );
      }
    }

    this.logger.log(
      `Cron Job Summary: ${successCount} successfully deleted, ${failCount} failed.`,
    );
  }
}
