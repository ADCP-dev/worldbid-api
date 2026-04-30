---
name: backend
description: |-
  Foundation backend development — NestJS + TypeORM + Hygen generators. Use for ALL backend work: creating resources, adding properties, migrations, seeders, and NestJS patterns.

  Use proactively when working on apps/back/, creating CRUD modules, managing database schema, or writing NestJS code.

  Examples:
  - user: "Create a Product resource" → pnpm generate:resource -- --name=Product
  - user: "Add email field to User" → pnpm add:property -- --name=User --property=email --kind=primitive --type=string
  - user: "Run migrations" → pnpm migration:generate AddXxx + pnpm migration:run
---

# Backend — Foundation

## ⚠️ Core Rules

- **NUNCA** escribir entity/service/controller/DTO a mano → usar generadores Hygen
- **NUNCA** hardcodear migraciones → solo `pnpm migration:generate` + `pnpm migration:run`
- **NUNCA** `console.log()` → usar NestJS `Logger`
- **SIEMPRE** usar path aliases: `@iam/*`, `@users/*`, `@infra/*`, `@src/*`, `@ext/*`
- **Tablas en extensiones**: prefijo `ext_<name>_` — ej: `@Entity('ext_blog_posts')`
- **NUNCA** rutas relativas largas (`../../../`)

## Commands (correr desde `apps/back/`)

| Comando | Descripción |
|---------|-------------|
| `pnpm generate:resource -- --name=X` | CRUD completo (entity, service, controller, DTOs, repository) |
| `pnpm generate:extension` | Generar recurso dentro de extensión |
| `pnpm add:property -- --name=X --property=p --kind=primitive --type=string` | Agregar campo |
| `pnpm add:property -- --name=X --property=p --kind=reference --type=Y --referenceType=manyToOne` | Agregar relación |
| `pnpm migration:generate AddXxx` | Generar migración desde entities |
| `pnpm migration:run` | Ejecutar migraciones pendientes |
| `pnpm seed:create -- --name=X` | Crear seeder |
| `pnpm seed:run` | Ejecutar todos los seeds |

## Patterns

### Entity Pattern
```typescript
import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;
}
```

### Domain Object Pattern
```typescript
import { Expose, Type } from 'class-transformer';

export class User {
  @Expose() id: string;
  @Expose() email: string;
  @Expose() @Type(() => Role) role: Role;
}
```

### Repository Pattern (no mappers — plainToClass)
```typescript
import { plainToInstance } from 'class-transformer';

async findById(id: string): Promise<User | null> {
  const raw = await this.repo.findOne({ where: { id } });
  return raw ? plainToInstance(User, raw) : null;
}
```

### DTO Pattern
```typescript
import { IsString, IsEmail } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  name: string;
}
```

## add:property — Tipos de `--kind`

| `--kind` | Uso | Ejemplo `--type` |
|----------|-----|------------------|
| `primitive` | Campos básicos | string, number, decimal, boolean, Date, enum, json |
| `reference` | Relaciones | usar `--referenceType`: manyToOne, oneToMany, manyToMany, oneToOne |

## Links

- `references/commands.md` — Todos los comandos Hygen detallados
- `references/patterns.md` — Patrones NestJS (entity, repository, DTO, controller, module)
- `references/typeorm.md` — TypeORM column/relation/query patterns
- `references/best-practices.md` — NestJS best practices (40 rules)
- `docs/modules/database.md` — Migraciones y TypeORM
- `docs/TYPESCRIPT-GUIDELINES.md` — Reglas TypeScript del proyecto
- `docs/ARCHITECTURE.md` — Dependencias entre módulos
- `docs/EXTENSIONS-SYSTEM.md` — Sistema de extensiones
