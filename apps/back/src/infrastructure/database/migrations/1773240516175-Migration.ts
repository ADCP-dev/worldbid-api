import { MigrationInterface, QueryRunner } from 'typeorm';

export class Migration1773240516175 implements MigrationInterface {
  name = 'Migration1773240516175';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "page" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "slug" character varying NOT NULL, "route" character varying, "template" character varying NOT NULL DEFAULT 'generic', "order" integer NOT NULL DEFAULT '0', "isPublished" boolean NOT NULL DEFAULT false, "publishedAt" TIMESTAMP, "featuredImageId" uuid, "authorId" integer, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_742f4117e065c5b6ad21b37ba1f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_875a4ba4aebdc1855dbf176dad" ON "page" ("slug") `,
    );
    await queryRunner.query(
      `CREATE TABLE "seo_metadata" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "pageId" uuid NOT NULL, "lang" character varying(10) NOT NULL, "metaTitle" character varying(70), "metaDescription" character varying(160), "metaKeywords" text, "ogImageId" uuid, "canonicalUrl" character varying, "ogTitle" character varying(70), "ogDescription" character varying(200), "customJsonLd" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_fcf814530fb2cd86a321cc134df" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9689209adf86761f8bb402016f" ON "seo_metadata" ("pageId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7d1f622267e741bc8701863bd4" ON "seo_metadata" ("lang") `,
    );
    await queryRunner.query(
      `CREATE TABLE "blog_post" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "slug" character varying NOT NULL, "tags" text, "isPublished" boolean NOT NULL DEFAULT false, "publishedAt" TIMESTAMP, "featuredImageId" uuid, "authorId" integer, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_694e842ad1c2b33f5939de6fede" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_7a1f994eda1ad6e18788ca90b9" ON "blog_post" ("slug") `,
    );
    await queryRunner.query(
      `CREATE TABLE "blog_category" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "slug" character varying NOT NULL, "order" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_32b67ddf344608b5c2fb95bc90c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_4f874e7b690965b1e0078512e5" ON "blog_category" ("slug") `,
    );
    await queryRunner.query(
      `ALTER TABLE "page" ADD CONSTRAINT "FK_00c82645ebea5665afb5407fe00" FOREIGN KEY ("featuredImageId") REFERENCES "file"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "page" ADD CONSTRAINT "FK_8810ba4cc4eac84c9c750eaf9e1" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "seo_metadata" ADD CONSTRAINT "FK_78e299f86f6aeb07f22b331ba50" FOREIGN KEY ("ogImageId") REFERENCES "file"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "blog_post" ADD CONSTRAINT "FK_833b2df2498bdc801eba4e48340" FOREIGN KEY ("featuredImageId") REFERENCES "file"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "blog_post" ADD CONSTRAINT "FK_657e11001f05ef48b5383f5a637" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "blog_post" DROP CONSTRAINT "FK_657e11001f05ef48b5383f5a637"`,
    );
    await queryRunner.query(
      `ALTER TABLE "blog_post" DROP CONSTRAINT "FK_833b2df2498bdc801eba4e48340"`,
    );
    await queryRunner.query(
      `ALTER TABLE "seo_metadata" DROP CONSTRAINT "FK_78e299f86f6aeb07f22b331ba50"`,
    );
    await queryRunner.query(
      `ALTER TABLE "page" DROP CONSTRAINT "FK_8810ba4cc4eac84c9c750eaf9e1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "page" DROP CONSTRAINT "FK_00c82645ebea5665afb5407fe00"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_4f874e7b690965b1e0078512e5"`,
    );
    await queryRunner.query(`DROP TABLE "blog_category"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7a1f994eda1ad6e18788ca90b9"`,
    );
    await queryRunner.query(`DROP TABLE "blog_post"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_7d1f622267e741bc8701863bd4"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9689209adf86761f8bb402016f"`,
    );
    await queryRunner.query(`DROP TABLE "seo_metadata"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_875a4ba4aebdc1855dbf176dad"`,
    );
    await queryRunner.query(`DROP TABLE "page"`);
  }
}
