import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1773052837762 implements MigrationInterface {
  name = 'Migration1773052837762';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" DROP CONSTRAINT "FK_75e2be4ce11d447ef43be0e374f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" DROP CONSTRAINT "REL_75e2be4ce11d447ef43be0e374"`,
    );
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "photoId"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "user" ADD "photoId" uuid`);
    await queryRunner.query(
      `ALTER TABLE "user" ADD CONSTRAINT "REL_75e2be4ce11d447ef43be0e374" UNIQUE ("photoId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD CONSTRAINT "FK_75e2be4ce11d447ef43be0e374f" FOREIGN KEY ("photoId") REFERENCES "file"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
