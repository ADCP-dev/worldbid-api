import { MigrationInterface, QueryRunner } from 'typeorm';
import { Logger } from '@nestjs/common';

export class PopulatePostTagSlug1776766884251 implements MigrationInterface {
  private readonly logger = new Logger('PopulatePostTagSlug1776766884251');
  name = 'PopulatePostTagSlug1776766884251';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Get tags with null slug
    const tags = await queryRunner.query(
      `SELECT id, name FROM "post_tag" WHERE slug IS NULL`,
    );

    this.logger.log(`Found ${tags.length} tags without slugs`);

    if (tags.length === 0) {
      return;
    }

    // Get all existing slugs to avoid duplicates
    const existingSlugsResult = await queryRunner.query(
      `SELECT slug FROM "post_tag" WHERE slug IS NOT NULL`,
    );
    const usedSlugs = new Set(
      existingSlugsResult.map((r: { slug: string }) => r.slug),
    );

    for (const tag of tags) {
      const baseSlug = this.slugify(tag.name);
      let slug = baseSlug;
      let counter = 1;

      while (usedSlugs.has(slug)) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      usedSlugs.add(slug);

      await queryRunner.query(`UPDATE "post_tag" SET slug = $1 WHERE id = $2`, [
        slug,
        tag.id,
      ]);
    }

    this.logger.log(`Populated slugs for ${tags.length} tags`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Clear all slugs (cannot distinguish auto-populated vs manually set)
    await queryRunner.query(`UPDATE "post_tag" SET slug = NULL`);
    this.logger.log('Cleared post tag slugs');
  }

  private slugify(text: string): string {
    return text
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-');
  }
}
