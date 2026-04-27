import { MigrationInterface, QueryRunner } from 'typeorm';
import { Logger } from '@nestjs/common';

export class MigrateCategoryDescriptionToTranslations1776766884250
  implements MigrationInterface
{
  private readonly logger = new Logger(
    'MigrateCategoryDescriptionToTranslations1776766884250',
  );
  name = 'MigrateCategoryDescriptionToTranslations1776766884250';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Find default language (es)
    const langResult = await queryRunner.query(
      `SELECT id FROM "lang" WHERE code = 'es' LIMIT 1`,
    );

    const defaultLangId = langResult[0]?.id;

    if (!defaultLangId) {
      this.logger.warn(
        'No default language (es) found. Skipping description migration.',
      );
      return;
    }

    // Check if description column exists (may have been dropped already)
    const columnExists = await queryRunner.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'blog_category' AND column_name = 'description'`,
    );

    if (columnExists.length === 0) {
      this.logger.warn(
        'Column "description" does not exist in blog_category. Skipping migration.',
      );
      return;
    }

    // Get categories with non-null, non-empty descriptions
    const categories = await queryRunner.query(
      `SELECT id, description FROM "blog_category" WHERE description IS NOT NULL AND description != ''`,
    );

    this.logger.log(
      `Found ${categories.length} categories with descriptions to migrate`,
    );

    for (const category of categories) {
      await queryRunner.query(
        `INSERT INTO "translation" ("langId", "section", "key", "content", "entityName", "entityId", "category", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
        [
          defaultLangId,
          'content',
          'description',
          category.description,
          'Category',
          category.id,
          null,
        ],
      );
    }

    this.logger.log(
      `Migrated ${categories.length} category descriptions to translations`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove all Category description translations created by this migration
    await queryRunner.query(
      `DELETE FROM "translation" WHERE "entityName" = 'Category' AND "key" = 'description'`,
    );
    this.logger.log('Removed migrated category description translations');
  }
}
