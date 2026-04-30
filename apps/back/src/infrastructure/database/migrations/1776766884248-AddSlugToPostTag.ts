import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableIndex,
} from 'typeorm';

export class AddSlugToPostTag1776766884248 implements MigrationInterface {
  name = 'AddSlugToPostTag1776766884248';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'post_tag',
      new TableColumn({
        name: 'slug',
        type: 'varchar',
        length: '100',
        isNullable: true,
      }),
    );

    await queryRunner.createIndex(
      'post_tag',
      new TableIndex({
        name: 'idx_post_tag_slug_unique',
        columnNames: ['slug'],
        isUnique: true,
        where: '"deletedAt" IS NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('post_tag', 'idx_post_tag_slug_unique');
    await queryRunner.dropColumn('post_tag', 'slug');
  }
}
