import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddCategoryToTranslation1776766884247
  implements MigrationInterface
{
  name = 'AddCategoryToTranslation1776766884247';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'translation',
      new TableColumn({
        name: 'category',
        type: 'varchar',
        length: '50',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('translation', 'category');
  }
}
