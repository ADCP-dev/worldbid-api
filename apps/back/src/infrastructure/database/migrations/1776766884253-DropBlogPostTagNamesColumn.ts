import { MigrationInterface, QueryRunner } from 'typeorm';
import { Logger } from '@nestjs/common';

export class DropBlogPostTagNamesColumn1776766884253 implements MigrationInterface {
  private readonly logger = new Logger(
    'DropBlogPostTagNamesColumn1776766884253',
  );
  name = 'DropBlogPostTagNamesColumn1776766884253';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop legacy tagNames simple-array column (idempotent via IF EXISTS)
    await queryRunner.query(
      `ALTER TABLE "blog_post" DROP COLUMN IF EXISTS "tagNames"`,
    );
    this.logger.log('Dropped tagNames column from blog_post table');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore tagNames column — cannot recover data (destructive migration)
    await queryRunner.query(
      `ALTER TABLE "blog_post" ADD COLUMN IF NOT EXISTS "tagNames" text`,
    );
    this.logger.log(
      'Restored tagNames column on blog_post table (data lost)',
    );
  }
}
