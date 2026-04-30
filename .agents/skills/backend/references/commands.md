# Hygen Commands — Reference

> Detail for `backend` skill. See the SKILL.md for core rules.

## Resource Generation

### New CRUD Resource
```bash
pnpm generate:resource -- --name=Product
```
Creates: entity, domain, controller, service, DTOs (create/update/find-all), repository, module.

### New Extension Resource
```bash
pnpm generate:extension -- --name=Blog
```
Same as above but inside `extensions/<name>/`.

## Property Management

### Add Primitive Field
```bash
pnpm add:property -- --name=User --property=email --kind=primitive --type=string
```
Available types: `string`, `number`, `decimal`, `boolean`, `Date`, `enum`, `json`

### Add Enum Field
```bash
pnpm add:property -- --name=Incident --property=status --kind=primitive --type=enum --enumValues="open,in_progress,resolved"
```

### Add Relationship
```bash
# Many-to-One (FK on this entity)
pnpm add:property -- --name=Post --property=author --kind=reference --type=User --referenceType=manyToOne

# One-to-Many (FK on other entity)
pnpm add:property -- --name=User --property=posts --kind=reference --type=Post --referenceType=oneToMany

# Many-to-Many (junction table)
pnpm add:property -- --name=Post --property=tags --kind=reference --type=Tag --referenceType=manyToMany

# One-to-One
pnpm add:property -- --name=User --property=profile --kind=reference --type=Profile --referenceType=oneToOne
```

## Migration Workflow
```bash
# 1. Make entity changes (via add:property or manual)
# 2. Generate migration
pnpm migration:generate AddUserEmail
# 3. Review generated migration in src/infrastructure/database/migrations/
# 4. Run migration
pnpm migration:run
# 5. To revert
pnpm migration:revert
```

⚠️ NEVER write SQL by hand. Always use `pnpm migration:generate`.

## Seeders
```bash
# Create seeder
pnpm seed:create -- --name=AdminRoles
# Edit the seeder file to add data
# Run all seeds
pnpm seed:run
```

Seeds must be idempotent (check existence before creating).

## Linting
```bash
pnpm lint  # Runs automatically after generate:resource and add:property
```

Lint runs with `eslint --fix`. If it fails, fix errors before committing.
