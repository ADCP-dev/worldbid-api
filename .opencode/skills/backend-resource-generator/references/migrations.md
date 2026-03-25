# Migrations Reference

TypeORM migrations for database schema management.

## Generate Migration

Create migration by comparing entity schema with current database:

```bash
npm run migration:generate --name=AddProductTable
```

> **Note:** The `--name` flag may have issues. Alternative approaches:
>
> 1. Set as environment variable: `name=AddProductTable npm run migration:generate`
> 2. Edit the generated filename manually

## Migration File Location

Generated migrations are placed in:

```
src/infrastructure/database/migrations/{timestamp}-{Name}.ts
```

Example: `src/infrastructure/database/migrations/1715028537217-CreateUser.ts`

## Migration Structure

```typescript
import { MigrationInterface, QueryRunner } from "typeorm";

export class MigrationName1715028537217 implements MigrationInterface {
  name = "MigrationName1715028537217";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Migration logic
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Rollback logic
  }
}
```

## Common Operations

### Create Table

```typescript
await queryRunner.query(`
  CREATE TABLE "product" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "name" character varying NOT NULL,
    "price" decimal NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT "PK_product_id" PRIMARY KEY ("id")
  )
`);
```

### Add Column

```typescript
await queryRunner.query(`
  ALTER TABLE "product" ADD "description" text
`);
```

### Drop Column

```typescript
await queryRunner.query(`
  ALTER TABLE "product" DROP COLUMN "description"
`);
```

### Create Index

```typescript
await queryRunner.query(`
  CREATE INDEX "IDX_product_name" ON "product" ("name")
`);
```

### Drop Index

```typescript
await queryRunner.query(`
  DROP INDEX "public"."IDX_product_name"
`);
```

### Add Foreign Key

```typescript
await queryRunner.query(`
  ALTER TABLE "product" 
  ADD CONSTRAINT "FK_product_category" 
  FOREIGN KEY ("categoryId") REFERENCES "category"("id") 
  ON DELETE NO ACTION ON UPDATE NO ACTION
`);
```

### Drop Foreign Key

```typescript
await queryRunner.query(`
  ALTER TABLE "product" DROP CONSTRAINT "FK_product_category"
`);
```

### Create Table with Foreign Keys

```typescript
public async up(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(`
    CREATE TABLE "order" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "status" character varying NOT NULL DEFAULT 'pending',
      "userId" integer NOT NULL,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_order_id" PRIMARY KEY ("id")
    )
  `);

  await queryRunner.query(`
    CREATE INDEX "IDX_order_user" ON "order" ("userId")
  `);

  await queryRunner.query(`
    ALTER TABLE "order"
    ADD CONSTRAINT "FK_order_user"
    FOREIGN KEY ("userId") REFERENCES "user"("id")
    ON DELETE NO ACTION ON UPDATE NO ACTION
  `);
}
```

## Correct Order for Down Migration

When writing `down()`, reverse operations in correct order:

1. Drop foreign keys first
2. Drop indexes
3. Drop tables (in reverse order of creation)

```typescript
public async down(queryRunner: QueryRunner): Promise<void> {
  // 1. Drop foreign keys
  await queryRunner.query(`
    ALTER TABLE "order" DROP CONSTRAINT "FK_order_user"
  `);

  // 2. Drop indexes
  await queryRunner.query(`
    DROP INDEX "public"."IDX_order_user"
  `);

  // 3. Drop tables
  await queryRunner.query(`DROP TABLE "order"`);
}
```

## TypeORM Column Types

| Type           | Database  | Notes                                |
| -------------- | --------- | ------------------------------------ |
| `uuid`         | UUID      | Use `uuid_generate_v4()` for default |
| `varchar`      | VARCHAR   | Default 255 chars                    |
| `text`         | TEXT      | Unlimited text                       |
| `int`          | INT       | Integer                              |
| `bigint`       | BIGINT    | Large integer                        |
| `decimal`      | DECIMAL   | Specify precision/scale              |
| `boolean`      | BOOLEAN   | True/false                           |
| `jsonb`        | JSONB     | PostgreSQL JSON binary               |
| `timestamp`    | TIMESTAMP | With time                            |
| `date`         | DATE      | Date only                            |
| `simple-array` | TEXT      | CSV stored as text                   |

## UUID Generation

In PostgreSQL, enable uuid extension:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

Or use built-in:

```sql
uuid_generate_v4()
```

## Migration Commands

### Run All Pending Migrations

```bash
npm run migration:run
```

### Revert Last Migration

```bash
npm run migration:revert
```

### Show Migration Status

```bash
npm run typeorm -- migration:show
```

### Create Empty Migration

```bash
npm run migration:create -- src/infrastructure/database/migrations/MigrationName
```

### Generate Without Running

```bash
npm run migration:generate --name=MigrationName
```

## Transaction Pattern

For multi-step migrations, wrap in transaction:

```typescript
public async up(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.connection.transaction(async transactionalEntityManager => {
    await transactionalEntityManager.query(`
      CREATE TABLE ...
    `);
    await transactionalEntityManager.query(`
      CREATE INDEX ...
    `);
  });
}
```

## Data Migration

For migrating data (not just schema):

```typescript
public async up(queryRunner: QueryRunner): Promise<void> {
  // 1. Add new column (nullable)
  await queryRunner.query(`
    ALTER TABLE "user" ADD "newEmail" character varying
  `);

  // 2. Migrate data
  await queryRunner.query(`
    UPDATE "user" SET "newEmail" = "email"
  `);

  // 3. Drop old column
  await queryRunner.query(`
    ALTER TABLE "user" DROP COLUMN "email"
  `);

  // 4. Rename column
  await queryRunner.query(`
    ALTER TABLE "user" RENAME COLUMN "newEmail" TO "email"
  `);
}
```

## Best Practices

1. **Always write the `down()` method** - migrations should be reversible
2. **Use raw SQL** - don't rely on TypeORM's query builder for migrations
3. **Test `down()` before deploying** - ensure rollback works
4. **Keep migrations small** - one logical change per migration
5. **Use meaningful names** - `AddUserEmailIndex` not `Migration1`

## Common Migration Issues

### Issue: uuid_generate_v4() not found

Solution: Ensure PostgreSQL uuid extension is enabled:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

Or use `gen_random_uuid()` in PostgreSQL 13+:

```sql
DEFAULT gen_random_uuid()
```

### Issue: Table already exists

The migration was already run. Check `__Migrations` table or use:

```bash
npm run migration:revert
npm run migration:run
```

### Issue: Column already exists

Column was already added. Either:

1. Skip the migration (not recommended)
2. Delete the migration file and regenerate
3. Manually add only the missing parts
