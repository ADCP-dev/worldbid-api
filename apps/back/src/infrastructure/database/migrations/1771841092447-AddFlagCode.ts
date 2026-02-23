import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFlagCode1771841092447 implements MigrationInterface {
  name = 'AddFlagCode1771841092447';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "lang" ADD "flagCode" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "lang" DROP COLUMN "flagCode"`);
  }
}
