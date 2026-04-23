import { MigrationInterface, QueryRunner } from 'typeorm';

export class BlogCategory1776246099740 implements MigrationInterface {
  name = 'BlogCategory1776246099740';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "blog_category" ADD "name" character varying(100) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "blog_category" ADD "description" text`,
    );
    await queryRunner.query(`ALTER TABLE "blog_category" ADD "parentId" uuid`);
    await queryRunner.query(
      `ALTER TABLE "blog_category" ADD CONSTRAINT "FK_0c82cb83f01e5322e019d845eec" FOREIGN KEY ("parentId") REFERENCES "blog_category"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "blog_category" DROP CONSTRAINT "FK_0c82cb83f01e5322e019d845eec"`,
    );
    await queryRunner.query(
      `ALTER TABLE "blog_category" DROP COLUMN "parentId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "blog_category" DROP COLUMN "description"`,
    );
    await queryRunner.query(`ALTER TABLE "blog_category" DROP COLUMN "name"`);
  }
}
