import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableIndex,
} from 'typeorm';
import { Logger } from '@nestjs/common';

export class AddPageNameAndDropSlugUniques1776766884260
  implements MigrationInterface
{
  name = 'AddPageNameAndDropSlugUniques1776766884260';
  private readonly logger = new Logger(
    'AddPageNameAndDropSlugUniques1776766884260',
  );

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add name column to page table (nullable first for backfill)
    await queryRunner.addColumn(
      'page',
      new TableColumn({
        name: 'name',
        type: 'varchar',
        isNullable: true,
      }),
    );

    // 2. Backfill page.name from page.slug
    await queryRunner.query(`UPDATE "page" SET "name" = "slug"`);

    // 3. Make name NOT NULL
    await queryRunner.changeColumn(
      'page',
      'name',
      new TableColumn({
        name: 'name',
        type: 'varchar',
        isNullable: false,
      }),
    );

    // 4. Add unique index on page.name
    await queryRunner.createIndex(
      'page',
      new TableIndex({
        name: 'IDX_PAGE_NAME_UNIQUE',
        columnNames: ['name'],
        isUnique: true,
      }),
    );

    // 5. Drop unique index from page.slug and recreate as non-unique
    // TypeORM default unique index name pattern
    const pageSlugUnique = await queryRunner.query(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'page' AND indexdef LIKE '%UNIQUE%slug%'`,
    );
    if (pageSlugUnique.length > 0) {
      for (const idx of pageSlugUnique) {
        await queryRunner.query(`DROP INDEX IF EXISTS "${idx.indexname}"`);
      }
    }
    await queryRunner.createIndex(
      'page',
      new TableIndex({
        name: 'IDX_PAGE_SLUG',
        columnNames: ['slug'],
      }),
    );

    // 6. Drop unique index from blog_post.slug and recreate as non-unique
    const blogPostSlugUnique = await queryRunner.query(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'blog_post' AND indexdef LIKE '%UNIQUE%slug%'`,
    );
    if (blogPostSlugUnique.length > 0) {
      for (const idx of blogPostSlugUnique) {
        await queryRunner.query(`DROP INDEX IF EXISTS "${idx.indexname}"`);
      }
    }
    await queryRunner.createIndex(
      'blog_post',
      new TableIndex({
        name: 'IDX_BLOG_POST_SLUG',
        columnNames: ['slug'],
      }),
    );

    this.logger.log('Added page.name and dropped unique constraints on slugs');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore unique indexes on slugs
    await queryRunner.dropIndex('page', 'IDX_PAGE_SLUG');
    await queryRunner.createIndex(
      'page',
      new TableIndex({
        name: 'IDX_PAGE_SLUG_UNIQUE',
        columnNames: ['slug'],
        isUnique: true,
      }),
    );

    await queryRunner.dropIndex('blog_post', 'IDX_BLOG_POST_SLUG');
    await queryRunner.createIndex(
      'blog_post',
      new TableIndex({
        name: 'IDX_BLOG_POST_SLUG_UNIQUE',
        columnNames: ['slug'],
        isUnique: true,
      }),
    );

    // Drop unique index on name and column
    await queryRunner.dropIndex('page', 'IDX_PAGE_NAME_UNIQUE');
    await queryRunner.dropColumn('page', 'name');

    this.logger.log(
      'Restored unique constraints on slugs and dropped page.name',
    );
  }
}
