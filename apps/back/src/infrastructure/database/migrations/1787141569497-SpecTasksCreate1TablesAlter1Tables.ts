import { MigrationInterface, QueryRunner } from 'typeorm';

export class SpecTasksCreate1TablesAlter1Tables1787141569497 implements MigrationInterface {
    name = 'SpecTasksCreate1TablesAlter1Tables1787141569497'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "ext_tasks_task_note" ("id" SERIAL NOT NULL, "content" text NOT NULL, "authorId" integer, "taskId" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_3cba4fa300000000000000000000000000000000" PRIMARY KEY ("id"), CONSTRAINT "FK_5fd26c6b00000000000000000000000000000000" FOREIGN KEY ("authorId") REFERENCES "user" ("id") ON DELETE SET NULL);
        CREATE INDEX "IDX_462ac9c800000000000000000000000000000000" ON "ext_tasks_task_note" ("authorId");
        CREATE INDEX "IDX_1b1813cc00000000000000000000000000000000" ON "ext_tasks_task_note" ("taskId");`);
        await queryRunner.query(`ALTER TABLE "ext_tasks_task" ADD COLUMN "tags" jsonb DEFAULT '{}';`);
        await queryRunner.query(`ALTER TABLE "ext_tasks_task_note" ADD CONSTRAINT "FK_60c36e9d00000000000000000000000000000000" FOREIGN KEY ("taskId") REFERENCES "ext_tasks_task" ("id") ON DELETE CASCADE;`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ext_tasks_task_note" DROP CONSTRAINT "FK_60c36e9d00000000000000000000000000000000";`);
        await queryRunner.query(`ALTER TABLE "ext_tasks_task" DROP COLUMN "tags";`);
        await queryRunner.query(`DROP INDEX "IDX_210069dc00000000000000000000000000000000";
        DROP INDEX "IDX_3790907100000000000000000000000000000000";
        DROP TABLE "ext_tasks_task_note";`);
    }
}
