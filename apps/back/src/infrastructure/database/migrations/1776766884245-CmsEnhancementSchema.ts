import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey, TableColumn } from 'typeorm';

export class CmsEnhancementSchema1776766884245 implements MigrationInterface {
  name = 'CmsEnhancementSchema1776766884245';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add columns to seo_metadata
    await queryRunner.addColumn(
      'seo_metadata',
      new TableColumn({
        name: 'robotsPolicy',
        type: 'jsonb',
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      'seo_metadata',
      new TableColumn({
        name: 'hreflangEnabled',
        type: 'boolean',
        default: true,
      }),
    );

    await queryRunner.addColumn(
      'seo_metadata',
      new TableColumn({
        name: 'hreflangAlternateLocales',
        type: 'text',
        isNullable: true,
        isArray: true,
      }),
    );

    await queryRunner.addColumn(
      'seo_metadata',
      new TableColumn({
        name: 'hreflangCustomUrls',
        type: 'jsonb',
        isNullable: true,
      }),
    );

    // 2. Add categoryId to blog_post
    await queryRunner.addColumn(
      'blog_post',
      new TableColumn({
        name: 'categoryId',
        type: 'uuid',
        isNullable: true,
      }),
    );

    // Create index on categoryId
    await queryRunner.createIndex(
      'blog_post',
      new TableIndex({
        name: 'idx_blog_post_category',
        columnNames: ['categoryId'],
      }),
    );

    // Add FK constraint
    await queryRunner.createForeignKey(
      'blog_post',
      new TableForeignKey({
        name: 'fk_blog_post_category',
        columnNames: ['categoryId'],
        referencedTableName: 'blog_category',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    // 3. Create post_tag table
    await queryRunner.createTable(
      new Table({
        name: 'post_tag',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'gen_random_uuid()',
          },
          {
            name: 'name',
            type: 'varchar',
            isUnique: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'deletedAt',
            type: 'timestamp',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Create unique index on name (only when not deleted)
    await queryRunner.createIndex(
      'post_tag',
      new TableIndex({
        name: 'idx_post_tag_name_unique',
        columnNames: ['name'],
        isUnique: true,
      }),
    );

    // 4. Create blog_post_tag join table
    await queryRunner.createTable(
      new Table({
        name: 'blog_post_tag',
        columns: [
          {
            name: 'postId',
            type: 'uuid',
            isPrimary: true,
          },
          {
            name: 'tagId',
            type: 'uuid',
            isPrimary: true,
          },
        ],
      }),
      true,
    );

    // Create FK for postId
    await queryRunner.createForeignKey(
      'blog_post_tag',
      new TableForeignKey({
        name: 'fk_blog_post_tag_post',
        columnNames: ['postId'],
        referencedTableName: 'blog_post',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // Create FK for tagId
    await queryRunner.createForeignKey(
      'blog_post_tag',
      new TableForeignKey({
        name: 'fk_blog_post_tag_tag',
        columnNames: ['tagId'],
        referencedTableName: 'post_tag',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    // Create index on tagId for faster lookups
    await queryRunner.createIndex(
      'blog_post_tag',
      new TableIndex({
        name: 'idx_blog_post_tag_tag',
        columnNames: ['tagId'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop blog_post_tag table
    await queryRunner.dropForeignKey('blog_post_tag', 'fk_blog_post_tag_tag');
    await queryRunner.dropForeignKey('blog_post_tag', 'fk_blog_post_tag_post');
    await queryRunner.dropIndex('blog_post_tag', 'idx_blog_post_tag_tag');
    await queryRunner.dropTable('blog_post_tag');

    // Drop post_tag table
    await queryRunner.dropIndex('post_tag', 'idx_post_tag_name_unique');
    await queryRunner.dropTable('post_tag');

    // Drop categoryId from blog_post
    await queryRunner.dropForeignKey('blog_post', 'fk_blog_post_category');
    await queryRunner.dropIndex('blog_post', 'idx_blog_post_category');
    await queryRunner.dropColumn('blog_post', 'categoryId');

    // Drop columns from seo_metadata
    await queryRunner.dropColumn('seo_metadata', 'hreflangCustomUrls');
    await queryRunner.dropColumn('seo_metadata', 'hreflangAlternateLocales');
    await queryRunner.dropColumn('seo_metadata', 'hreflangEnabled');
    await queryRunner.dropColumn('seo_metadata', 'robotsPolicy');
  }
}