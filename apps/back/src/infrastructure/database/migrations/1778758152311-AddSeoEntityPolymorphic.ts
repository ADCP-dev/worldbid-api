import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSeoEntityPolymorphic1778758152311
  implements MigrationInterface
{
  name = 'AddSeoEntityPolymorphic1778758152311';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ext_cms_seo_metadata" ADD "entityName" character varying(100)`,
    );
    await queryRunner.query(
      `ALTER TABLE "ext_cms_seo_metadata" ADD "entityId" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "ext_cms_seo_metadata" ALTER COLUMN "pageId" DROP NOT NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5247b8eee2ccc7937e287813af" ON "ext_cms_seo_metadata" ("entityName") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f9f16f70777463e7eee1246f5d" ON "ext_cms_seo_metadata" ("entityId") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f9f16f70777463e7eee1246f5d"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_5247b8eee2ccc7937e287813af"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ext_cms_seo_metadata" ALTER COLUMN "pageId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "ext_cms_seo_metadata" DROP COLUMN "entityId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ext_cms_seo_metadata" DROP COLUMN "entityName"`,
    );
  }
}
