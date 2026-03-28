# Add Property Reference

Complete guide for the `add:property` command with all parameter combinations.

## Basic Usage

```bash
npm run add:property -- \
  --name={EntityName} \
  --property={propertyName} \
  --kind={primitive|reference|duplication} \
  --type={typeName} \
  [--referenceType=...] \
  [--propertyInReference=...] \
  [--isAddToDto={true|false}] \
  [--isOptional={true|false}] \
  [--isNullable={true|false}]
```

## Required Parameters

| Parameter    | Description                                       |
| ------------ | ------------------------------------------------- |
| `--name`     | Entity name (PascalCase, e.g., Product)           |
| `--property` | Property name to add (camelCase, e.g., firstName) |
| `--kind`     | Type category                                     |

## Conditional Required Parameters

| `--kind`      | Additional Required         |
| ------------- | --------------------------- |
| `primitive`   | `--type`                    |
| `reference`   | `--type`, `--referenceType` |
| `duplication` | `--type`                    |

## Optional Parameters

| Parameter      | Default | Description                   |
| -------------- | ------- | ----------------------------- |
| `--isAddToDto` | `true`  | Include in Create/Update DTOs |
| `--isOptional` | `false` | Property is optional          |
| `--isNullable` | `false` | Property can be null          |

## `--kind=primitive`

For basic types that become database columns.

### Primitive Types

| `--type`    | TypeScript | Database      | Notes                  |
| ----------- | ---------- | ------------- | ---------------------- |
| `string`    | `string`   | varchar       | Default text           |
| `text`      | `string`   | text          | Long text              |
| `number`    | `number`   | int           | Integer                |
| `decimal`   | `number`   | decimal(10,2) | Decimal number         |
| `boolean`   | `boolean`  | boolean       | True/false             |
| `Date`      | `Date`     | datetime      | Date and time          |
| `timestamp` | `Date`     | timestamp     | Timestamp              |
| `uuid`      | `string`   | uuid          | UUID v4                |
| `json`      | `object`   | jsonb         | JSON object            |
| `jsonb`     | `object`   | jsonb         | JSON (better indexing) |
| `array`     | `string`   | simple-array  | CSV string array       |
| `enum`      | `string`   | enum          | Enum values            |

### Examples: Primitive Properties

**String (username):**

```bash
npm run add:property -- \
  --name=User \
  --property=username \
  --kind=primitive \
  --type=string \
  --isAddToDto=true \
  --isOptional=false \
  --isNullable=false
```

**Text (bio/description):**

```bash
npm run add:property -- \
  --name=User \
  --property=bio \
  --kind=primitive \
  --type=text \
  --isAddToDto=true \
  --isOptional=true \
  --isNullable=true
```

**Boolean (isActive):**

```bash
npm run add:property -- \
  --name=User \
  --property=isActive \
  --kind=primitive \
  --type=boolean \
  --isAddToDto=true \
  --isOptional=true \
  --isNullable=false
```

**Number (age):**

```bash
npm run add:property -- \
  --name=User \
  --property=age \
  --kind=primitive \
  --type=number \
  --isAddToDto=true \
  --isOptional=true \
  --isNullable=true
```

**UUID (externalId):**

```bash
npm run add:property -- \
  --name=Order \
  --property=externalId \
  --kind=primitive \
  --type=uuid \
  --isAddToDto=true \
  --isOptional=true \
  --isNullable=true
```

**Date (birthDate):**

```bash
npm run add:property -- \
  --name=User \
  --property=birthDate \
  --kind=primitive \
  --type=Date \
  --isAddToDto=true \
  --isOptional=true \
  --isNullable=true
```

## `--kind=reference`

For relationships between entities.

### Reference Types

| `--referenceType` | Relation | JPA Equivalent | Description                         |
| ----------------- | -------- | -------------- | ----------------------------------- |
| `oneToOne`        | 1:1      | @OneToOne      | One instance belongs to one other   |
| `oneToMany`       | 1:N      | @OneToMany     | One instance has many of another    |
| `manyToOne`       | N:1      | @ManyToOne     | Many instances belong to one        |
| `manyToMany`      | N:N      | @ManyToMany    | Many instances have many of another |

### When to Use Each

| Scenario                 | Use                              |
| ------------------------ | -------------------------------- |
| User has one Profile     | `User` → `oneToOne` → `Profile`  |
| User has many Posts      | `User` → `oneToMany` → `Post`    |
| Post belongs to one User | `Post` → `manyToOne` → `User`    |
| Product has many Tags    | `Product` → `manyToMany` → `Tag` |

### `--referenceType=oneToOne`

**Entity A contains exactly one Entity B, and Entity B contains exactly one Entity A.**

Example: User has one Profile

**Add to User (owns the relation):**

```bash
npm run add:property -- \
  --name=User \
  --property=profile \
  --kind=reference \
  --type=Profile \
  --referenceType=oneToOne \
  --isAddToDto=true \
  --isOptional=true \
  --isNullable=true
```

The inverse side (Profile.user) is auto-generated.

**Generated Decorators:**

```typescript
@OneToOne(() => ProfileEntity, { eager: true, nullable: true })
@JoinColumn()
profile?: ProfileEntity;
```

### `--referenceType=manyToOne`

**Many Entity A instances belong to one Entity B. Entity B can have many Entity A.**

Example: Many Products belong to one Category

```bash
npm run add:property -- \
  --name=Product \
  --property=category \
  --kind=reference \
  --type=Category \
  --referenceType=manyToOne \
  --isAddToDto=true \
  --isOptional=true \
  --isNullable=true
```

**Generated Decorators:**

```typescript
@ManyToOne(() => CategoryEntity, { eager: false, nullable: true })
category?: CategoryEntity;
```

**In DTO:** The DTO receives `categoryId` (string), not the full object.

### `--referenceType=oneToMany`

**One Entity A instance has many Entity B instances. Each Entity B belongs to exactly one Entity A.**

Example: Category has many Products (the inverse of manyToOne)

```bash
npm run add:property -- \
  --name=Category \
  --property=products \
  --kind=reference \
  --type=Product \
  --referenceType=oneToMany \
  --propertyInReference=category \
  --isAddToDto=false \
  --isOptional=true \
  --isNullable=true
```

**Important:** `--propertyInReference=category` specifies the inverse property in Product entity.

**Generated Decorators:**

```typescript
@OneToMany(() => ProductEntity, (product) => product.category, { eager: true, nullable: true })
products?: ProductEntity[];
```

**Note:** When adding oneToMany, hygen automatically adds the inverse manyToOne to the referenced entity.

### `--referenceType=manyToMany`

**Many Entity A instances can have many Entity B instances. Uses a join table.**

Example: Products can have many Tags, and Tags can have many Products

**Add to Product:**

```bash
npm run add:property -- \
  --name=Product \
  --property=tags \
  --kind=reference \
  --type=Tag \
  --referenceType=manyToMany \
  --isAddToDto=true \
  --isOptional=true \
  --isNullable=true
```

**Generated Decorators:**

```typescript
@ManyToMany(() => TagEntity, { eager: true, nullable: true })
@JoinTable()
tags?: TagEntity[];
```

**In DTO:** The DTO receives `tagIds` (string[]) - array of IDs.

## `--kind=duplication`

For storing denormalized/cached data from related entities as JSONB.

```bash
npm run add:property -- \
  --name=Order \
  --property=customerSnapshot \
  --kind=duplication \
  --type=Customer \
  --isAddToDto=false \
  --isOptional=true \
  --isNullable=true
```

**Generated:**

```typescript
@Column({ type: 'jsonb', nullable: true })
customerSnapshot?: CustomerEntity;
```

Use when you want to store a copy of related entity data without creating a foreign key.

## Parameter Combinations Summary

### Primitive Field Examples

| Scenario         | Command snippet                                                         |
| ---------------- | ----------------------------------------------------------------------- |
| Required string  | `--kind=primitive --type=string --isOptional=false --isNullable=false`  |
| Optional string  | `--kind=primitive --type=string --isOptional=true --isNullable=true`    |
| Required number  | `--kind=primitive --type=number --isOptional=false --isNullable=false`  |
| Required decimal | `--kind=primitive --type=decimal --isOptional=false --isNullable=false` |
| Optional boolean | `--kind=primitive --type=boolean --isOptional=true --isNullable=false`  |
| Optional date    | `--kind=primitive --type=Date --isOptional=true --isNullable=true`      |

### Relationship Examples

| Scenario        | Command snippet                                                                            |
| --------------- | ------------------------------------------------------------------------------------------ |
| Belongs to (FK) | `--kind=reference --type=Category --referenceType=manyToOne`                               |
| Has one         | `--kind=reference --type=Profile --referenceType=oneToOne`                                 |
| Has many        | `--kind=reference --type=Product --referenceType=oneToMany --propertyInReference=category` |
| Many to many    | `--kind=reference --type=Tag --referenceType=manyToMany`                                   |

## DTO Behavior

### `isAddToDto=true`

Property is included in Create and Update DTOs.

**For primitives:** Direct value (e.g., `name: string`)
**For references:** ID value (e.g., `categoryId: string` for manyToOne, `tagIds: string[]` for manyToMany)

### `isAddToDto=false`

Property is NOT included in DTOs. Used for:

- Read-only computed properties
- System-managed fields
- Inverse sides of relationships

## Optional vs Nullable

| Combination                          | Meaning                                |
| ------------------------------------ | -------------------------------------- |
| `isOptional=false, isNullable=false` | Required, cannot be null               |
| `isOptional=true, isNullable=false`  | Optional, will be undefined if not set |
| `isOptional=true, isNullable=true`   | Optional, can be null or undefined     |

## Common Patterns

### Pattern: User with Profile

```bash
# 1. Add profile to User (oneToOne)
npm run add:property -- \
  --name=User \
  --property=profile \
  --kind=reference \
  --type=Profile \
  --referenceType=oneToOne \
  --isAddToDto=true \
  --isOptional=true \
  --isNullable=true

# Hygen auto-adds user property to Profile with manyToOne
```

### Pattern: Category with Products

```bash
# 1. Add category to Product (manyToOne)
npm run add:property -- \
  --name=Product \
  --property=category \
  --kind=reference \
  --type=Category \
  --referenceType=manyToOne \
  --isAddToDto=true \
  --isOptional=true \
  --isNullable=true

# 2. Add products to Category (oneToMany, inverse)
npm run add:property -- \
  --name=Category \
  --property=products \
  --kind=reference \
  --type=Product \
  --referenceType=oneToMany \
  --propertyInReference=category \
  --isAddToDto=false \
  --isOptional=true \
  --isNullable=true
```

### Pattern: Product with Tags (many-to-many)

```bash
# 1. Add tags to Product
npm run add:property -- \
  --name=Product \
  --property=tags \
  --kind=reference \
  --type=Tag \
  --referenceType=manyToMany \
  --isAddToDto=true \
  --isOptional=true \
  --isNullable=true

# Hygen auto-adds products to Tag with manyToMany inverse
```
