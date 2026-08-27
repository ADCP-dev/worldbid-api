import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add nullable jsonb `headers` column to ext_ka_mcp_servers.
 *
 * HTTP-transport MCP servers often sit behind gateways that need extra headers
 * (tenant routing, auth proxies). The value is a plain JSON object of
 * header-name → header-value, applied by McpLoaderService when building the
 * MultiServerMCPClient config. Nullable: no-op for existing rows and stdio
 * servers.
 *
 * Handwritten (not migration:generate) because the CLI prompt flow stalls on
 * interactive environments; the change is a single ADD COLUMN + reversal.
 */
export class AddKaMcpServerHeaders1787836800000 implements MigrationInterface {
  name = 'AddKaMcpServerHeaders1787836800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ext_ka_mcp_servers"
        ADD COLUMN IF NOT EXISTS "headers" jsonb NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "ext_ka_mcp_servers"
        DROP COLUMN IF EXISTS "headers"
    `);
  }
}
