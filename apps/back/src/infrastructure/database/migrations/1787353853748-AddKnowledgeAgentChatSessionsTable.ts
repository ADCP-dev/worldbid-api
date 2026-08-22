import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Create the knowledge-agent chat sessions table.
 *
 * `ext_ka_chat_sessions` backs the per-user chat (Fase 5):
 *   - user_id (int FK user(id), CASCADE) scopes every session to its owner
 *   - agent_config_id (uuid FK ext_ka_agent_configs(id), SET NULL) is
 *     nullable so a session can fall back to the user's default config
 *   - title defaults to 'New Chat'
 *
 * Handwritten for the same reason as Fase 1/3 migrations: jsonb + uuid FKs
 * that TypeORM sync cannot reliably detect, and `migration:generate` hangs
 * connecting to the dev DB.
 */
export class AddKnowledgeAgentChatSessionsTable1787353853748
  implements MigrationInterface
{
  name = 'AddKnowledgeAgentChatSessionsTable1787353853748';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "ext_ka_chat_sessions" (
        "id"               uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id"          int NOT NULL,
        "agent_config_id"  uuid,
        "title"            varchar(255) NOT NULL DEFAULT 'New Chat',
        "created_at"       timestamp NOT NULL DEFAULT now(),
        "updated_at"       timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ka_chat_sessions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ka_chat_sessions_user" FOREIGN KEY ("user_id")
          REFERENCES "user"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_ka_chat_sessions_agent_config" FOREIGN KEY ("agent_config_id")
          REFERENCES "ext_ka_agent_configs"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_ka_chat_sessions_user_id" ON "ext_ka_chat_sessions" ("user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "ext_ka_chat_sessions"`);
  }
}