import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFileCleanupErrors1773045312476 implements MigrationInterface {
  name = 'AddFileCleanupErrors1773045312476';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "file_cleanup_errors" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "file_uri" character varying NOT NULL, "driver" character varying NOT NULL, "attempts" integer NOT NULL DEFAULT '0', "error_message" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_9069db096cec11eca51bb0d2ee7" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "file_cleanup_errors"`);
  }
}
