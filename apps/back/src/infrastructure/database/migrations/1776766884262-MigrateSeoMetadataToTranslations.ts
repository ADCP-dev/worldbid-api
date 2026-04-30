import { MigrationInterface, QueryRunner } from 'typeorm';
import { Logger } from '@nestjs/common';

export class MigrateSeoMetadataToTranslations1776766884262
  implements MigrationInterface
{
  name = 'MigrateSeoMetadataToTranslations1776766884262';
  private readonly logger = new Logger(
    'MigrateSeoMetadataToTranslations1776766884262',
  );

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Find default language (es)
    const langResult = await queryRunner.query(
      `SELECT id FROM "lang" WHERE code = 'es' LIMIT 1`,
    );
    const defaultLangId = langResult[0]?.id;

    if (!defaultLangId) {
      this.logger.warn(
        'No default language (es) found. Skipping SEO metadata migration.',
      );
      return;
    }

    // Get all seo_metadata records with metaTitle or metaDescription
    const seoRecords = await queryRunner.query(
      `SELECT "id", "pageId", "lang", "metaTitle", "metaDescription" FROM "seo_metadata" WHERE "metaTitle" IS NOT NULL OR "metaDescription" IS NOT NULL`,
    );

    this.logger.log(
      `Found ${seoRecords.length} SEO metadata records to migrate`,
    );

    let migrated = 0;
    for (const seo of seoRecords) {
      // Determine if pageId is a BlogPost or a Page
      const blogPost = await queryRunner.query(
        `SELECT id FROM "blog_post" WHERE id = $1 LIMIT 1`,
        [seo.pageId],
      );
      const isBlogPost = blogPost.length > 0;

      const page = !isBlogPost
        ? await queryRunner.query(
            `SELECT id, name FROM "page" WHERE id = $1 LIMIT 1`,
            [seo.pageId],
          )
        : [];
      const isPage = page.length > 0;

      const langResultInner = await queryRunner.query(
        `SELECT id FROM "lang" WHERE code = $1 LIMIT 1`,
        [seo.lang || 'es'],
      );
      const langId = langResultInner[0]?.id || defaultLangId;

      if (isBlogPost) {
        // Migrate as polymorphic BlogPost translation
        if (seo.metaTitle) {
          const existing = await queryRunner.query(
            `SELECT id FROM "translation" WHERE "entityName" = 'BlogPost' AND "entityId" = $1 AND "key" = 'metaTitle' AND "langId" = $2 LIMIT 1`,
            [seo.pageId, langId],
          );
          if (existing.length === 0) {
            await queryRunner.query(
              `INSERT INTO "translation" ("langId", "section", "key", "content", "entityName", "entityId", "category", "createdAt", "updatedAt")
               VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
              [
                langId,
                'blog-post',
                'metaTitle',
                seo.metaTitle,
                'BlogPost',
                seo.pageId,
                null,
              ],
            );
            migrated++;
          }
        }
        if (seo.metaDescription) {
          const existing = await queryRunner.query(
            `SELECT id FROM "translation" WHERE "entityName" = 'BlogPost' AND "entityId" = $1 AND "key" = 'metaDescription' AND "langId" = $2 LIMIT 1`,
            [seo.pageId, langId],
          );
          if (existing.length === 0) {
            await queryRunner.query(
              `INSERT INTO "translation" ("langId", "section", "key", "content", "entityName", "entityId", "category", "createdAt", "updatedAt")
               VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
              [
                langId,
                'blog-post',
                'metaDescription',
                seo.metaDescription,
                'BlogPost',
                seo.pageId,
                null,
              ],
            );
            migrated++;
          }
        }
      } else if (isPage) {
        // Migrate as category-based Page translation
        const category = `page.${page[0].name}`;
        if (seo.metaTitle) {
          const existing = await queryRunner.query(
            `SELECT id FROM "translation" WHERE "category" = $1 AND "key" = 'metaTitle' AND "langId" = $2 LIMIT 1`,
            [category, langId],
          );
          if (existing.length === 0) {
            await queryRunner.query(
              `INSERT INTO "translation" ("langId", "section", "key", "content", "entityName", "entityId", "category", "createdAt", "updatedAt")
               VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
              [
                langId,
                'page',
                'metaTitle',
                seo.metaTitle,
                null,
                null,
                category,
              ],
            );
            migrated++;
          }
        }
        if (seo.metaDescription) {
          const existing = await queryRunner.query(
            `SELECT id FROM "translation" WHERE "category" = $1 AND "key" = 'metaDescription' AND "langId" = $2 LIMIT 1`,
            [category, langId],
          );
          if (existing.length === 0) {
            await queryRunner.query(
              `INSERT INTO "translation" ("langId", "section", "key", "content", "entityName", "entityId", "category", "createdAt", "updatedAt")
               VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
              [
                langId,
                'page',
                'metaDescription',
                seo.metaDescription,
                null,
                null,
                category,
              ],
            );
            migrated++;
          }
        }
      } else {
        this.logger.warn(
          `Could not determine entity type for pageId ${seo.pageId}`,
        );
      }
    }

    this.logger.log(`Migrated ${migrated} SEO metadata fields to translations`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove migrated metaTitle/metaDescription translations
    await queryRunner.query(
      `DELETE FROM "translation" WHERE "entityName" = 'BlogPost' AND "key" IN ('metaTitle', 'metaDescription')`,
    );
    await queryRunner.query(
      `DELETE FROM "translation" WHERE "category" LIKE 'page.%' AND "key" IN ('metaTitle', 'metaDescription')`,
    );
    this.logger.log('Removed migrated SEO metadata translations');
  }
}
