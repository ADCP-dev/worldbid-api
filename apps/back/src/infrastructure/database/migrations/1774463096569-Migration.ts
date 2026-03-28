import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1774463096569 implements MigrationInterface {
  name = 'Migration1774463096569';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "page" ADD "parentId" uuid`);
    await queryRunner.query(
      `ALTER TABLE "seo_metadata" ADD "type" character varying(20)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "seo_metadata" DROP COLUMN "type"`);
    await queryRunner.query(`ALTER TABLE "page" DROP COLUMN "parentId"`);
  }
}
