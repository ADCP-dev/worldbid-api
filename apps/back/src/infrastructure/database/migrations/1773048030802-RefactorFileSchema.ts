import { MigrationInterface, QueryRunner } from 'typeorm';

export class RefactorFileSchema1773048030802 implements MigrationInterface {
  name = 'RefactorFileSchema1773048030802';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "file" DROP COLUMN "entity"`);
    await queryRunner.query(
      `ALTER TABLE "file" ADD "entityName" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "file" ADD "context" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "file" DROP COLUMN "context"`);
    await queryRunner.query(`ALTER TABLE "file" DROP COLUMN "entityName"`);
    await queryRunner.query(
      `ALTER TABLE "file" ADD "entity" character varying`,
    );
  }
}
