---
name: backend-resource-generator
description: |-
  Generate NestJS backend resources, properties, migrations and seeders. Use for creating CRUD modules, adding entity relationships, database migrations and seed data.
  Use proactively when users need to create backend entities, add properties/relationships, or manage database schema.
---
# Backend Resource Generator

Trigger: crear CRUD, añadir properties, migraciones, seeders.

## ⚠️ Regla Obligatoria — Usar Generadores

NUNCA escribir entity/service/controller/DTO/repository a mano. Siempre usar generadores.

## Comandos Esenciales (correr desde `apps/back`)

| Comando | Qué hace |
|---------|----------|
| `pnpm generate:resource -- --name=X` | CRUD completo (entity, service, controller, DTOs, repository) |
| `pnpm add:property -- ...` | Añade property/relationship a resource existente |
| `pnpm migration:generate --name=X` | Genera migración comparando entities con DB |
| `pnpm migration:run` | Ejecuta pendientes |
| `pnpm seed:create -- --name=X` | Genera seeder idempotente |
| `pnpm seed:run` | Corre todos los seeds |

## Flujo Típico

```bash
cd apps/back
pnpm generate:resource -- --name=Product
pnpm add:property -- --name=Product --property=price --kind=primitive --type=decimal --isAddToDto=true --isOptional=false --isNullable=false
pnpm add:property -- --name=Product --property=category --kind=reference --type=Category --referenceType=manyToOne --isAddToDto=true
pnpm migration:generate --name=CreateProduct
pnpm migration:run
pnpm seed:create -- --name=Product
# Editar seeder con datos reales
pnpm seed:run
```

## add:property — Tipos de `--kind`

| `--kind` | Uso | Ejemplo `--type` |
|----------|-----|------------------|
| `primitive` | Campos básicos | string, number, decimal, boolean, Date, enum, json |
| `reference` | Relaciones | (usar `--referenceType`: manyToOne, oneToMany, manyToMany, oneToOne) |

## References

- `docs/GENERATORS.md` — CLI reference completa
- `references/hygen-commands.md`, `references/add-property.md` — Parámetros detallados
- `references/migrations.md`, `references/seeders.md` — Patrones avanzados
