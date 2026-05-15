import { MigrationInterface, QueryRunner } from 'typeorm';

export class StripLeadingSlashFromBlogPostSlugs1778826771542
  implements MigrationInterface
{
  name = 'StripLeadingSlashFromBlogPostSlugs1778826771542';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Strip leading "/" from existing blog post slugs
    await queryRunner.query(
      `UPDATE "ext_cms_blog_post" SET "slug" = substring("slug" FROM 2) WHERE "slug" LIKE '/%'`,
    );
    // Strip leading "/" from existing blog category slugs
    await queryRunner.query(
      `UPDATE "ext_cms_blog_category" SET "slug" = substring("slug" FROM 2) WHERE "slug" LIKE '/%'`,
    );
    // Strip leading "/" from existing CMS page slugs
    await queryRunner.query(
      `UPDATE "ext_cms_page" SET "slug" = substring("slug" FROM 2) WHERE "slug" LIKE '/%'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "ext_cms_blog_post" SET "slug" = '/' || "slug" WHERE "slug" NOT LIKE '/%'`,
    );
    await queryRunner.query(
      `UPDATE "ext_cms_blog_category" SET "slug" = '/' || "slug" WHERE "slug" NOT LIKE '/%'`,
    );
    await queryRunner.query(
      `UPDATE "ext_cms_page" SET "slug" = '/' || "slug" WHERE "slug" NOT LIKE '/%'`,
    );
  }
}
