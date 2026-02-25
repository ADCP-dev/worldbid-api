import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1771689341396 implements MigrationInterface {
  name = 'Migration1771689341396';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "translation" ADD "app" character varying`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_951df7b8bf1b7302ec2db66bbd" ON "translation" ("app") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_951df7b8bf1b7302ec2db66bbd"`,
    );
    await queryRunner.query(`ALTER TABLE "translation" DROP COLUMN "app"`);
  }
}
