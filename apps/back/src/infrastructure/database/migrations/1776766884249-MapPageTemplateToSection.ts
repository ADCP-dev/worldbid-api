import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';
import { Logger } from '@nestjs/common';

export class MapPageTemplateToSection1776766884249
  implements MigrationInterface
{
  private readonly logger = new Logger('MapPageTemplateToSection1776766884249');
  name = 'MapPageTemplateToSection1776766884249';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add backup column to support rollback
    await queryRunner.addColumn(
      'page',
      new TableColumn({
        name: 'template_backup',
        type: 'varchar',
        length: '50',
        isNullable: true,
      }),
    );

    // Backup existing template values
    await queryRunner.query(`
      UPDATE "page" SET "template_backup" = "template"
    `);
    this.logger.log('Backed up template values');

    // Map template values to section values:
    // landing -> landing, generic -> blog, contact -> store, default -> landing
    await queryRunner.query(`
      UPDATE "page" SET "section" = CASE
        WHEN "template" = 'landing' THEN 'landing'
        WHEN "template" = 'generic' THEN 'blog'
        WHEN "template" = 'contact' THEN 'store'
        ELSE 'landing'
      END
    `);
    this.logger.log('Mapped template values to section');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore template from backup
    await queryRunner.query(`
      UPDATE "page" SET "template" = "template_backup" WHERE "template_backup" IS NOT NULL
    `);
    this.logger.log('Restored template values from backup');

    // Clear section values populated by this migration
    await queryRunner.query(`
      UPDATE "page" SET "section" = NULL
    `);

    // Drop backup column
    await queryRunner.dropColumn('page', 'template_backup');
    this.logger.log('Dropped template_backup column');
  }
}
