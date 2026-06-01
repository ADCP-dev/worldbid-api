import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1777883404629 implements MigrationInterface {
  name = 'Init1777883404629';

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
    await queryRunner.query(
      `CREATE TABLE "lang" ("id" SERIAL NOT NULL, "code" character varying NOT NULL, "name" character varying NOT NULL, "flagCode" character varying, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "UQ_93c97de5fdcebb43a6b68a21f46" UNIQUE ("code"), CONSTRAINT "PK_1c6b76e1e18ad677569858be1c9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "role" ("id" integer NOT NULL, "name" character varying NOT NULL, CONSTRAINT "PK_b36bcfe02fc8de3c57a8b2391c2" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "status" ("id" integer NOT NULL, "name" character varying NOT NULL, CONSTRAINT "PK_e12743a7086ec826733f54e1d95" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "user" ("id" SERIAL NOT NULL, "email" character varying, "password" character varying, "provider" character varying NOT NULL DEFAULT 'email', "socialId" character varying, "firstName" character varying, "lastName" character varying, "stripeCustomerId" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "roleId" integer, "statusId" integer, CONSTRAINT "UQ_e12875dfb3b1d92d7d7c5377e22" UNIQUE ("email"), CONSTRAINT "UQ_0bfe583759eb0305b60117be840" UNIQUE ("stripeCustomerId"), CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9bd2fe7a8e694dedc4ec2f666f" ON "user" ("socialId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_58e4dbff0e1a32a9bdc861bb29" ON "user" ("firstName") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f0e1b4ecdca13b177e2e3a0613" ON "user" ("lastName") `,
    );
    await queryRunner.query(
      `CREATE TABLE "translation" ("id" SERIAL NOT NULL, "app" character varying, "section" character varying NOT NULL, "key" character varying NOT NULL, "content" text NOT NULL, "entityName" character varying, "entityId" character varying, "category" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "langId" integer, CONSTRAINT "PK_7aef875e43ab80d34a0cdd39c70" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_951df7b8bf1b7302ec2db66bbd" ON "translation" ("app") `,
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
    await queryRunner.query(
      `CREATE INDEX "IDX_ea73dc8ba4e3cd20823a585eb0" ON "translation" ("category") `,
    );
    await queryRunner.query(
      `CREATE TABLE "file" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "path" character varying NOT NULL, "name" character varying NOT NULL, "isPublic" boolean NOT NULL DEFAULT true, "entityName" character varying, "entityId" character varying, "context" character varying, "userId" integer, "type" character varying NOT NULL, "size" bigint NOT NULL, CONSTRAINT "PK_36b46d232307066b3a2c9ea3a1d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "file_cleanup_errors" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "file_uri" character varying NOT NULL, "driver" character varying NOT NULL, "attempts" integer NOT NULL DEFAULT '0', "error_message" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_9069db096cec11eca51bb0d2ee7" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "session" ("id" SERIAL NOT NULL, "hash" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, "userId" integer, CONSTRAINT "PK_f55da76ac1c3ac420f444d2ff11" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3d2f174ef04fb312fdebd0ddc5" ON "session" ("userId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "api_key" ("id" SERIAL NOT NULL, "key" character varying NOT NULL, "userId" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_fb080786c16de6ace7ed0b69f7d" UNIQUE ("key"), CONSTRAINT "PK_b1bd840641b8acbaad89c3d8d11" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_fb080786c16de6ace7ed0b69f7" ON "api_key" ("key") `,
    );
    await queryRunner.query(
      `CREATE TABLE "ext_cms_seo_metadata" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "pageId" uuid NOT NULL, "lang" character varying(10) NOT NULL, "metaTitle" character varying(70), "metaDescription" character varying(160), "metaKeywords" text, "ogImageId" uuid, "canonicalUrl" character varying, "ogTitle" character varying(70), "ogDescription" character varying(200), "customJsonLd" jsonb, "type" character varying(20), "robotsPolicy" jsonb, "hreflangEnabled" boolean DEFAULT true, "hreflangAlternateLocales" text, "hreflangCustomUrls" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_70ecf6685148e0106f97d6608aa" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1a9cd0486d562c3b0e301a7007" ON "ext_cms_seo_metadata" ("pageId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d00c4237c267bec99e38f2736d" ON "ext_cms_seo_metadata" ("lang") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."ext_cms_page_section_enum" AS ENUM('landing', 'blog', 'documentation', 'store')`,
    );
    await queryRunner.query(
      `CREATE TABLE "ext_cms_page" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "slug" character varying NOT NULL, "route" character varying, "section" "public"."ext_cms_page_section_enum", "order" integer NOT NULL DEFAULT '0', "parentId" uuid, "isPublished" boolean NOT NULL DEFAULT false, "publishedAt" TIMESTAMP, "featuredImageId" uuid, "authorId" integer, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_bd63c69757f529be8475850b7d0" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_49c769b2b3b3d10c3567a4f534" ON "ext_cms_page" ("name") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_437ab43e4dbf5aeefd5ff1b6e8" ON "ext_cms_page" ("slug") `,
    );
    await queryRunner.query(
      `CREATE TABLE "ext_cms_blog_category" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "slug" character varying NOT NULL, "name" character varying(100) NOT NULL, "order" integer NOT NULL DEFAULT '0', "parentId" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_ca81a10e4c2d18a43865c4abefc" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_b8a65919ad519386625363c0c3" ON "ext_cms_blog_category" ("slug") `,
    );
    await queryRunner.query(
      `CREATE TABLE "ext_cms_blog_post" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "slug" character varying NOT NULL, "isPublished" boolean NOT NULL DEFAULT false, "publishedAt" TIMESTAMP, "featuredImageId" uuid, "authorId" integer, "categoryId" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_4eaafa0da74aef51693de5aae1c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_dae375b6ac50f3ffe26e60fab3" ON "ext_cms_blog_post" ("slug") `,
    );
    await queryRunner.query(
      `CREATE TABLE "ext_cms_post_tag" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "slug" character varying(100) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_4a77b848b466d988bc6127b2110" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_3a72e0f2d027bdb97dbbbdf852" ON "ext_cms_post_tag" ("name") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_0d3b0ef2f17c2c23bd795abf70" ON "ext_cms_post_tag" ("slug") `,
    );
    await queryRunner.query(
      `CREATE TABLE "ext_cms_blog_category_tag" ("categoryId" uuid NOT NULL, "tagId" uuid NOT NULL, CONSTRAINT "PK_3f20308fd2437a0f001bad7d0ce" PRIMARY KEY ("categoryId", "tagId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8d99b2e2448cd35b8d20bb9452" ON "ext_cms_blog_category_tag" ("categoryId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_05332dc8df7d209aa3c67fa2f3" ON "ext_cms_blog_category_tag" ("tagId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "ext_cms_blog_post_tag" ("postId" uuid NOT NULL, "tagId" uuid NOT NULL, CONSTRAINT "PK_3c07f748886f06313442e9d5281" PRIMARY KEY ("postId", "tagId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_28fa2ec123eb5ab2b9ead8bf11" ON "ext_cms_blog_post_tag" ("postId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ad7342855f4613c267880aad19" ON "ext_cms_blog_post_tag" ("tagId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD CONSTRAINT "FK_c28e52f758e7bbc53828db92194" FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" ADD CONSTRAINT "FK_dc18daa696860586ba4667a9d31" FOREIGN KEY ("statusId") REFERENCES "status"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "translation" ADD CONSTRAINT "FK_14b169181b406881cd72b55fa42" FOREIGN KEY ("langId") REFERENCES "lang"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "file" ADD CONSTRAINT "FK_b2d8e683f020f61115edea206b3" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "session" ADD CONSTRAINT "FK_3d2f174ef04fb312fdebd0ddc53" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "api_key" ADD CONSTRAINT "FK_277972f4944205eb29127f9bb6c" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ext_cms_seo_metadata" ADD CONSTRAINT "FK_af49c0d215b7c268343f1b1f1ce" FOREIGN KEY ("ogImageId") REFERENCES "file"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ext_cms_page" ADD CONSTRAINT "FK_8417554c0980ae76b6f7b0da359" FOREIGN KEY ("featuredImageId") REFERENCES "file"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ext_cms_page" ADD CONSTRAINT "FK_55b296234ecac9b0cac4cb7e025" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ext_cms_blog_category" ADD CONSTRAINT "FK_e602a1c5b2d0365f09b3fb6e5fb" FOREIGN KEY ("parentId") REFERENCES "ext_cms_blog_category"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ext_cms_blog_post" ADD CONSTRAINT "FK_93a71caba600866de97e04c7be7" FOREIGN KEY ("featuredImageId") REFERENCES "file"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ext_cms_blog_post" ADD CONSTRAINT "FK_087cc718f2c84852adf3208a9f4" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ext_cms_blog_post" ADD CONSTRAINT "FK_6fabb68e4908d6331b7c734df6f" FOREIGN KEY ("categoryId") REFERENCES "ext_cms_blog_category"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ext_cms_blog_category_tag" ADD CONSTRAINT "FK_8d99b2e2448cd35b8d20bb94524" FOREIGN KEY ("categoryId") REFERENCES "ext_cms_blog_category"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "ext_cms_blog_category_tag" ADD CONSTRAINT "FK_05332dc8df7d209aa3c67fa2f3c" FOREIGN KEY ("tagId") REFERENCES "ext_cms_post_tag"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "ext_cms_blog_post_tag" ADD CONSTRAINT "FK_28fa2ec123eb5ab2b9ead8bf111" FOREIGN KEY ("postId") REFERENCES "ext_cms_blog_post"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "ext_cms_blog_post_tag" ADD CONSTRAINT "FK_ad7342855f4613c267880aad19e" FOREIGN KEY ("tagId") REFERENCES "ext_cms_post_tag"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ext_cms_blog_post_tag" DROP CONSTRAINT "FK_ad7342855f4613c267880aad19e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ext_cms_blog_post_tag" DROP CONSTRAINT "FK_28fa2ec123eb5ab2b9ead8bf111"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ext_cms_blog_category_tag" DROP CONSTRAINT "FK_05332dc8df7d209aa3c67fa2f3c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ext_cms_blog_category_tag" DROP CONSTRAINT "FK_8d99b2e2448cd35b8d20bb94524"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ext_cms_blog_post" DROP CONSTRAINT "FK_6fabb68e4908d6331b7c734df6f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ext_cms_blog_post" DROP CONSTRAINT "FK_087cc718f2c84852adf3208a9f4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ext_cms_blog_post" DROP CONSTRAINT "FK_93a71caba600866de97e04c7be7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ext_cms_blog_category" DROP CONSTRAINT "FK_e602a1c5b2d0365f09b3fb6e5fb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ext_cms_page" DROP CONSTRAINT "FK_55b296234ecac9b0cac4cb7e025"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ext_cms_page" DROP CONSTRAINT "FK_8417554c0980ae76b6f7b0da359"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ext_cms_seo_metadata" DROP CONSTRAINT "FK_af49c0d215b7c268343f1b1f1ce"`,
    );
    await queryRunner.query(
      `ALTER TABLE "api_key" DROP CONSTRAINT "FK_277972f4944205eb29127f9bb6c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "session" DROP CONSTRAINT "FK_3d2f174ef04fb312fdebd0ddc53"`,
    );
    await queryRunner.query(
      `ALTER TABLE "file" DROP CONSTRAINT "FK_b2d8e683f020f61115edea206b3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "translation" DROP CONSTRAINT "FK_14b169181b406881cd72b55fa42"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" DROP CONSTRAINT "FK_dc18daa696860586ba4667a9d31"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user" DROP CONSTRAINT "FK_c28e52f758e7bbc53828db92194"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ad7342855f4613c267880aad19"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_28fa2ec123eb5ab2b9ead8bf11"`,
    );
    await queryRunner.query(`DROP TABLE "ext_cms_blog_post_tag"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_05332dc8df7d209aa3c67fa2f3"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_8d99b2e2448cd35b8d20bb9452"`,
    );
    await queryRunner.query(`DROP TABLE "ext_cms_blog_category_tag"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0d3b0ef2f17c2c23bd795abf70"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3a72e0f2d027bdb97dbbbdf852"`,
    );
    await queryRunner.query(`DROP TABLE "ext_cms_post_tag"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_dae375b6ac50f3ffe26e60fab3"`,
    );
    await queryRunner.query(`DROP TABLE "ext_cms_blog_post"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_b8a65919ad519386625363c0c3"`,
    );
    await queryRunner.query(`DROP TABLE "ext_cms_blog_category"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_437ab43e4dbf5aeefd5ff1b6e8"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_49c769b2b3b3d10c3567a4f534"`,
    );
    await queryRunner.query(`DROP TABLE "ext_cms_page"`);
    await queryRunner.query(`DROP TYPE "public"."ext_cms_page_section_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_d00c4237c267bec99e38f2736d"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1a9cd0486d562c3b0e301a7007"`,
    );
    await queryRunner.query(`DROP TABLE "ext_cms_seo_metadata"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_fb080786c16de6ace7ed0b69f7"`,
    );
    await queryRunner.query(`DROP TABLE "api_key"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_3d2f174ef04fb312fdebd0ddc5"`,
    );
    await queryRunner.query(`DROP TABLE "session"`);
    await queryRunner.query(`DROP TABLE "file_cleanup_errors"`);
    await queryRunner.query(`DROP TABLE "file"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ea73dc8ba4e3cd20823a585eb0"`,
    );
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
    await queryRunner.query(
      `DROP INDEX "public"."IDX_951df7b8bf1b7302ec2db66bbd"`,
    );
    await queryRunner.query(`DROP TABLE "translation"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f0e1b4ecdca13b177e2e3a0613"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_58e4dbff0e1a32a9bdc861bb29"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9bd2fe7a8e694dedc4ec2f666f"`,
    );
    await queryRunner.query(`DROP TABLE "user"`);
    await queryRunner.query(`DROP TABLE "status"`);
    await queryRunner.query(`DROP TABLE "role"`);
    await queryRunner.query(`DROP TABLE "lang"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_9c8d4c24666877a0fa01f97b3c"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_aac54649e0fb4b2952af88aedf"`,
    );
    await queryRunner.query(`DROP TABLE "error_logs"`);
  }
}
