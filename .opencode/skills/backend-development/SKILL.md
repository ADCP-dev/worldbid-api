---
name: backend-development
description: >
  Workflows y comandos para desarrollo backend en Foundation.
  Trigger: Cuando necesitas crear recursos, añadir propiedades, migraciones o seeders.
license: Apache-2.0
metadata:
  author: foundation-team
  version: "1.0"
---

## When to Use

- Crear un nuevo recurso backend (entity, repository, service, controller, DTOs)
- Añadir una propiedad a un recurso existente
- Crear o ejecutar migraciones de base de datos
- Crear datos de seeding

---

## Critical Patterns

### No Mappers — class-transformer directamente

**NO crear archivos mapper.** Usar `plainToClass()` / `plainToInstance()` directamente en el repository.

```typescript
// ✅ CORRECTO — en el repository
import { plainToInstance } from 'class-transformer';
import { User } from '@users/domain/user';

async findById(id: string): Promise<User | null> {
  const raw = await this.repo.findOne({ where: { id } });
  return raw ? plainToInstance(User, raw) : null;
}
```

```typescript
// ❌ INCORRECTO — NO crear mapper files
// Los mappers fueron eliminados. NO volver a crearlos.
```

### Domain Entities — @Expose() y @Type()

El domain usa `class-transformer` decorators:

```typescript
import { Expose, Type } from "class-transformer";

@Exclude()
export class User {
  @Expose()
  id: string;

  @Expose()
  @Type(() => Role)
  role: Role;

  @Expose()
  @Type(() => UserStatus)
  status: UserStatus;

  @Expose()
  @Type(() => File)
  photo?: File | null;
}
```

### Path Aliases — SIEMPRE usar

| Alias      | Destino                | Ejemplo                                                                |
| ---------- | ---------------------- | ---------------------------------------------------------------------- |
| `@users/*` | `src/modules/users/*`  | `import { User } from '@users/domain/user'`                            |
| `@iam/*`   | `src/modules/iam/*`    | `import { ApiKey } from '@iam/api-keys/domain/api-key'`                |
| `@infra/*` | `src/infrastructure/*` | `import { Logger } from '@infra/logger'`                               |
| `@src/*`   | `src/*`                | `import { ConfigType } from '@src/config/config.type'`                 |
| `@ext/*`   | `src/extensions/*`     | `import { ExtensionModule } from '@ext/my-extension/extension.module'` |

---

## Workflow 1: Generar un Nuevo Recurso

### Paso 1 — Elegir el tipo de recurso

| Tipo         | Uso                                      | Comando                   |
| ------------ | ---------------------------------------- | ------------------------- |
| `relational` | Recursos con persistencia en PostgreSQL  | `pnpm generate:resource`  |
| `extension`  | Recursos queextienden el sistema modular | `pnpm generate:extension` |

### Paso 2 — Ejecutar el generador

```bash
# Para recurso relacional (preguntará interactivamente)
cd apps/back
pnpm generate:resource

# Para extensión
pnpm generate:extension
```

### Paso 3 — Responder las preguntas

```
? Resource name: Product
? Lowercase resource name: product
? PascalCase domain name: Product
? Database table name: products
```

### Estructura generada (relational)

```
src/modules/products/
├── domain/
│   ├── product.ts              # Entity con @Expose() y @Type()
│   └── product.repository.ts   # Interfaz del repository
├── dto/
│   ├── create-product.dto.ts
│   └── update-product.dto.ts
├── infrastructure/
│   ├── entities/
│   │   └── product.entity.ts   # TypeORM entity
│   ├── repositories/
│   │   └── product.repository.ts  # Implementación con plainToClass
│   └── product.service.ts
└── products.controller.ts
```

### Paso 4 — NO crear mapper

El generador ya no crea mapper. Si el repository necesita transformación, hacerlo inline con `plainToClass()`.

---

## Workflow 2: Añadir una Propiedad

### Paso 1 — Ejecutar el generador

```bash
cd apps/back
pnpm generate:property
```

### Paso 2 — Responder las preguntas

```
? Which resource? product
? Property name: description
? Property type: string
? Is nullable? No
? Is array? No
```

### Archivos modificados

- `src/modules/products/domain/product.ts` — agrega `description: string`
- `src/modules/products/infrastructure/entities/product.entity.ts` — agrega columna
- `src/modules/products/dto/create-product.dto.ts` — agrega campo
- `src/modules/products/dto/update-product.dto.ts` — agrega campo

### Paso 3 — Migración

```bash
pnpm migration:generate <nombre>
# Ejemplo: pnpm migration:generate addProductDescription
```

---

## Workflow 3: Migraciones

### Generar migración

```bash
cd apps/back
pnpm migration:generate <nombre>
```

Ejemplo:

```bash
pnpm migration:generate addProductDescription
# Genera: <timestamp>-add-product-description.ts
```

### Ejecutar migraciones

```bash
# Ejecutar todas las pendientes
pnpm migration:run

# Revertir última migración
pnpm migration:revert

# Mostrar estado
pnpm migration:show
```

### Script internals

El script `scripts/migrate.js`:

- Usa `env-cmd -f ../../.env` para cargar variables de entorno
- Usa `dataSource` de TypeORM config
- Genera timestamp: `Date.now()`
- Formatea el nombre: `AddProductDescription` (PascalCase)

---

## Workflow 4: Seeders

### Crear seeder

```bash
cd apps/back
npx hygen seed:create
```

### Escribir seeder idempotente

```typescript
// src/database/seeds/seed-roles.ts
import { DataSource } from "typeorm";
import { Role, RoleEnum } from "@users/domain/role";

export async function seedRoles(dataSource: DataSource) {
  const repo = dataSource.getRepository(Role);

  const roles = [
    { id: RoleEnum.ADMIN, name: "Admin" },
    { id: RoleEnum.USER, name: "User" },
  ];

  for (const role of roles) {
    const exists = await repo.findOne({ where: { id: role.id } });
    if (!exists) {
      await repo.save(repo.create(role));
    }
  }
}
```

### Ejecutar seeds

```bash
cd apps/back
npx tsx ./node_modules/typeorm-extension/cli.js seed
```

---

## Commands Quick Reference

```bash
# Generar recurso (preguntará interactivo)
cd apps/back
pnpm generate:resource          # Relational
pnpm generate:extension         # Extension

# Añadir propiedad
pnpm generate:property

# Migraciones
pnpm migration:generate <nombre>
pnpm migration:run
pnpm migration:revert
pnpm migration:show

# Seeds
npx tsx ./node_modules/typeorm-extension/cli.js seed
```

---

## Resources

- **Generadores Hygen**: Ver `.hygen/` para templates
- **Arquitectura backend**: [docs/ARCHITECTURE.md](file://C:/proyectos/foundation/docs/ARCHITECTURE.md)
- **Recursos backend**: [docs/BACKEND-RESOURCES.md](file://C:/proyectos/foundation/docs/BACKEND-RESOURCES.md)
- **Sistema de extensiones**: [docs/EXTENSIONS-SYSTEM.md](file://C:/proyectos/foundation/docs/EXTENSIONS-SYSTEM.md)
- **Comandos Hygen**: [docs/GENERATORS.md](file://C:/proyectos/foundation/docs/GENERATORS.md)
- **TypeScript guidelines**: [docs/TYPESCRIPT-GUIDELINES.md](file://C:/proyectos/foundation/docs/TYPESCRIPT-GUIDELINES.md)
- **Autorización/RBAC**: [docs/AUTHORIZATION.md](file://C:/proyectos/foundation/docs/AUTHORIZATION.md)
- **API Keys**: [docs/API-KEYS.md](file://C:/proyectos/foundation/docs/API-KEYS.md)
- **Email system**: [docs/EMAIL-SYSTEM.md](file://C:/proyectos/foundation/docs/EMAIL-SYSTEM.md)
- **Storage**: [docs/STORAGE-ARCHITECTURE.md](file://C:/proyectos/foundation/docs/STORAGE-ARCHITECTURE.md)
- **Webhooks**: [docs/WEBHOOKS.md](file://C:/proyectos/foundation/docs/WEBHOOKS.md)
- **Error logging**: [docs/ERROR-LOGGING.md](file://C:/proyectos/foundation/docs/ERROR-LOGGING.md)
