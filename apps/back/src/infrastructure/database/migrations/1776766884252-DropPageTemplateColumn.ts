import { MigrationInterface, QueryRunner } from 'typeorm';
import { Logger } from '@nestjs/common';

export class DropPageTemplateColumn1776766884252 implements MigrationInterface {
  private readonly logger = new Logger('DropPageTemplateColumn1776766884252');
  name = 'DropPageTemplateColumn1776766884252';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop template column (idempotent via IF EXISTS)
    await queryRunner.query(
      `ALTER TABLE "page" DROP COLUMN IF EXISTS "template"`,
    );
    this.logger.log('Dropped template column from page table');

    // Drop template_backup column if it exists (cleanup from Phase 4)
    await queryRunner.query(
      `ALTER TABLE "page" DROP COLUMN IF EXISTS "template_backup"`,
    );
    this.logger.log('Dropped template_backup column from page table');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore template column — cannot recover data (destructive migration)
    await queryRunner.query(
      `ALTER TABLE "page" ADD COLUMN IF NOT EXISTS "template" varchar(50) DEFAULT 'generic'`,
    );
    this.logger.log('Restored template column on page table (data lost)');

    // Restore template_backup column
    await queryRunner.query(
      `ALTER TABLE "page" ADD COLUMN IF NOT EXISTS "template_backup" varchar(50)`,
    );
    this.logger.log('Restored template_backup column on page table');
  }
}
