import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddSectionToPage1776766884246 implements MigrationInterface {
  name = 'AddSectionToPage1776766884246';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'page',
      new TableColumn({
        name: 'section',
        type: 'varchar',
        length: '50',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('page', 'section');
  }
}
