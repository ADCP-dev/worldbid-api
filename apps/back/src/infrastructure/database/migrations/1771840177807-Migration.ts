import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1771840177807 implements MigrationInterface {
  name = 'Migration1771840177807';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "translation" DROP CONSTRAINT "FK_14b169181b406881cd72b55fa42"`,
    );
    await queryRunner.query(
      `ALTER TABLE "translation" ADD CONSTRAINT "FK_14b169181b406881cd72b55fa42" FOREIGN KEY ("langId") REFERENCES "lang"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "translation" DROP CONSTRAINT "FK_14b169181b406881cd72b55fa42"`,
    );
    await queryRunner.query(
      `ALTER TABLE "translation" ADD CONSTRAINT "FK_14b169181b406881cd72b55fa42" FOREIGN KEY ("langId") REFERENCES "lang"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
