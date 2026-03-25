# Hygen Commands Reference

Complete reference for hygen code generation commands.

## Command Location

All commands run from `apps/back` directory.

## Generate Resource

### Command

```bash
npm run generate:resource -- --name={EntityName}
```

### Example

```bash
npm run generate:resource -- --name=Product
```

### Output Location

```
src/custom/products/
├── products.controller.ts
├── products.service.ts
├── products.module.ts
├── dto/
│   ├── create-product.dto.ts
│   ├── update-product.dto.ts
│   ├── find-all-products.dto.ts
│   ├── find-all-products-paginated.dto.ts
│   └── domain-product.dto.ts
├── domain/
│   └── product.ts
├── infrastructure/
│   ├── persistence.module.ts
│   ├── repository.ts
│   ├── mappers/
│   │   └── product.mapper.ts
│   └── entities/
│       └── product.entity.ts
└── app-module-import.ejs.ts (injected)
```

### Generated Features

- Full CRUD controller endpoints (POST, GET, GET/:id, PATCH, DELETE)
- Paginated and non-paginated findAll
- Infinity pagination response
- Swagger decorators
- JWT auth decorator
- TypeORM entity with uuid primary key
- Repository pattern
- Mapper (domain ↔ persistence)
- Auto-imports in app module

## Generate Extension

### Command

```bash
npm run generate:extension -- --name={ExtensionName}
```

### Example

```bash
npm run generate:extension -- --name=Analytics
```

### Difference from Resource

- Includes `config/` directory
- Includes seed service/module for extension data
- Designed for pluggable extensions

## Seed Create

### Command

```bash
npm run seed:create -- --name={EntityName}
```

### Example

```bash
npm run seed:create -- --name=Product
```

### Output Files

```
src/database/seeds/relational/product/
├── product-seed.service.ts
└── product-seed.module.ts
```

### Auto-Injected Into

- `src/database/seeds/relational/seed.module.ts`
- `src/database/seeds/relational/run-seed.ts`

## Add Property (Relational)

### Command

```bash
npm run add:property -- \
  --name={EntityName} \
  --property={propertyName} \
  --kind={primitive|reference|duplication} \
  --type={typeName} \
  [--referenceType={oneToOne|oneToMany|manyToOne|manyToMany}] \
  [--propertyInReference={propertyName}] \
  [--isAddToDto={true|false}] \
  [--isOptional={true|false}] \
  [--isNullable={true|false}]
```

### Example: Add String Field

```bash
npm run add:property -- \
  --name=Product \
  --property=description \
  --kind=primitive \
  --type=text \
  --isAddToDto=true \
  --isOptional=true \
  --isNullable=true
```

### Example: Add Relationship

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

### Example: Add OneToMany

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

### Files Modified by add:property

| File       | Modifications                                           |
| ---------- | ------------------------------------------------------- |
| Entity     | Column/relation decorator, property declaration, import |
| Create DTO | Property with validators and ApiProperty                |
| Update DTO | Optional property with validators                       |
| Domain     | Property with ApiProperty                               |
| Mapper     | toDomain and toPersistence mappings                     |

## Add Property (Extension)

Same as relational but command is:

```bash
npm run add:extension-property -- ...
```

## Hygen Templates Location

Templates are in `.hygen/` directory:

```
.hygen/
├── generate/
│   ├── relational-resource/  # Full resource templates
│   └── extension-resource/   # Extension templates
├── property/
│   ├── add-to-relational/    # Property templates for relational entities
│   └── add-to-extension/    # Property templates for extensions
└── seeds/
    └── create-relational/   # Seeder templates
```

## Hygen Template Variables

| Variable              | Description                                |
| --------------------- | ------------------------------------------ |
| `name`                | Entity name (e.g., "Product")              |
| `property`            | Property name being added                  |
| `kind`                | primitive, reference, or duplication       |
| `type`                | Type name (for references)                 |
| `referenceType`       | oneToOne, oneToMany, manyToOne, manyToMany |
| `propertyInReference` | Inverse property name (for oneToMany)      |
| `destination`         | "custom" or "modules"                      |
| `isAddToDto`          | Include in DTOs                            |
| `isOptional`          | Property is optional                       |
| `isNullable`          | Property can be null                       |

## Inflection Helpers

Hygen uses inflection for naming:

```javascript
h.inflection.transform(name, ["pluralize", "underscore", "dasherize"]);
// Product → products
// product → product
// Product → product
```

```javascript
h.inflection.camelize(name, true);
// product → product
// products → product
```

## Running Without CLI Arguments

If you run without arguments, hygen prompts interactively:

```bash
npm run add:property
# → Prompts for entity name, property, kind, type, etc.
```

## Debugging Hygen

To see what files will be generated without creating them:

```bash
npx hygen generate relational-resource --name=Product --dry
```

## Template Injection Points

Templates use injection markers in existing files:

| Marker                   | Purpose                        |
| ------------------------ | ------------------------------ |
| `after: export class X`  | Add after class definition     |
| `before: from 'typeorm'` | Add import before typeorm      |
| `skip_if: \sX,`          | Skip if pattern already exists |
| `inject: true`           | Modify existing file           |
