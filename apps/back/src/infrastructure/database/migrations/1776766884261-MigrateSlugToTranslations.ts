import { MigrationInterface, QueryRunner } from 'typeorm';
import { Logger } from '@nestjs/common';

export class MigrateSlugToTranslations1776766884261 implements MigrationInterface {
  name = 'MigrateSlugToTranslations1776766884261';
  private readonly logger = new Logger('MigrateSlugToTranslations1776766884261');

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Find default language (es)
    const langResult = await queryRunner.query(
      `SELECT id FROM "lang" WHERE code = 'es' LIMIT 1`,
    );
    const defaultLangId = langResult[0]?.id;

    if (!defaultLangId) {
      this.logger.warn('No default language (es) found. Skipping slug migration.');
      return;
    }

    // Migrate blog post slugs
    const blogPosts = await queryRunner.query(
      `SELECT id, slug FROM "blog_post" WHERE slug IS NOT NULL AND slug != ''`,
    );

    this.logger.log(`Found ${blogPosts.length} blog posts with slugs to migrate`);

    for (const post of blogPosts) {
      // Check if translation already exists to make idempotent
      const existing = await queryRunner.query(
        `SELECT id FROM "translation" WHERE "entityName" = 'BlogPost' AND "entityId" = $1 AND "key" = 'slug' AND "langId" = $2 LIMIT 1`,
        [post.id, defaultLangId],
      );

      if (existing.length === 0) {
        await queryRunner.query(
          `INSERT INTO "translation" ("langId", "section", "key", "content", "entityName", "entityId", "category", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
          [
            defaultLangId,
            'blog-post',
            'slug',
            post.slug,
            'BlogPost',
            post.id,
            null,
          ],
        );
      }
    }

    // Migrate page slugs (category-based, no entityName/entityId)
    const pages = await queryRunner.query(
      `SELECT id, name, slug FROM "page" WHERE slug IS NOT NULL AND slug != ''`,
    );

    this.logger.log(`Found ${pages.length} pages with slugs to migrate`);

    for (const page of pages) {
      const category = `page.${page.name}`;

      // Check if translation already exists to make idempotent
      const existing = await queryRunner.query(
        `SELECT id FROM "translation" WHERE "category" = $1 AND "key" = 'slug' AND "langId" = $2 LIMIT 1`,
        [category, defaultLangId],
      );

      if (existing.length === 0) {
        await queryRunner.query(
          `INSERT INTO "translation" ("langId", "section", "key", "content", "entityName", "entityId", "category", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
          [
            defaultLangId,
            'page',
            'slug',
            page.slug,
            null,
            null,
            category,
          ],
        );
      }
    }

    this.logger.log('Migrated slugs to translations');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove migrated slug translations
    await queryRunner.query(
      `DELETE FROM "translation" WHERE "entityName" = 'BlogPost' AND "key" = 'slug'`,
    );
    await queryRunner.query(
      `DELETE FROM "translation" WHERE "category" LIKE 'page.%' AND "key" = 'slug'`,
    );
    this.logger.log('Removed migrated slug translations');
  }
}
