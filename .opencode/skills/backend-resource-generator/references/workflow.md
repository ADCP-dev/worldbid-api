# Workflows

Step-by-step workflows for common backend development tasks.

## Workflow 1: Create New Resource

Create a complete CRUD resource with entity, service, controller, DTOs, and mapper.

### Prerequisites

- Database running and connected
- TypeORM configured

### Steps

#### Step 1: Generate Resource Structure

```bash
cd apps/back
npm run generate:resource -- --name=Product
```

This creates in `src/custom/products/`:

- Entity with uuid primary key
- Service with CRUD methods
- Controller with REST endpoints
- DTOs for create, update, findAll, pagination
- Domain entity
- Mapper
- Repository

#### Step 2: Add Properties

Add primitive fields:

```bash
npm run add:property -- --name=Product --property=name --kind=primitive --type=string --isAddToDto=true --isOptional=false --isNullable=false

npm run add:property -- --name=Product --property=description --kind=primitive --type=text --isAddToDto=true --isOptional=true --isNullable=true

npm run add:property -- --name=Product --property=price --kind=primitive --type=decimal --isAddToDto=true --isOptional=false --isNullable=false
```

Add relationships:

```bash
# Product belongs to Category (manyToOne)
npm run add:property -- --name=Product --property=category --kind=reference --type=Category --referenceType=manyToOne --isAddToDto=true --isOptional=true --isNullable=true

# Category has many Products (oneToMany)
npm run add:property -- --name=Category --property=products --kind=reference --type=Product --referenceType=oneToMany --propertyInReference=category --isAddToDto=false --isOptional=true --isNullable=true
```

#### Step 3: Generate Migration

```bash
npm run migration:generate --name=CreateProduct
```

Review and edit the generated migration if needed:

- File: `src/infrastructure/database/migrations/{timestamp}-CreateProduct.ts`
- Add indexes
- Add constraints
- Fix any issues

#### Step 4: Run Migration

```bash
npm run migration:run
```

Verify tables created:

```bash
npm run typeorm -- migration:show
```

#### Step 5: Create Seeder

```bash
npm run seed:create -- --name=Product
```

#### Step 6: Edit Seeder with Data

Edit `src/database/seeds/relational/product/product-seed.service.ts`:

```typescript
async run() {
  const categories = [
    { id: 'cat-electronics', name: 'Electronics' },
    { id: 'cat-clothing', name: 'Clothing' },
  ];

  for (const cat of categories) {
    const exists = await this.repository.count({ where: { id: cat.id } });
    if (!exists) {
      await this.repository.save(this.repository.create(cat));
    }
  }

  const products = [
    { id: 'prod-1', name: 'Laptop', price: 999.99, categoryId: 'cat-electronics' },
    { id: 'prod-2', name: 'T-Shirt', price: 29.99, categoryId: 'cat-clothing' },
  ];

  for (const prod of products) {
    const exists = await this.repository.count({ where: { id: prod.id } });
    if (!exists) {
      await this.repository.save(this.repository.create(prod));
    }
  }
}
```

#### Step 7: Run Seeds

```bash
npm run seed:run
```

---

## Workflow 2: Add Property to Existing Entity

Add a new field to an already created entity.

### Scenario: Add email field to User

```bash
npm run add:property -- \
  --name=User \
  --property=email \
  --kind=primitive \
  --type=string \
  --isAddToDto=true \
  --isOptional=false \
  --isNullable=false
```

### Scenario: Add phone field (optional)

```bash
npm run add:property -- \
  --name=User \
  --property=phone \
  --kind=primitive \
  --type=string \
  --isAddToDto=true \
  --isOptional=true \
  --isNullable=true
```

### Scenario: Add photo relationship

```bash
npm run add:property -- \
  --name=User \
  --property=photo \
  --kind=reference \
  --type=File \
  --referenceType=oneToOne \
  --isAddToDto=true \
  --isOptional=true \
  --isNullable=true
```

### After Adding Property

1. **Generate migration:**

   ```bash
   npm run migration:generate --name=AddUserEmail
   ```

2. **Run migration:**
   ```bash
   npm run migration:run
   ```

---

## Workflow 3: Add Relationship Between Entities

Create a new relationship between two existing entities.

### Example: User has many Orders

#### Step 1: Add relation to User (has many)

```bash
npm run add:property -- \
  --name=User \
  --property=orders \
  --kind=reference \
  --type=Order \
  --referenceType=oneToMany \
  --propertyInReference=user \
  --isAddToDto=false \
  --isOptional=true \
  --isNullable=true
```

This automatically adds inverse `user` property to Order with `manyToOne`.

#### Step 2: Generate and run migration

```bash
npm run migration:generate --name=AddUserOrdersRelation
npm run migration:run
```

---

## Workflow 4: Create Extension Resource

Extensions are pluggable modules that can be enabled/disabled.

```bash
cd apps/back
npm run generate:extension -- --name=Analytics
```

Creates:

- All resource files
- Extension config
- Seed service/module for extension data

---

## Workflow 5: Add Property to Extension

```bash
npm run add:extension-property -- \
  --name=Analytics \
  --property=trackingId \
  --kind=primitive \
  --type=string \
  --isAddToDto=true \
  --isOptional=true \
  --isNullable=true
```

---

## Workflow 6: Revert Problematic Migration

If a migration causes issues:

```bash
# Step 1: Revert last migration
npm run migration:revert

# Step 2: Fix the migration file
# Edit: src/infrastructure/database/migrations/{timestamp}-ProblemMigration.ts

# Step 3: Run migrations again
npm run migration:run
```

Or for a complete reset (destructive):

```bash
# Drop entire schema
npm run schema:drop

# Create fresh (you'll lose all data)
npm run migration:run
```

---

## Workflow 7: Create Seed Data for Testing

### Step 1: Create or edit seeder

```bash
npm run seed:create -- --name=TestData
```

### Step 2: Add realistic test data

Edit `src/database/seeds/relational/test-data/test-data-seed.service.ts`:

```typescript
async run() {
  // Create test users
  const users = [
    { email: 'test1@example.com', firstName: 'Test', lastName: 'User 1' },
    { email: 'test2@example.com', firstName: 'Test', lastName: 'User 2' },
  ];

  for (const user of users) {
    const exists = await this.repository.count({ where: { email: user.email } });
    if (!exists) {
      await this.repository.save(this.repository.create(user));
    }
  }
}
```

### Step 3: Run seeds

```bash
npm run seed:run
```

---

## Workflow 8: Update Existing Seeder

If you need to add more seed data:

### Step 1: Edit the seeder

Open `src/database/seeds/relational/{entity}/{entity}-seed.service.ts`

### Step 2: Add new seed entries

```typescript
async run() {
  // Existing seed
  const existingData = [
    { id: 'existing-1', name: 'Existing Item' },
  ];

  for (const item of existingData) {
    const exists = await this.repository.count({ where: { id: item.id } });
    if (!exists) {
      await this.repository.save(this.repository.create(item));
    }
  }

  // New seed data
  const newData = [
    { id: 'new-1', name: 'New Item 1' },
    { id: 'new-2', name: 'New Item 2' },
  ];

  for (const item of newData) {
    const exists = await this.repository.count({ where: { id: item.id } });
    if (!exists) {
      await this.repository.save(this.repository.create(item));
    }
  }
}
```

### Step 3: Run seeds

```bash
npm run seed:run
```

---

## Workflow 9: Create Manual Migration

For complex changes that can't be auto-generated:

### Step 1: Create empty migration

```bash
npm run migration:create -- src/infrastructure/database/migrations/ManualChangeDescription
```

### Step 2: Write the migration

Edit the generated file:

```typescript
import { MigrationInterface, QueryRunner } from "typeorm";

export class ManualChangeDescription1234567890 implements MigrationInterface {
  name = "ManualChangeDescription1234567890";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Your SQL here
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "my_table" (...)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "my_table"`);
  }
}
```

### Step 3: Run migration

```bash
npm run migration:run
```

---

## Quick Reference: Command Order

When working on new features:

```
1. generate:resource / generate:extension
2. add:property / add:extension-property (multiple times)
3. migration:generate
4. migration:run
5. seed:create
6. Edit seeder with real data
7. seed:run
```

---

## Quick Reference: Property Commands

```
# String
--kind=primitive --type=string

# Text
--kind=primitive --type=text

# Number
--kind=primitive --type=number

# Decimal (price)
--kind=primitive --type=decimal

# Boolean
--kind=primitive --type=boolean

# Date
--kind=primitive --type=Date

# UUID
--kind=primitive --type=uuid

# JSONB
--kind=primitive --type=jsonb

# ManyToOne relation
--kind=reference --type=RelatedEntity --referenceType=manyToOne

# OneToMany relation
--kind=reference --type=RelatedEntity --referenceType=oneToMany --propertyInReference=inverseProperty

# OneToOne relation
--kind=reference --type=RelatedEntity --referenceType=oneToOne

# ManyToMany relation
--kind=reference --type=RelatedEntity --referenceType=manyToMany
```
