import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Enable pgvector and ltree extensions.
 *
 * These are PostgreSQL extensions required by the knowledge-agent extension:
 * - `vector`: pgvector for embedding similarity search (cosine distance).
 * - `ltree`: hierarchical category paths for tree-based note queries.
 *
 * Both use `CREATE EXTENSION IF NOT EXISTS` — safe to run multiple times.
 * Requires superuser privileges in Postgres.
 */
export class AddPgvectorAndLtreeExtensions1787353853745
  implements MigrationInterface
{
  name = 'AddPgvectorAndLtreeExtensions1787353853745';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector;`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS ltree;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP EXTENSION IF EXISTS ltree;`);
    await queryRunner.query(`DROP EXTENSION IF EXISTS vector;`);
  }
}