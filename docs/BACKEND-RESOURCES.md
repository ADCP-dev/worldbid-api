# Backend Resources — Creating CRUD Modules & Migrations

This guide covers the full lifecycle of adding a new backend resource: generating the code, writing migrations, and registering the module.

---

## 1. Generate a Resource with Hygen

From `apps/back/`:

```bash
pnpm generate:resource
# or for an extension resource:
pnpm generate:extension
```

This creates a full **Domain-Driven** NestJS module under the appropriate group. When prompted, enter:

- **Resource name** (e.g. `product`) — generates `ProductModule`, `ProductController`, `ProductService`, `ProductEntity`, and DTOs.

> The generator creates the folder inside `src/modules/<group>/` — you may need to move it to the correct group manually if the generator outputs to `src/<name>/` (the generators work on `src/` by default and may need updating — see [GENERATORS.md](./GENERATORS.md)).

### What Gets Generated

```
src/modules/<group>/<resource>/
├── <resource>.module.ts
├── <resource>.controller.ts
├── <resource>.service.ts
├── domain/
│   └── <resource>.ts          # Domain object with @Expose() decorators
├── dto/
│   ├── create-<resource>.dto.ts
│   ├── update-<resource>.dto.ts
│   └── find-all-<resource>.dto.ts
└── infrastructure/
    ├── persistence.module.ts
    ├── <resource>.repository.ts  # Uses plainToClass() for Entity ↔ Domain
    └── entities/
        └── <resource>.entity.ts   # TypeORM entity
```

**Domain architecture rule**: The service layer always works with the _Domain_ object (a plain class), never directly with the TypeORM entity. Transformation is handled by class-transformer's `plainToClass()` with `@Expose()` and `@Type()` decorators. This keeps business logic free from database concerns.

---

## 2. Register the Module in `app.module.ts`

Open `src/app.module.ts` and import your module:

```typescript
import { ProductModule } from "@modules/products/product.module";

@Module({
  imports: [
    // ... existing modules
    ProductModule,
  ],
})
export class AppModule {}
```

> Use the appropriate tsconfig path alias (e.g. `@iam/`, `@users/`, `@comms/`, `@billing/`, `@storage/`) or `@src/` for the root. See [ARCHITECTURE.md](./ARCHITECTURE.md#typescript-path-aliases).

---

## 3. Add a Property to an Existing Resource

```bash
pnpm add:property
# For extension resources:
pnpm add:extension-property
```

This prompts for the resource name and property details (name, type, nullable) and updates:

- The TypeORM entity
- The domain object
- `create-*.dto.ts` and `update-*.dto.ts`
- The mapper

After running, **always generate a migration** (step 4).

---

## 4. Database Migrations

TypeORM migrations live in:

```
src/infrastructure/database/migrations/
```

### Generate a Migration (from schema diff)

After editing an entity, run from `apps/back/`:

```bash
pnpm migration:generate AddProductPriceColumn
```

This compares your current entities against the live database and generates a migration file with timestamp in `src/infrastructure/database/migrations/<timestamp>-AddProductPriceColumn.ts`.

**Always review the generated file before running it.**

### Create an Empty Migration (manual SQL)

```bash
pnpm migration:create src/infrastructure/database/migrations/MyManualMigration
```

Useful for data migrations or complex queries that TypeORM can't auto-generate.

### Run Migrations

```bash
pnpm migration:run
```

### Rollback Last Migration

```bash
pnpm migration:revert
```

### Migration File Anatomy

```typescript
import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProductPriceColumn1715028537217 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "product" ADD "price" numeric`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "product" DROP COLUMN "price"`);
  }
}
```

The timestamp prefix ensures migrations run in order.

---

## 5. Database Seeds

Seeds populate the database with initial data (roles, admin user, statuses).

```
src/infrastructure/database/seeds/
└── run-seed.ts       # Entry point — runs all seeders in order
└── relational/
    ├── role/
    ├── status/
    └── user/
```

Run all seeds:

```bash
pnpm seed:run
```

> ⚠️ Seeds use `upsert` — they are safe to run multiple times.

---

## 6. Module Anatomy

A typical module imports its own persistence module (which provides the repository):

```typescript
// product.module.ts
@Module({
  imports: [ProductRelationalPersistenceModule],
  controllers: [ProductController],
  providers: [ProductService],
  exports: [ProductService],
})
export class ProductModule {}
```

```typescript
// infrastructure/persistence.module.ts
@Module({
  imports: [TypeOrmModule.forFeature([ProductEntity])],
  providers: [
    { provide: ProductRepository, useClass: ProductRelationalRepository },
  ],
  exports: [ProductRepository],
})
export class ProductRelationalPersistenceModule {}
```

The **Service** always injects the abstract `ProductRepository`, not the concrete class — this allows swapping ORMs easily in the future.

---

## 7. Validation & DTOs

DTOs use `class-validator` decorators:

```typescript
import { IsString, IsEmail, IsOptional, IsEnum } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateProductDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;
}
```

Validation is applied globally via the `ValidationPipe` in `main.ts`.

---

## 8. Utility Helpers

Located in `src/infrastructure/utils/`:

| File                                      | Purpose                                          |
| ----------------------------------------- | ------------------------------------------------ |
| `types/nullable.type.ts`                  | `NullableType<T>` = `T \| null`                  |
| `types/maybe.type.ts`                     | `MaybeType<T>` = `T \| undefined`                |
| `types/pagination-options.ts`             | `IPaginationOptions` interface                   |
| `infinity-pagination.ts`                  | `infinityPagination(data, options)` helper       |
| `dto/infinity-pagination-response.dto.ts` | Standardized paginated response DTO              |
| `parse-filter.ts`                         | `buildWhereClause()` for dynamic TypeORM filters |
| `transformers/lower-case.transformer.ts`  | Auto-lowercase column transformer                |
| `validate-config.ts`                      | Validates `class-validator` on config objects    |
| `serializer.interceptor.ts`               | Excludes `@Exclude()` fields from responses      |
| `relational-entity-helper.ts`             | Base entity class with TypeORM helpers           |
