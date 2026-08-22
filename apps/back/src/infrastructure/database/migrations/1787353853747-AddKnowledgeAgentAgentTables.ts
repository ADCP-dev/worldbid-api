import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Create knowledge-agent agent runtime tables:
 *   - ext_ka_agent_configs
 *   - ext_ka_model_providers
 *   - ext_ka_models
 *   - ext_ka_mcp_servers
 *
 * These back the DeepAgent runtime (Phase 3): agent configs (system prompt +
 * model + sandbox permissions + MCP server ids), model provider registry
 * (Ollama / OpenRouter), per-provider models, and MCP server registry.
 *
 * Follows the same handwritten pattern as CreateKnowledgeAgentTables — these
 * tables use jsonb + uuid FKs that TypeORM sync cannot reliably detect, and
 * `migration:generate` hangs connecting to the dev DB (Fase 1 deviation).
 */
export class AddKnowledgeAgentAgentTables1787353853747
  implements MigrationInterface
{
  name = 'AddKnowledgeAgentAgentTables1787353853747';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── ext_ka_model_providers ─────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "ext_ka_model_providers" (
        "id"          uuid NOT NULL DEFAULT gen_random_uuid(),
        "name"        varchar(255) NOT NULL,
        "provider"    varchar(64) NOT NULL,
        "api_key_ref" varchar(255),
        "base_url"    varchar(255),
        "enabled"     boolean NOT NULL DEFAULT true,
        "created_at"  timestamp NOT NULL DEFAULT now(),
        "updated_at"  timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ka_model_providers" PRIMARY KEY ("id")
      )
    `);

    // ── ext_ka_models ──────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "ext_ka_models" (
        "id"            uuid NOT NULL DEFAULT gen_random_uuid(),
        "provider_id"   uuid NOT NULL,
        "model_id"      varchar(255) NOT NULL,
        "display_name"  varchar(255) NOT NULL,
        "context_window" int NOT NULL,
        "active"        boolean NOT NULL DEFAULT true,
        "created_at"    timestamp NOT NULL DEFAULT now(),
        "updated_at"    timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ka_models" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ka_models_provider" FOREIGN KEY ("provider_id")
          REFERENCES "ext_ka_model_providers"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_ka_models_provider_id" ON "ext_ka_models" ("provider_id")`,
    );

    // ── ext_ka_agent_configs ───────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "ext_ka_agent_configs" (
        "id"            uuid NOT NULL DEFAULT gen_random_uuid(),
        "name"          varchar(255) NOT NULL,
        "system_prompt" text NOT NULL,
        "model"         varchar(255) NOT NULL,
        "provider"      varchar(64) NOT NULL,
        "permissions"   jsonb NOT NULL DEFAULT '{"allow":[],"deny":[]}',
        "mcp_server_ids" jsonb NOT NULL DEFAULT '[]',
        "user_id"       int NOT NULL,
        "created_at"    timestamp NOT NULL DEFAULT now(),
        "updated_at"    timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ka_agent_configs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ka_agent_configs_user" FOREIGN KEY ("user_id")
          REFERENCES "user"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_ka_agent_configs_user_id" ON "ext_ka_agent_configs" ("user_id")`,
    );

    // ── ext_ka_mcp_servers ─────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE "ext_ka_mcp_servers" (
        "id"              uuid NOT NULL DEFAULT gen_random_uuid(),
        "agent_config_id" uuid,
        "name"            varchar(255) NOT NULL,
        "transport"       varchar(16) NOT NULL,
        "url"             varchar(512) NOT NULL,
        "api_key_ref"     varchar(255),
        "enabled"         boolean NOT NULL DEFAULT true,
        "created_at"      timestamp NOT NULL DEFAULT now(),
        "updated_at"      timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ka_mcp_servers" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ka_mcp_servers_agent_config" FOREIGN KEY ("agent_config_id")
          REFERENCES "ext_ka_agent_configs"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_ka_mcp_servers_agent_config_id" ON "ext_ka_mcp_servers" ("agent_config_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "ext_ka_mcp_servers"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ext_ka_agent_configs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ext_ka_models"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ext_ka_model_providers"`);
  }
}