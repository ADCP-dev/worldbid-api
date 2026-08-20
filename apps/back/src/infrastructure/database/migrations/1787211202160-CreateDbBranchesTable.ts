import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * CreateDbBranchesTable — tracking table for schema-level database branches.
 *
 * Lives in the `public` schema so DbBranchManager can track branches regardless
 * of the active search_path. The DbBranchEntity backs this table for migration
 * generator detection; the BranchManager uses raw SQL against it for full
 * control over the branching lifecycle.
 *
 * @see prds/agent-native/04-database-branching.md
 */
export class CreateDbBranchesTable1787211202160 implements MigrationInterface {
    name = 'CreateDbBranchesTable1787211202160'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "_db_branches" (
                "id" UUID NOT NULL DEFAULT gen_random_uuid(),
                "name" character varying(100) NOT NULL,
                "schema" character varying(120) NOT NULL,
                "parent_schema" character varying(120) NOT NULL DEFAULT 'public',
                "status" character varying(20) NOT NULL DEFAULT 'active',
                "copy_data" boolean NOT NULL DEFAULT true,
                "created_by" character varying(100),
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "merged_at" TIMESTAMP,
                "discarded_at" TIMESTAMP,
                "metadata" jsonb,
                CONSTRAINT "UQ_db_branches_name" UNIQUE ("name"),
                CONSTRAINT "UQ_db_branches_schema" UNIQUE ("schema"),
                CONSTRAINT "PK_db_branches" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`CREATE INDEX "idx_db_branches_status" ON "_db_branches" ("status") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."idx_db_branches_status"`);
        await queryRunner.query(`DROP TABLE "_db_branches"`);
    }

}