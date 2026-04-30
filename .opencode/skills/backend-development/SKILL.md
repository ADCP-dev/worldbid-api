---
name: backend-development
description: Workflows y comandos para desarrollo backend en Foundation. Trigger: Cuando necesitas crear recursos, añadir propiedades, migraciones o seeders.
license: Apache-2.0
metadata:
  author: foundation-team
  version: "1.0"
---
# Backend Development — Foundation

Trigger: crear recursos, añadir properties, migraciones, seeders.

## ⚠️ NO código manual — Usar `backend-resource-generator` skill

## Patrones Críticos

### No Mappers — `plainToInstance()` directo en repository
```typescript
async findById(id: string): Promise<User | null> {
  const raw = await this.repo.findOne({ where: { id } });
  return raw ? plainToInstance(User, raw) : null;
}
```

### Domain Entities — `@Expose()` / `@Type()`
```typescript
@Exclude()
export class User {
  @Expose() id: string;
  @Expose() @Type(() => Role) role: Role;
  @Expose() @Type(() => File) photo?: File | null;
}
```

### Path Aliases — SIEMPRE usar `@users/*`, `@iam/*`, `@infra/*`, `@src/*`, `@ext/*`

### Migraciones — NUNCA hardcode. Solo `pnpm migration:generate --name=X` + `pnpm migration:run`

## Commands Quick Reference
```bash
cd apps/back
pnpm generate:resource          # Nuevo CRUD (interactivo)
pnpm generate:extension         # Extensión (interactivo)
pnpm migration:generate <name>  # Generar migración
pnpm migration:run              # Ejecutar
pnpm migration:revert           # Revertir
```

## Resources
- `docs/GENERATORS.md` — Comandos Hygen detallados | `docs/ARCHITECTURE.md` — Arquitectura | `docs/EXTENSIONS-SYSTEM.md`
