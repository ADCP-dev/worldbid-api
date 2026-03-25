# Seeders Reference

Database seed data management using the idempotent pattern.

## Overview

Seeders populate initial data in the database. They use an **idempotent pattern** - running them multiple times produces the same result and won't create duplicates.

## Generate Seeder

```bash
cd apps/back
npm run seed:create -- --name=Product
```

Creates:

```
src/database/seeds/relational/product/
├── product-seed.service.ts
└── product-seed.module.ts
```

Auto-injected into:

- `src/database/seeds/relational/seed.module.ts`
- `src/database/seeds/relational/run-seed.ts`

## Idempotent Pattern

The key principle: **check if data exists before inserting**.

```typescript
@Injectable()
export class ProductSeedService {
  constructor(
    @InjectRepository(ProductEntity)
    private repository: Repository<ProductEntity>,
  ) {}

  async run() {
    // Check by unique field
    const count = await this.repository.count({
      where: { id: "some-unique-id" },
    });

    if (count === 0) {
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

**Key points:**

- Uses `count()` with `where` to check existence
- Only inserts if count is 0
- Uses `repository.create()` + `repository.save()`

## Basic Seeder Template

```typescript
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ProductEntity } from "@src/products/infrastructure/entities/product.entity";

@Injectable()
export class ProductSeedService {
  constructor(
    @InjectRepository(ProductEntity)
    private repository: Repository<ProductEntity>,
  ) {}

  async run() {
    // Example: Check by id
    const exists = await this.repository.count({
      where: { id: "default-product" },
    });

    if (!exists) {
      await this.repository.save(
        this.repository.create({
          id: "default-product",
          name: "Sample Product",
          description: "This is a sample product",
          price: 19.99,
        }),
      );
    }
  }
}
```

## Seeder with Multiple Records

```typescript
async run() {
  const seedData = [
    { id: 'cat-1', name: 'Electronics' },
    { id: 'cat-2', name: 'Clothing' },
    { id: 'cat-3', name: 'Home & Garden' },
  ];

  for (const data of seedData) {
    const exists = await this.repository.count({ where: { id: data.id } });
    if (!exists) {
      await this.repository.save(this.repository.create(data));
    }
  }
}
```

## Seeder with Enum Values

```typescript
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { RoleEntity } from "@iam/roles/infrastructure/entities/role.entity";
import { RoleEnum } from "@iam/roles/roles.enum";

@Injectable()
export class RoleSeedService {
  constructor(
    @InjectRepository(RoleEntity)
    private repository: Repository<RoleEntity>,
  ) {}

  async run() {
    // Seed customer role
    const customerExists = await this.repository.count({
      where: { id: RoleEnum.customer },
    });
    if (!customerExists) {
      await this.repository.save(
        this.repository.create({
          id: RoleEnum.customer,
          name: "customer",
        }),
      );
    }

    // Seed admin role
    const adminExists = await this.repository.count({
      where: { id: RoleEnum.admin },
    });
    if (!adminExists) {
      await this.repository.save(
        this.repository.create({
          id: RoleEnum.admin,
          name: "admin",
        }),
      );
    }
  }
}
```

## Seeder with Status Example

```typescript
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { StatusEntity } from "@infra/database/entities/status.entity";
import { StatusEnum } from "@src/status/status.enum";

@Injectable()
export class StatusSeedService {
  constructor(
    @InjectRepository(StatusEntity)
    private repository: Repository<StatusEntity>,
  ) {}

  async run() {
    const statuses = [
      { id: StatusEnum.active, name: "Active" },
      { id: StatusEnum.inactive, name: "Inactive" },
      { id: StatusEnum.pending, name: "Pending" },
    ];

    for (const status of statuses) {
      const exists = await this.repository.count({ where: { id: status.id } });
      if (!exists) {
        await this.repository.save(this.repository.create(status));
      }
    }
  }
}
```

## Seeder Module

Generated automatically, but here's the structure:

```typescript
// src/database/seeds/relational/product/product-seed.module.ts
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ProductEntity } from "@src/products/infrastructure/entities/product.entity";
import { ProductSeedService } from "./product-seed.service";

@Module({
  imports: [TypeOrmModule.forFeature([ProductEntity])],
  providers: [ProductSeedService],
  exports: [ProductSeedService],
})
export class ProductSeedModule {}
```

## Run Seeds

```bash
npm run seed:run
```

## Seed Execution Order

Seeds run in this order:

1. `RoleSeedService` - Roles (admin, customer)
2. `StatusSeedService` - Statuses (active, inactive)
3. `UserSeedService` - Default users
4. Extension seeds - Auto-discovered from extensions
5. `TranslationSeedService` - I18n translations

## Adding to Run Seed

When you create a seeder, it's auto-injected into `run-seed.ts`:

```typescript
// src/database/seeds/relational/run-seed.ts
const runSeed = async () => {
  const app = await NestFactory.create(SeedModule);

  await app.get(RoleSeedService).run();
  await app.get(StatusSeedService).run();
  await app.get(UserSeedService).run();

  // Extension seeds (auto-discovered)
  await runExtensionSeeds(app);

  // Translations
  try {
    const { TranslationSeedService } = await import(...);
    await app.get(TranslationSeedService).run();
  } catch (e) {
    console.warn('Translation seed skipped');
  }

  await app.close();
};
```

## Cascade Considerations

If your entities have required foreign keys, seed in dependency order:

1. Seed entities without foreign keys first
2. Seed entities with foreign keys second

Example:

1. `RoleSeedService` - no dependencies
2. `StatusSeedService` - no dependencies
3. `UserSeedService` - depends on Role, Status
4. `ProductSeedService` - depends on Category (seed Category first)

## User Seeder Example

```typescript
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as bcrypt from "bcryptjs";
import { UserEntity } from "@iam/users/infrastructure/entities/user.entity";
import { RoleEnum } from "@iam/roles/roles.enum";
import { StatusEnum } from "@infra/database/enums/status.enum";

@Injectable()
export class UserSeedService {
  constructor(
    @InjectRepository(UserEntity)
    private repository: Repository<UserEntity>,
  ) {}

  async run() {
    const adminExists = await this.repository.count({
      where: { email: "admin@example.com" },
    });

    if (!adminExists) {
      const hashedPassword = await bcrypt.hash("admin123", 10);

      await this.repository.save(
        this.repository.create({
          email: "admin@example.com",
          password: hashedPassword,
          firstName: "Admin",
          lastName: "User",
          roleId: RoleEnum.admin,
          statusId: StatusEnum.active,
        }),
      );
    }
  }
}
```

## Best Practices

1. **Always check existence** - use `count()` or `findOne()` before insert
2. **Use unique fields** - `id`, `email`, or other unique columns
3. **Seed dependencies first** - entities without FKs before entities with FKs
4. **Use transactions** - for related seeds:
   ```typescript
   async run() {
     await this.dataSource.transaction(async manager => {
       // seed logic with manager
     });
   }
   ```
5. **Don't hardcode IDs** - use enums when possible
6. **Include test data** - realistic data for development

## Troubleshooting

### Issue: Foreign key violation

Cause: Seeding entity that depends on another before that one is seeded.

Solution: Ensure dependencies are seeded first. Check seed execution order.

### Issue: Duplicate data

Cause: Seeder run multiple times but not idempotent.

Solution: Always use existence check before insert.

### Issue: Seeder not running

Cause: Not auto-injected into seed.module.ts or run-seed.ts

Solution: Manually add import to `seed.module.ts` and `run-seed.ts`:

```typescript
// In seed.module.ts imports array
(ProductSeedModule,
  // In run-seed.ts
  await app.get(ProductSeedService).run());
```
