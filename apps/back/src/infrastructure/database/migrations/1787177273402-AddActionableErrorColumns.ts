import { MigrationInterface, QueryRunner } from "typeorm";

export class AddActionableErrorColumns1787177273402 implements MigrationInterface {
    name = 'AddActionableErrorColumns1787177273402'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "error_logs" ADD "category" character varying`);
        await queryRunner.query(`ALTER TABLE "error_logs" ADD "severity" character varying`);
        await queryRunner.query(`ALTER TABLE "error_logs" ADD "extension" character varying`);
        await queryRunner.query(`ALTER TABLE "error_logs" ADD "resource" character varying`);
        await queryRunner.query(`ALTER TABLE "error_logs" ADD "specFile" character varying`);
        await queryRunner.query(`ALTER TABLE "error_logs" ADD "operation" character varying`);
        await queryRunner.query(`ALTER TABLE "error_logs" ADD "handlerFile" character varying`);
        await queryRunner.query(`ALTER TABLE "error_logs" ADD "failurePoint" jsonb`);
        await queryRunner.query(`ALTER TABLE "error_logs" ADD "suggestedFix" jsonb`);
        await queryRunner.query(`ALTER TABLE "error_logs" ADD "relatedSpec" jsonb`);
        await queryRunner.query(`ALTER TABLE "error_logs" ADD "requestId" character varying`);
        await queryRunner.query(`ALTER TABLE "error_logs" ADD "userId" integer`);
        await queryRunner.query(`ALTER TABLE "ext_affiliate_partner" ALTER COLUMN "commissionRate" SET DEFAULT '0.05'`);
        await queryRunner.query(`CREATE INDEX "IDX_eff22c0e8a71ff862fd1341e9b" ON "error_logs" ("category") `);
        await queryRunner.query(`CREATE INDEX "IDX_954f90017962c997d6335a25c3" ON "error_logs" ("extension") `);
        await queryRunner.query(`CREATE INDEX "IDX_f81f52a373844307979a0b073a" ON "error_logs" ("requestId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_f81f52a373844307979a0b073a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_954f90017962c997d6335a25c3"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_eff22c0e8a71ff862fd1341e9b"`);
        await queryRunner.query(`ALTER TABLE "ext_affiliate_partner" ALTER COLUMN "commissionRate" SET DEFAULT 0.05`);
        await queryRunner.query(`ALTER TABLE "error_logs" DROP COLUMN "userId"`);
        await queryRunner.query(`ALTER TABLE "error_logs" DROP COLUMN "requestId"`);
        await queryRunner.query(`ALTER TABLE "error_logs" DROP COLUMN "relatedSpec"`);
        await queryRunner.query(`ALTER TABLE "error_logs" DROP COLUMN "suggestedFix"`);
        await queryRunner.query(`ALTER TABLE "error_logs" DROP COLUMN "failurePoint"`);
        await queryRunner.query(`ALTER TABLE "error_logs" DROP COLUMN "handlerFile"`);
        await queryRunner.query(`ALTER TABLE "error_logs" DROP COLUMN "operation"`);
        await queryRunner.query(`ALTER TABLE "error_logs" DROP COLUMN "specFile"`);
        await queryRunner.query(`ALTER TABLE "error_logs" DROP COLUMN "resource"`);
        await queryRunner.query(`ALTER TABLE "error_logs" DROP COLUMN "extension"`);
        await queryRunner.query(`ALTER TABLE "error_logs" DROP COLUMN "severity"`);
        await queryRunner.query(`ALTER TABLE "error_logs" DROP COLUMN "category"`);
    }

}
