import { MigrationInterface, QueryRunner } from 'typeorm';

export class ApiKey1754473488050 implements MigrationInterface {
  name = 'ApiKey1754473488050';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "api_key" ("id" SERIAL NOT NULL, "key" character varying NOT NULL, "userId" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_fb080786c16de6ace7ed0b69f7d" UNIQUE ("key"), CONSTRAINT "PK_b1bd840641b8acbaad89c3d8d11" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fb080786c16de6ace7ed0b69f7" ON "api_key" ("key") `,
    );
    await queryRunner.query(
      `ALTER TABLE "api_key" ADD CONSTRAINT "FK_277972f4944205eb29127f9bb6c" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "api_key" DROP CONSTRAINT "FK_277972f4944205eb29127f9bb6c"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_fb080786c16de6ace7ed0b69f7"`,
    );
    await queryRunner.query(`DROP TABLE "api_key"`);
  }
}
