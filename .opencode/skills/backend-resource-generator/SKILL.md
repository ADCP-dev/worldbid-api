---
name: backend-resource-generator
description: |-
  Generate NestJS backend resources, properties, migrations and seeders. Use for creating CRUD modules, adding entity relationships, database migrations and seed data.
  Use proactively when users need to create backend entities, add properties/relationships, or manage database schema.

  Examples:
  - user: "Create a Product resource" → generate full resource with hygen
  - user: "Add a price field to Product" → use add:property with primitive type
  - user: "Product has many Categories" → use add:property with manyToMany reference
  - user: "Run pending migrations" → execute migration:run
  - user: "Create seed data for Roles" → create and edit seeder with idempotent pattern
---

# Backend Resource Generator

Generate NestJS backend resources with TypeORM, including entities, services, controllers, DTOs, mappers, and database migrations/seeders.

## Overview

The backend uses:

- **Hygen** for code generation (templates in `.hygen/`)
- **TypeORM** for database ORM
- **NestJS** modules architecture

## Available Commands

Run from `apps/back` directory:

| Command                                          | Description                       |
| ------------------------------------------------ | --------------------------------- |
| `npm run generate:resource -- --name=User`       | Generate full CRUD resource       |
| `npm run generate:extension -- --name=Extension` | Generate extension resource       |
| `npm run add:property -- ...`                    | Add property to existing resource |
| `npm run add:extension-property -- ...`          | Add property to extension         |
| `npm run seed:create -- --name=User`             | Generate seeder for entity        |
| `npm run migration:generate --name=AddField`     | Generate migration (diff with DB) |
| `npm run migration:run`                          | Run pending migrations            |
| `npm run migration:revert`                       | Revert last migration             |
| `npm run seed:run`                               | Run all seeds                     |

## Generate Resource

Create a complete CRUD module:

```bash
cd apps/back
npm run generate:resource -- --name=Product
```

Generates in `src/custom/product/`:

- Entity (TypeORM)
- Service with CRUD methods
- Controller with REST endpoints
- DTOs (create, update, findAll, findAllPaginated, domain)
- Mapper (domain ↔ persistence)
- Repository

## Add Property to Entity

### Basic Syntax

```bash
npm run add:property -- \
  --name=Product \
  --property=price \
  --kind=primitive \
  --type=decimal \
  --isAddToDto=true \
  --isOptional=false \
  --isNullable=false
```

### Parameters

| Parameter               | Description                                            |
| ----------------------- | ------------------------------------------------------ |
| `--name`                | Entity name (e.g., Product)                            |
| `--property`            | Property name (e.g., price)                            |
| `--kind`                | Type category: `primitive`, `reference`, `duplication` |
| `--type`                | Specific type (varies by kind)                         |
| `--referenceType`       | Relationship type (for `reference` kind)               |
| `--propertyInReference` | Inverse property name (for `oneToMany`)                |
| `--isAddToDto`          | Include in Create/Update DTOs (true/false)             |
| `--isOptional`          | Property is optional (true/false)                      |
| `--isNullable`          | Property can be null (true/false)                      |

### Property Types (`--kind=primitive`)

| `--type`    | TypeScript | Database Column |
| ----------- | ---------- | --------------- |
| `string`    | `string`   | varchar         |
| `text`      | `string`   | text            |
| `number`    | `number`   | int             |
| `decimal`   | `number`   | decimal(10,2)   |
| `boolean`   | `boolean`  | boolean         |
| `Date`      | `Date`     | datetime        |
| `timestamp` | `Date`     | timestamp       |
| `uuid`      | `string`   | uuid            |
| `json`      | `object`   | jsonb           |
| `jsonb`     | `object`   | jsonb           |
| `array`     | `string[]` | simple-array    |
| `enum`      | `string`   | enum            |

### Relationship Types (`--kind=reference`)

| `--referenceType` | Relation | Decorator                    | Notes                            |
| ----------------- | -------- | ---------------------------- | -------------------------------- |
| `oneToOne`        | 1:1      | `@OneToOne` + `@JoinColumn`  | Inverse side auto-generated      |
| `oneToMany`       | 1:N      | `@OneToMany`                 | Requires `--propertyInReference` |
| `manyToOne`       | N:1      | `@ManyToOne`                 | Most common relationship         |
| `manyToMany`      | N:N      | `@ManyToMany` + `@JoinTable` | Auto pivot table                 |

### Examples

**Add string field:**

```bash
npm run add:property -- --name=Product --property=description --kind=primitive --type=text --isAddToDto=true --isOptional=true --isNullable=true
```

**Add number field:**

```bash
npm run add:property -- --name=Product --property=price --kind=primitive --type=decimal --isAddToDto=true --isOptional=false --isNullable=false
```

**Add many-to-one (belongs to):**

```bash
npm run add:property -- --name=Product --property=category --kind=reference --type=Category --referenceType=manyToOne --isAddToDto=true --isOptional=true --isNullable=true
```

**Add one-to-many (has many):**

```bash
npm run add:property -- --name=Category --property=products --kind=reference --type=Product --referenceType=oneToMany --propertyInReference=category --isAddToDto=false --isOptional=true --isNullable=true
```

**Add many-to-many:**

```bash
npm run add:property -- --name=Product --property=tags --kind=reference --type=Tag --referenceType=manyToMany --isAddToDto=true --isOptional=true --isNullable=true
```

## Migrations

### Generate Migration

Creates migration by comparing entity schema with database:

```bash
npm run migration:generate --name=AddProductTable
```

> **Note:** The `--name` flag may not work correctly. Alternative: set `name=MigrationName` as environment variable or edit the generated file.

### Run Migrations

```bash
npm run migration:run
```

### Revert Last Migration

```bash
npm run migration:revert
```

### Drop Schema

```bash
npm run schema:drop
```

### Manual Migration

Create empty migration:

```bash
npm run migration:create -- src/infrastructure/database/migrations/MigrationName
```

Then write `up()` and `down()` methods manually.

## Seeders

### Generate Seeder

```bash
npm run seed:create -- --name=Product
```

Creates:

- `src/database/seeds/relational/product/product-seed.service.ts`
- `src/database/seeds/relational/product/product-seed.module.ts`
- Auto-injects into `seed.module.ts` and `run-seed.ts`

### Idempotent Seeder Pattern

The seeder checks if data exists before inserting:

```typescript
// src/database/seeds/relational/product/product-seed.service.ts
@Injectable()
export class ProductSeedService {
  constructor(
    @InjectRepository(ProductEntity)
    private repository: Repository<ProductEntity>,
  ) {}

  async run() {
    // Check by unique field
    const exists = await this.repository.count({
      where: { id: "some-unique-id" },
    });

    if (!exists) {
      await this.repository.save(
        this.repository.create({
          id: "some-unique-id",
          name: "Sample Product",
          price: 29.99,
        }),
      );
    }
  }
}
```

### Run Seeds

```bash
npm run seed:run
```

Seed execution order:

1. RoleSeedService
2. StatusSeedService
3. UserSeedService
4. Extension seeds (auto-discovered)
5. Translation seeds

## Complete Workflow: New Resource

### Step 1: Generate Resource

```bash
cd apps/back
npm run generate:resource -- --name=Product
```

### Step 2: Add Properties

```bash
# Basic fields
npm run add:property -- --name=Product --property=name --kind=primitive --type=string --isAddToDto=true --isOptional=false --isNullable=false
npm run add:property -- --name=Product --property=price --kind=primitive --type=decimal --isAddToDto=true --isOptional=false --isNullable=false

# Relationships
npm run add:property -- --name=Product --property=category --kind=reference --type=Category --referenceType=manyToOne --isAddToDto=true --isOptional=true --isNullable=true
```

### Step 3: Generate Migration

```bash
npm run migration:generate --name=CreateProduct
# Review and edit migration if needed
```

### Step 4: Run Migration

```bash
npm run migration:run
```

### Step 5: Create Seeder

```bash
npm run seed:create -- --name=Product
```

### Step 6: Edit Seeder

Edit `src/database/seeds/relational/product/product-seed.service.ts` with actual seed data.

### Step 7: Run Seeds

```bash
npm run seed:run
```

## Entity File Location

Resources are generated in `src/custom/{pluralized-name}/`:

- Entity: `src/custom/products/infrastructure/entities/product.entity.ts`

Use `--destination=modules` in development to also copy as extension template.

## See Also

- `references/hygen-commands.md` - Detailed command reference
- `references/add-property.md` - Complete property/relationship parameters
- `references/migrations.md` - Migration patterns and examples
- `references/seeders.md` - Seeder patterns and examples
- `references/workflow.md` - Step-by-step workflows
- `docs/ARCHITECTURE.md` - Project structure and tech stack overview
- `docs/BACKEND-RESOURCES.md` - Complementary backend development guide
- `docs/GENERATORS.md` - Hygen CLI reference
