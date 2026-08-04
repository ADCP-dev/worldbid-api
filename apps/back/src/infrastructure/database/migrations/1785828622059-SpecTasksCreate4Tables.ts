import { MigrationInterface, QueryRunner } from 'typeorm';

export class SpecTasksCreate4Tables1785828622059 implements MigrationInterface {
    name = 'SpecTasksCreate4Tables1785828622059'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "ext_tasks_task_activity" ("id" SERIAL NOT NULL, "action" character varying(255) NOT NULL, "description" text NOT NULL, "userId" integer, "taskId" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_4fea865900000000000000000000000000000000" PRIMARY KEY ("id"), CONSTRAINT "FK_566de96000000000000000000000000000000000" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE SET NULL, CONSTRAINT "CHK_624e924400000000000000000000000000000000" CHECK ("action" IN ('created', 'updated', 'deleted', 'commented')));
        CREATE INDEX "IDX_7ddc2c7900000000000000000000000000000000" ON "ext_tasks_task_activity" ("action");
        CREATE INDEX "IDX_358724f900000000000000000000000000000000" ON "ext_tasks_task_activity" ("userId");
        CREATE INDEX "IDX_25cbdb8e00000000000000000000000000000000" ON "ext_tasks_task_activity" ("taskId");`);
        await queryRunner.query(`CREATE TABLE "ext_tasks_task_attachment" ("id" SERIAL NOT NULL, "filename" character varying(255) NOT NULL, "taskId" integer NOT NULL, "file" character varying, "files" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_72d3ea9400000000000000000000000000000000" PRIMARY KEY ("id"));
        CREATE INDEX "IDX_538e473c00000000000000000000000000000000" ON "ext_tasks_task_attachment" ("taskId");`);
        await queryRunner.query(`CREATE TABLE "ext_tasks_task_comment" ("id" SERIAL NOT NULL, "taskId" integer NOT NULL, "authorId" integer, "content" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_50c538b300000000000000000000000000000000" PRIMARY KEY ("id"), CONSTRAINT "FK_7a41089900000000000000000000000000000000" FOREIGN KEY ("authorId") REFERENCES "user" ("id") ON DELETE SET NULL);
        CREATE INDEX "IDX_07766f3800000000000000000000000000000000" ON "ext_tasks_task_comment" ("taskId");
        CREATE INDEX "IDX_5ba7a5b500000000000000000000000000000000" ON "ext_tasks_task_comment" ("authorId");`);
        await queryRunner.query(`CREATE TABLE "ext_tasks_task" ("id" SERIAL NOT NULL, "title" character varying(200) NOT NULL, "description" text, "status" character varying(255) NOT NULL DEFAULT 'pending', "priority" character varying(255) NOT NULL DEFAULT 'medium', "assigneeId" integer, "reporterId" integer, "dueDate" TIMESTAMP WITH TIME ZONE, "position" integer DEFAULT 0, "estimateHours" numeric(10,2), "metadata" jsonb DEFAULT '{}', "isRecurring" boolean DEFAULT false, "recurrenceRule" character varying(200), "apiKey" character varying(255), "attachment" character varying, "coverImage" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "PK_6c11ed8100000000000000000000000000000000" PRIMARY KEY ("id"), CONSTRAINT "FK_1df5bc2800000000000000000000000000000000" FOREIGN KEY ("assigneeId") REFERENCES "user" ("id") ON DELETE SET NULL, CONSTRAINT "FK_373ef63a00000000000000000000000000000000" FOREIGN KEY ("reporterId") REFERENCES "user" ("id") ON DELETE SET NULL, CONSTRAINT "CHK_7aeb50dc00000000000000000000000000000000" CHECK ("status" IN ('pending', 'in_progress', 'review', 'done', 'blocked')), CONSTRAINT "CHK_15709c6900000000000000000000000000000000" CHECK ("priority" IN ('low', 'medium', 'high', 'urgent')));
        CREATE INDEX "IDX_4f45eaf400000000000000000000000000000000" ON "ext_tasks_task" ("status");
        CREATE INDEX "IDX_07a66cee00000000000000000000000000000000" ON "ext_tasks_task" ("priority");
        CREATE INDEX "IDX_02e3393600000000000000000000000000000000" ON "ext_tasks_task" ("assigneeId");
        CREATE INDEX "IDX_52f6d63900000000000000000000000000000000" ON "ext_tasks_task" ("reporterId");
        CREATE INDEX "IDX_2d828d2000000000000000000000000000000000" ON "ext_tasks_task" ("dueDate");`);
        await queryRunner.query(`ALTER TABLE "ext_tasks_task_activity" ADD CONSTRAINT "FK_23a58a6900000000000000000000000000000000" FOREIGN KEY ("taskId") REFERENCES "ext_tasks_task" ("id") ON DELETE CASCADE;`);
        await queryRunner.query(`ALTER TABLE "ext_tasks_task_attachment" ADD CONSTRAINT "FK_76021f4000000000000000000000000000000000" FOREIGN KEY ("taskId") REFERENCES "ext_tasks_task" ("id") ON DELETE CASCADE;`);
        await queryRunner.query(`ALTER TABLE "ext_tasks_task_comment" ADD CONSTRAINT "FK_2f3791a600000000000000000000000000000000" FOREIGN KEY ("taskId") REFERENCES "ext_tasks_task" ("id") ON DELETE CASCADE;`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ext_tasks_task_comment" DROP CONSTRAINT "FK_2f3791a600000000000000000000000000000000";`);
        await queryRunner.query(`ALTER TABLE "ext_tasks_task_attachment" DROP CONSTRAINT "FK_76021f4000000000000000000000000000000000";`);
        await queryRunner.query(`ALTER TABLE "ext_tasks_task_activity" DROP CONSTRAINT "FK_23a58a6900000000000000000000000000000000";`);
        await queryRunner.query(`DROP INDEX "IDX_7111a15000000000000000000000000000000000";
        DROP INDEX "IDX_71b10da600000000000000000000000000000000";
        DROP INDEX "IDX_2124a7b300000000000000000000000000000000";
        DROP INDEX "IDX_14428c0300000000000000000000000000000000";
        DROP INDEX "IDX_78f8a54700000000000000000000000000000000";
        DROP TABLE "ext_tasks_task";`);
        await queryRunner.query(`DROP INDEX "IDX_2fb4687900000000000000000000000000000000";
        DROP INDEX "IDX_708c537000000000000000000000000000000000";
        DROP TABLE "ext_tasks_task_comment";`);
        await queryRunner.query(`DROP INDEX "IDX_6d68554d00000000000000000000000000000000";
        DROP TABLE "ext_tasks_task_attachment";`);
        await queryRunner.query(`DROP INDEX "IDX_5c4c761a00000000000000000000000000000000";
        DROP INDEX "IDX_080cb21500000000000000000000000000000000";
        DROP INDEX "IDX_3e95f6d000000000000000000000000000000000";
        DROP TABLE "ext_tasks_task_activity";`);
    }
}
