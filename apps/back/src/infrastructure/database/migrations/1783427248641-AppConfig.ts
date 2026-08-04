import { MigrationInterface, QueryRunner } from 'typeorm';

export class AppConfig1783427248641 implements MigrationInterface {
  name = 'AppConfig1783427248641';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "app_setting" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "key" character varying NOT NULL, "value" jsonb NOT NULL DEFAULT '{}', "section" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_0d66bfb0d9f93124a4549d21af0" UNIQUE ("key"), CONSTRAINT "PK_10b1e1bf64917bdb640f8eedb31" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_61c85fd9e5a04dd5bc9b006ed8" ON "app_setting" ("section") `,
    );
    await queryRunner.query(
      `ALTER TABLE "ext_affiliate_partner" ALTER COLUMN "commissionRate" SET DEFAULT '0.05'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ext_affiliate_partner" ALTER COLUMN "commissionRate" SET DEFAULT 0.05`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_61c85fd9e5a04dd5bc9b006ed8"`,
    );
    await queryRunner.query(`DROP TABLE "app_setting"`);
  }
}
