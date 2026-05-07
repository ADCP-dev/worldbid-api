import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserLanguage1778076135292 implements MigrationInterface {
  name = 'AddUserLanguage1778076135292';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "ext_stripe_product" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "stripeId" character varying, "name" character varying NOT NULL, "description" text, "active" boolean NOT NULL DEFAULT true, "metadata" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_cbb6e669c1dcbf299dac942ae6d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."ext_stripe_price_type_enum" AS ENUM('one_time', 'recurring')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."ext_stripe_price_interval_enum" AS ENUM('month', 'year')`,
    );
    await queryRunner.query(
      `CREATE TABLE "ext_stripe_price" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "stripeId" character varying, "productId" uuid NOT NULL, "currency" character varying NOT NULL DEFAULT 'eur', "unitAmount" integer NOT NULL, "type" "public"."ext_stripe_price_type_enum" NOT NULL DEFAULT 'recurring', "interval" "public"."ext_stripe_price_interval_enum", "active" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "REL_1be4c0ecfcc643839e369058e3" UNIQUE ("productId"), CONSTRAINT "PK_eb2789e3fee5cfbbadf26af4ca9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "ext_stripe_plan" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "description" text, "priceId" uuid NOT NULL, "maxUsers" integer, "maxStorage" bigint, "features" jsonb, "isDefault" boolean NOT NULL DEFAULT false, "active" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "REL_fb5f82d127a606e982e16def8e" UNIQUE ("priceId"), CONSTRAINT "PK_833fa94d40abd5718160246259c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."ext_stripe_subscription_status_enum" AS ENUM('active', 'past_due', 'canceled', 'incomplete', 'trialing')`,
    );
    await queryRunner.query(
      `CREATE TABLE "ext_stripe_subscription" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "stripeId" character varying, "userId" integer NOT NULL, "planId" uuid NOT NULL, "status" "public"."ext_stripe_subscription_status_enum" NOT NULL DEFAULT 'incomplete', "currentPeriodStart" TIMESTAMP, "currentPeriodEnd" TIMESTAMP, "trialEnd" TIMESTAMP, "cancelAtPeriodEnd" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "REL_e6c6d88159fb26badf29677798" UNIQUE ("planId"), CONSTRAINT "PK_e085d53fa34711368bf9876d5d4" PRIMARY KEY ("id"))`,
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
      `CREATE TYPE "public"."ext_stripe_usage_record_action_enum" AS ENUM('set', 'increment')`,
    );
    await queryRunner.query(
      `CREATE TABLE "ext_stripe_usage_record" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "subscriptionId" uuid NOT NULL, "stripeId" character varying, "quantity" integer NOT NULL, "timestamp" TIMESTAMP NOT NULL DEFAULT now(), "action" "public"."ext_stripe_usage_record_action_enum" NOT NULL DEFAULT 'set', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "REL_8174938adc93a343df498c8c78" UNIQUE ("subscriptionId"), CONSTRAINT "PK_9ba3df24dae5be6c9dec241988b" PRIMARY KEY ("id"))`,
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
      `ALTER TABLE "user" ADD "language" character varying(5)`,
    );
    await queryRunner.query(`ALTER TABLE "translation" DROP COLUMN "category"`);
    await queryRunner.query(
      `ALTER TABLE "translation" ADD "category" character varying`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ea73dc8ba4e3cd20823a585eb0" ON "translation" ("category") `,
    );
    await queryRunner.query(
      `ALTER TABLE "ext_stripe_price" ADD CONSTRAINT "FK_1be4c0ecfcc643839e369058e31" FOREIGN KEY ("productId") REFERENCES "ext_stripe_product"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ext_stripe_plan" ADD CONSTRAINT "FK_fb5f82d127a606e982e16def8e3" FOREIGN KEY ("priceId") REFERENCES "ext_stripe_price"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ext_stripe_subscription" ADD CONSTRAINT "FK_e6c6d88159fb26badf296777987" FOREIGN KEY ("planId") REFERENCES "ext_stripe_plan"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ext_cms_page" ADD CONSTRAINT "FK_8417554c0980ae76b6f7b0da359" FOREIGN KEY ("featuredImageId") REFERENCES "file"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ext_cms_page" ADD CONSTRAINT "FK_55b296234ecac9b0cac4cb7e025" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ext_stripe_usage_record" ADD CONSTRAINT "FK_8174938adc93a343df498c8c78d" FOREIGN KEY ("subscriptionId") REFERENCES "ext_stripe_subscription"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "ext_cms_seo_metadata" ADD CONSTRAINT "FK_af49c0d215b7c268343f1b1f1ce" FOREIGN KEY ("ogImageId") REFERENCES "file"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
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
      `ALTER TABLE "ext_cms_seo_metadata" DROP CONSTRAINT "FK_af49c0d215b7c268343f1b1f1ce"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ext_stripe_usage_record" DROP CONSTRAINT "FK_8174938adc93a343df498c8c78d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ext_cms_page" DROP CONSTRAINT "FK_55b296234ecac9b0cac4cb7e025"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ext_cms_page" DROP CONSTRAINT "FK_8417554c0980ae76b6f7b0da359"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ext_stripe_subscription" DROP CONSTRAINT "FK_e6c6d88159fb26badf296777987"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ext_stripe_plan" DROP CONSTRAINT "FK_fb5f82d127a606e982e16def8e3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "ext_stripe_price" DROP CONSTRAINT "FK_1be4c0ecfcc643839e369058e31"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ea73dc8ba4e3cd20823a585eb0"`,
    );
    await queryRunner.query(`ALTER TABLE "translation" DROP COLUMN "category"`);
    await queryRunner.query(
      `ALTER TABLE "translation" ADD "category" character varying(50)`,
    );
    await queryRunner.query(`ALTER TABLE "user" DROP COLUMN "language"`);
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
      `DROP INDEX "public"."IDX_d00c4237c267bec99e38f2736d"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1a9cd0486d562c3b0e301a7007"`,
    );
    await queryRunner.query(`DROP TABLE "ext_cms_seo_metadata"`);
    await queryRunner.query(`DROP TABLE "ext_stripe_usage_record"`);
    await queryRunner.query(
      `DROP TYPE "public"."ext_stripe_usage_record_action_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_437ab43e4dbf5aeefd5ff1b6e8"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_49c769b2b3b3d10c3567a4f534"`,
    );
    await queryRunner.query(`DROP TABLE "ext_cms_page"`);
    await queryRunner.query(`DROP TYPE "public"."ext_cms_page_section_enum"`);
    await queryRunner.query(`DROP TABLE "ext_stripe_subscription"`);
    await queryRunner.query(
      `DROP TYPE "public"."ext_stripe_subscription_status_enum"`,
    );
    await queryRunner.query(`DROP TABLE "ext_stripe_plan"`);
    await queryRunner.query(`DROP TABLE "ext_stripe_price"`);
    await queryRunner.query(
      `DROP TYPE "public"."ext_stripe_price_interval_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."ext_stripe_price_type_enum"`);
    await queryRunner.query(`DROP TABLE "ext_stripe_product"`);
  }
}
