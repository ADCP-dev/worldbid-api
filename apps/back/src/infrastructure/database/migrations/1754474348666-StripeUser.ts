import { MigrationInterface, QueryRunner } from 'typeorm';

export class StripeUser1754474348666 implements MigrationInterface {
  name = 'StripeUser1754474348666';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" ADD "stripeCustomerId" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD CONSTRAINT "UQ_0bfe583759eb0305b60117be840" UNIQUE ("stripeCustomerId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user" DROP CONSTRAINT "UQ_0bfe583759eb0305b60117be840"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" DROP COLUMN "stripeCustomerId"`,
    );
  }
}
