import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Make ext_ka_notes.user_id and ext_ka_agent_configs.user_id nullable, and
 * switch their FK ON DELETE behaviour from CASCADE to SET NULL.
 *
 * Rationale: Notes and AgentConfigs are now a GLOBAL shared knowledge base
 * (no user_id scoping). The user_id column is kept as creator provenance
 * (metadata) only. Deleting a user must NOT cascade-delete their notes or
 * configs — those resources stay in the shared KB with a null creator.
 *
 * Follows the handwritten pattern used by the other knowledge-agent
 * migrations because the columns involve FK + index changes that
 * migration:generate does not always detect cleanly.
 */
export class MakeKaNotesAndConfigsUserIdNullable1787397644619
  implements MigrationInterface
{
  name = 'MakeKaNotesAndConfigsUserIdNullable1787397644619';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── ext_ka_notes ───────────────────────────────────────────────
    // Drop the CASCADE FK, alter column to nullable, recreate FK as SET NULL.
    await queryRunner.query(`
      ALTER TABLE "ext_ka_notes"
        DROP CONSTRAINT IF EXISTS "FK_ka_notes_user"
    `);
    await queryRunner.query(`
      ALTER TABLE "ext_ka_notes"
        ALTER COLUMN "user_id" DROP NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "ext_ka_notes"
        ADD CONSTRAINT "FK_ka_notes_user"
          FOREIGN KEY ("user_id") REFERENCES "user"("id")
          ON DELETE SET NULL
    `);

    // ── ext_ka_agent_configs ────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE "ext_ka_agent_configs"
        DROP CONSTRAINT IF EXISTS "FK_ka_agent_configs_user"
    `);
    await queryRunner.query(`
      ALTER TABLE "ext_ka_agent_configs"
        ALTER COLUMN "user_id" DROP NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "ext_ka_agent_configs"
        ADD CONSTRAINT "FK_ka_agent_configs_user"
          FOREIGN KEY ("user_id") REFERENCES "user"("id")
          ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert: SET NULL → CASCADE, and restore NOT NULL.
    // NOTE: down will FAIL if there are rows with NULL user_id; callers must
    // backfill user_id before reverting. This matches the original schema.

    // ── ext_ka_agent_configs ────────────────────────────────────────
    await queryRunner.query(`
      UPDATE "ext_ka_agent_configs" SET "user_id" = COALESCE("user_id", 0)
        WHERE "user_id" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "ext_ka_agent_configs"
        DROP CONSTRAINT IF EXISTS "FK_ka_agent_configs_user"
    `);
    await queryRunner.query(`
      ALTER TABLE "ext_ka_agent_configs"
        ALTER COLUMN "user_id" SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "ext_ka_agent_configs"
        ADD CONSTRAINT "FK_ka_agent_configs_user"
          FOREIGN KEY ("user_id") REFERENCES "user"("id")
          ON DELETE CASCADE
    `);

    // ── ext_ka_notes ───────────────────────────────────────────────
    await queryRunner.query(`
      UPDATE "ext_ka_notes" SET "user_id" = COALESCE("user_id", 0)
        WHERE "user_id" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "ext_ka_notes"
        DROP CONSTRAINT IF EXISTS "FK_ka_notes_user"
    `);
    await queryRunner.query(`
      ALTER TABLE "ext_ka_notes"
        ALTER COLUMN "user_id" SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "ext_ka_notes"
        ADD CONSTRAINT "FK_ka_notes_user"
          FOREIGN KEY ("user_id") REFERENCES "user"("id")
          ON DELETE CASCADE
    `);
  }
}