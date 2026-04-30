import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCategoryTagsRelation1776766884255
  implements MigrationInterface
{
  name = 'AddCategoryTagsRelation1776766884255';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS blog_category_tag (
        "categoryId" uuid NOT NULL REFERENCES blog_category(id) ON DELETE CASCADE,
        "tagId" uuid NOT NULL REFERENCES post_tag(id) ON DELETE CASCADE,
        PRIMARY KEY ("categoryId", "tagId")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS blog_category_tag`);
  }
}
