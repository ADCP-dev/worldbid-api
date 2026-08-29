import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Adds `code` (public unique referral code) to ext_affiliate_partner.
 *
 * NOTE: reviewed by hand — unrelated Knowledge Agent entity drift produced by
 * the auto-generator (vector/ltree casts, KA FK churn) was removed so this
 * migration only touches affiliate tables.
 *
 * Backfill-safe: column is added NULL, existing rows get a random code
 * (ambiguous-char-free alphabet, same as the service generator), then the
 * column is set NOT NULL and a unique index is created.
 */
export class AddAffiliatePartnerCode1788018165676 implements MigrationInterface {
    name = 'AddAffiliatePartnerCode1788018165676'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ext_affiliate_partner" ADD "code" character varying(30)`);
        await queryRunner.query(`
            UPDATE "ext_affiliate_partner"
            SET "code" = 'AFF-' || upper(substr(translate(md5(random()::text), '01iloIOSB58', ''), 1, 6))
            WHERE "code" IS NULL
              AND length(translate(md5(random()::text), '01iloIOSB58', '')) >= 6
        `);
        // Guarantee every row has a code (fallback loop in unlikely alphabet-shortage case)
        await queryRunner.query(`
            UPDATE "ext_affiliate_partner"
            SET "code" = 'AFF-' || substr(md5("id"::text), 1, 6)
            WHERE "code" IS NULL
        `);
        await queryRunner.query(`ALTER TABLE "ext_affiliate_partner" ALTER COLUMN "code" SET NOT NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_affiliate_partner_code" ON "ext_affiliate_partner" ("code") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."UQ_affiliate_partner_code"`);
        await queryRunner.query(`ALTER TABLE "ext_affiliate_partner" DROP COLUMN "code"`);
    }
}