import { MigrationInterface, QueryRunner } from 'typeorm';

export class LangMigration1771688106730 implements MigrationInterface {
  name = 'LangMigration1771688106730';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "lang" ("id" SERIAL NOT NULL, "code" character varying NOT NULL, "name" character varying NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "UQ_93c97de5fdcebb43a6b68a21f46" UNIQUE ("code"), CONSTRAINT "PK_1c6b76e1e18ad677569858be1c9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "translation" ("id" SERIAL NOT NULL, "section" character varying NOT NULL, "key" character varying NOT NULL, "content" text NOT NULL, "entityName" character varying, "entityId" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "langId" integer, CONSTRAINT "PK_7aef875e43ab80d34a0cdd39c70" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8c4b123e090d286ebebf8ed4dd" ON "translation" ("section") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_adaebf2c3c178a45177662d977" ON "translation" ("key") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9c2b5217c2f24485b2c3e94f44" ON "translation" ("entityName") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_303b992bd6dbfefe76547de4b6" ON "translation" ("entityId") `,
    );
    await queryRunner.query(`ALTER TABLE "file" DROP COLUMN "entityId"`);
    await queryRunner.query(
      `ALTER TABLE "file" ADD "entityId" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "translation" ADD CONSTRAINT "FK_14b169181b406881cd72b55fa42" FOREIGN KEY ("langId") REFERENCES "lang"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "translation" DROP CONSTRAINT "FK_14b169181b406881cd72b55fa42"`,
    );
    await queryRunner.query(`ALTER TABLE "file" DROP COLUMN "entityId"`);
    await queryRunner.query(`ALTER TABLE "file" ADD "entityId" integer`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_303b992bd6dbfefe76547de4b6"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9c2b5217c2f24485b2c3e94f44"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_adaebf2c3c178a45177662d977"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8c4b123e090d286ebebf8ed4dd"`,
    );
    await queryRunner.query(`DROP TABLE "translation"`);
    await queryRunner.query(`DROP TABLE "lang"`);
  }
}
