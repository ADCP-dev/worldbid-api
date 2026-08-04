import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Create the `spec_schema_snapshots` table that stores a JSON snapshot of
 * each extension's spec schema after each migration generation. The
 * MigrationGenerator reads the previous snapshot to produce ALTER TABLE
 * diffs (add/drop/alter columns) instead of always CREATE TABLE.
 *
 * Schema:
 *   - id: SERIAL PK
 *   - extension_name: VARCHAR, unique (one snapshot per extension)
 *   - snapshot: JSONB (the full SpecSnapshot object)
 *   - created_at: timestamp (last update)
 */
export class CreateSpecSchemaSnapshotsTable1785837000000
  implements MigrationInterface
{
  name = 'CreateSpecSchemaSnapshotsTable1785837000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "spec_schema_snapshots" (
        "id" SERIAL NOT NULL PRIMARY KEY,
        "extension_name" VARCHAR(100) NOT NULL UNIQUE,
        "snapshot" JSONB NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_spec_schema_snapshots_extension_name"
      ON "spec_schema_snapshots" ("extension_name")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_spec_schema_snapshots_extension_name"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "spec_schema_snapshots"`);
  }
}