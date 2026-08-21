import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Create knowledge-agent tables: ext_ka_notes + ext_ka_note_links.
 *
 * ext_ka_notes:
 *   - id: uuid PK with gen_random_uuid()
 *   - category_path: ltree (hierarchical path)
 *   - tags: jsonb (array of strings)
 *   - frontmatter: jsonb (OKF metadata)
 *   - embedding: vector(1536) nullable (pgvector, cosine distance)
 *   - user_id: int FK → user(id) ON DELETE CASCADE
 *   - soft delete via deleted_at
 *
 * Indexes:
 *   - ivfflat on embedding (cosine distance, lists=100)
 *   - gist on category_path (ltree tree search)
 *   - btree on user_id
 *   - partial btree on deleted_at WHERE IS NULL
 *
 * ext_ka_note_links:
 *   - bidirectional note links ([[wikilinks]])
 *   - unique constraint on (source_note_id, target_note_id)
 *   - CASCADE on both FKs
 */
export class CreateKnowledgeAgentTables1787353853746
  implements MigrationInterface
{
  name = 'CreateKnowledgeAgentTables1787353853746';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── ext_ka_notes ──────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "ext_ka_notes" (
        "id"          uuid NOT NULL DEFAULT gen_random_uuid(),
        "title"       varchar(255) NOT NULL,
        "content_md"  text NOT NULL,
        "category_path" ltree,
        "tags"        jsonb NOT NULL DEFAULT '[]',
        "frontmatter" jsonb NOT NULL DEFAULT '{}',
        "embedding"   vector(1536),
        "user_id"     int NOT NULL,
        "created_at"  timestamp NOT NULL DEFAULT now(),
        "updated_at"  timestamp NOT NULL DEFAULT now(),
        "deleted_at"  timestamp,
        CONSTRAINT "PK_ka_notes" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ka_notes_user" FOREIGN KEY ("user_id")
          REFERENCES "user"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_ka_notes_embedding" ON "ext_ka_notes"
       USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100)`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_ka_notes_category_path" ON "ext_ka_notes"
       USING gist ("category_path")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_ka_notes_user_id" ON "ext_ka_notes" ("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_ka_notes_deleted_at" ON "ext_ka_notes" ("deleted_at")
       WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_ka_notes_tags" ON "ext_ka_notes"
       USING gin ("tags")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_ka_notes_frontmatter" ON "ext_ka_notes"
       USING gin ("frontmatter")`,
    );

    // ── ext_ka_note_links ─────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "ext_ka_note_links" (
        "id"              uuid NOT NULL DEFAULT gen_random_uuid(),
        "source_note_id"  uuid NOT NULL,
        "target_note_id"  uuid NOT NULL,
        "created_at"      timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ka_note_links" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ka_links_source" FOREIGN KEY ("source_note_id")
          REFERENCES "ext_ka_notes"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_ka_links_target" FOREIGN KEY ("target_note_id")
          REFERENCES "ext_ka_notes"("id") ON DELETE CASCADE,
        CONSTRAINT "uq_ka_note_links_source_target"
          UNIQUE ("source_note_id", "target_note_id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_ka_links_source" ON "ext_ka_note_links" ("source_note_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_ka_links_target" ON "ext_ka_note_links" ("target_note_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "ext_ka_note_links"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ext_ka_notes"`);
  }
}