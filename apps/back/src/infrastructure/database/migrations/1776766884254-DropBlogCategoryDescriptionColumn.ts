import { MigrationInterface, QueryRunner } from 'typeorm';
import { Logger } from '@nestjs/common';

export class DropBlogCategoryDescriptionColumn1776766884254
  implements MigrationInterface
{
  private readonly logger = new Logger(
    'DropBlogCategoryDescriptionColumn1776766884254',
  );
  name = 'DropBlogCategoryDescriptionColumn1776766884254';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Verify descriptions have been migrated to translations before dropping
    const migratedCount = await queryRunner.query(
      `SELECT COUNT(*) as count FROM "translation" WHERE "entityName" = 'Category' AND "key" = 'description'`,
    );

    const count = parseInt(migratedCount[0]?.count || '0', 10);
    this.logger.log(
      `Verified ${count} category description translations exist before dropping column`,
    );

    // Drop description column (idempotent via IF EXISTS)
    await queryRunner.query(
      `ALTER TABLE "blog_category" DROP COLUMN IF EXISTS "description"`,
    );
    this.logger.log('Dropped description column from blog_category table');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore description column — cannot recover data (destructive migration)
    await queryRunner.query(
      `ALTER TABLE "blog_category" ADD COLUMN IF NOT EXISTS "description" text`,
    );
    this.logger.log(
      'Restored description column on blog_category table (data lost)',
    );
  }
}
