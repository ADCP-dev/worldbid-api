import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakePlanIdNullable1778237806998 implements MigrationInterface {
  name = 'MakePlanIdNullable1778237806998';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ext_stripe_subscription" DROP CONSTRAINT "FK_e6c6d88159fb26badf296777987"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ext_stripe_subscription" ALTER COLUMN "planId" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "ext_stripe_subscription" ADD CONSTRAINT "FK_e6c6d88159fb26badf296777987" FOREIGN KEY ("planId") REFERENCES "ext_stripe_plan"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ext_stripe_subscription" DROP CONSTRAINT "FK_e6c6d88159fb26badf296777987"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ext_stripe_subscription" ALTER COLUMN "planId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "ext_stripe_subscription" ADD CONSTRAINT "FK_e6c6d88159fb26badf296777987" FOREIGN KEY ("planId") REFERENCES "ext_stripe_plan"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
