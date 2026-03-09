import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1773059968460 implements MigrationInterface {
  name = 'Migration1773059968460';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "error_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "hash" character varying NOT NULL, "message" character varying NOT NULL, "source" character varying, "stack" text, "metadata" jsonb, "occurrences" integer NOT NULL DEFAULT '1', "resolved" boolean NOT NULL DEFAULT false, "resolvedAt" TIMESTAMP, "firstOccurredAt" TIMESTAMP NOT NULL DEFAULT now(), "lastOccurredAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_aac54649e0fb4b2952af88aedff" UNIQUE ("hash"), CONSTRAINT "PK_6840885d7eb78406fa7d358be72" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_aac54649e0fb4b2952af88aedf" ON "error_logs" ("hash") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9c8d4c24666877a0fa01f97b3c" ON "error_logs" ("resolved") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9c8d4c24666877a0fa01f97b3c"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_aac54649e0fb4b2952af88aedf"`,
    );
    await queryRunner.query(`DROP TABLE "error_logs"`);
  }
}
