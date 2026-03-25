# Backend Extensions System — Design Guide

How to make the NestJS backend as modular as the Nuxt Layers frontend, so you can **copy-paste** entire features across projects.

---

## The Problem

| What you want to do    | Frontend (Nuxt)                             | Backend (NestJS)                                                                      |
| ---------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------- |
| Add a feature          | Copy folder to `modules/`, add to `extends` | Copy folder to `src/`, manually edit `app.module.ts`, `seed.module.ts`, `run-seed.ts` |
| Remove a feature       | Delete folder, remove from `extends`        | Delete folder, manually remove from 3+ files                                          |
| Share between projects | Copy the layer folder                       | Copy folder + remember all manual wiring                                              |

**Goal**: Make the backend work like the frontend — drop a folder and it works.

---

## Proposed Architecture

```
apps/back/src/
├── extensions/                          ← Drop-in feature directory
│   ├── shop/                            ← Example extension
│   │   ├── extension.module.ts          ← Convention: auto-discovered
│   │   ├── extension.config.ts          ← Optional: env variables
│   │   ├── shop.controller.ts
│   │   ├── shop.service.ts
│   │   ├── domain/
│   │   │   └── shop.ts
│   │   ├── dto/
│   │   │   ├── create-shop.dto.ts
│   │   │   └── update-shop.dto.ts
│   │   ├── infrastructure/
│   │   │   └── persistence/
│   │   │       ├── shop.repository.ts
│   │   │       └── relational/
│   │   │           ├── entities/shop.entity.ts
│   │   │           ├── repositories/shop.repository.ts
│   │   │           ├── mappers/shop.mapper.ts
│   │   │           └── relational-persistence.module.ts
│   │   └── seeds/                        ← Optional
│   │       ├── shop-seed.module.ts
│   │       └── shop-seed.service.ts
│   └── blog/                            ← Another extension
│       ├── extension.module.ts
│       └── ...
├── core/                                ← Auto-discovery utilities
│   ├── extension-loader.ts              ← Scans extensions/ at startup
│   └── seed-loader.ts                   ← Scans extension seeds
└── ... (existing core modules)
```

---

## How Auto-Discovery Works

### 1. Module Loading (`core/extension-loader.ts`)

A `DynamicModule` that scans `src/extensions/*/extension.module.ts` at startup:

```typescript
import { DynamicModule, Logger, Module } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";

@Module({})
export class ExtensionLoaderModule {
  static register(): DynamicModule {
    const extensionsDir = path.join(__dirname, "..", "extensions");
    const modules: any[] = [];

    if (!fs.existsSync(extensionsDir)) {
      return { module: ExtensionLoaderModule, imports: [] };
    }

    for (const dir of fs.readdirSync(extensionsDir, { withFileTypes: true })) {
      if (!dir.isDirectory()) continue;
      try {
        const mod = require(
          path.join(extensionsDir, dir.name, "extension.module"),
        );
        const cls = Object.values(mod).find(
          (v: any) => typeof v === "function" && v.name?.includes("Module"),
        );
        if (cls) {
          modules.push(cls);
          Logger.log(`✅ Loaded: ${dir.name}`, "Extensions");
        }
      } catch {
        /* no extension.module — skip */
      }
    }

    return { module: ExtensionLoaderModule, imports: modules };
  }
}
```

**Usage in `app.module.ts`** — one line, never changes again:

```typescript
@Module({
  imports: [
    // ... core modules ...
    ExtensionLoaderModule.register(), // ← auto-loads all extensions
  ],
})
export class AppModule {}
```

### 2. Entity Discovery — Already Works ✅

TypeORM config already uses glob patterns:

```typescript
// typeorm-config.service.ts
entities: [__dirname + "/../**/*.entity{.ts,.js}"];
```

This already picks up entities inside `extensions/`. **No changes needed.**

### 3. Seed Loading (`core/seed-loader.ts`)

Same pattern as module loading but for seeds:

```typescript
// Discover: extensions/*/seeds/*-seed.module.ts → seed modules
// Discover: extensions/*/seeds/*-seed.service.ts → seed services with run()
```

**Usage in `seed.module.ts`:**

```typescript
@Module({
  imports: [
    RoleSeedModule,
    StatusSeedModule,
    UserSeedModule,
    ExtensionSeedLoaderModule.register(), // ← auto-loads extension seeds
  ],
})
export class SeedModule {}
```

**Usage in `run-seed.ts`:**

```typescript
const runSeed = async () => {
  const app = await NestFactory.create(SeedModule);
  // Core seeds
  await app.get(RoleSeedService).run();
  await app.get(StatusSeedService).run();
  await app.get(UserSeedService).run();
  // Extension seeds (auto-discovered)
  await runExtensionSeeds(app);
  await app.close();
};
```

### 4. Config Loading (Optional)

Extensions can export their own `registerAs` config:

```typescript
// extensions/shop/extension.config.ts
import { registerAs } from "@nestjs/config";

export default registerAs("shop", () => ({
  apiKey: process.env.SHOP_API_KEY,
  webhookSecret: process.env.SHOP_WEBHOOK_SECRET,
}));
```

The extension loader can also discover `extension.config.ts` files and add them to `ConfigModule.forRoot({ load: [...] })`.

---

## Hygen Generator

A new `generate:extension` command scaffolds directly into `extensions/`:

```bash
npm run generate:extension
# Prompts for name → generates full CRUD in src/extensions/<name>/
# No manual imports needed!
```

**Key difference from `generate:resource`:**

- Outputs to `src/extensions/<name>/` instead of `src/<name>/`
- Module file is named `extension.module.ts` (not `<name>.module.ts`)
- **No** `app-module-import.ejs.t` or `app-module.ejs.t` injection templates needed
- Import paths reference `../../utils/` instead of `../utils/`

---

## Developer Workflow

### Adding an extension

```bash
# Option A: Generate it
npm run generate:extension   # → src/extensions/shop/

# Option B: Copy from another project
cp -r ../other-project/src/extensions/blog src/extensions/blog

# Option C: Create manually
mkdir src/extensions/my-feature
# Create extension.module.ts + your files

# Start the server — done!
npm run dev
# Logs: [Extensions] ✅ Loaded: shop
```

### Removing an extension

```bash
rm -rf src/extensions/shop
# Restart — it's gone. No other files to edit.
```

### Sharing between projects

```bash
# Just copy the folder
cp -r project-a/src/extensions/shop project-b/src/extensions/shop
# Run migrations if needed
npm run migration:generate --name=AddShop
npm run migration:run
```

---

## Conventions Summary

| Convention           | Rule                                              |
| -------------------- | ------------------------------------------------- |
| Extension location   | `src/extensions/<name>/`                          |
| Module file name     | `extension.module.ts` (required)                  |
| Config file name     | `extension.config.ts` (optional)                  |
| Seeds location       | `src/extensions/<name>/seeds/` (optional)         |
| Seed module pattern  | `*-seed.module.ts`                                |
| Seed service pattern | `*-seed.service.ts` with `run()` method           |
| Entity discovery     | Automatic via TypeORM glob `**/*.entity{.ts,.js}` |

---

## What Changes in Core (One-Time Setup)

Only **4 files** need a one-time modification:

| File                                           | Change                                                |
| ---------------------------------------------- | ----------------------------------------------------- |
| `src/core/extension-loader.ts`                 | **NEW** — Extension auto-discovery module             |
| `src/core/seed-loader.ts`                      | **NEW** — Seed auto-discovery utility                 |
| `src/app.module.ts`                            | Add `ExtensionLoaderModule.register()` to imports     |
| `src/database/seeds/relational/seed.module.ts` | Add `ExtensionSeedLoaderModule.register()` to imports |
| `src/database/seeds/relational/run-seed.ts`    | Add `await runExtensionSeeds(app)` after core seeds   |
| `package.json`                                 | Add `"generate:extension"` script                     |
| `.hygen/generate/extension-resource/`          | **NEW** — Hygen templates for extensions              |

After this one-time setup, you **never edit these files again** when adding/removing extensions.

---

## Estado Actual del Sistema

### ✅ Implementado:

- `ExtensionLoaderModule.register()` en `core/extension-loader.ts`
- `discoverExtensionConfigs()` en `core/config-loader.ts`
- `ExtensionSeedLoaderModule.register()` para seeds
- TypeORM entity discovery con glob patterns (incluye `extensions/`)

### ⚠️ No utilizado:

La carpeta `extensions/` está vacía. Los feature modules (IAM, Billing, Comms, Storage) están en `modules/` y se importan manualmente en `FoundationModule`.

### Próximos pasos sugeridos:

1. Crear UNA extensión de ejemplo (ej: `shop`) para validar el sistema end-to-end
2. Considerar migrar `modules/` → `extensions/` para tener 100% copy-paste de features
3. O mantener `modules/` para features "core" del foundation y `extensions/` para features opcionales

La arquitectura actual (modules/ + FoundationModule) es válida para el uso interno. El sistema de extensiones está diseñado para features que se copian entre proyectos.

---

## Alternative Approaches Considered

### ❌ Script that copies files to the right positions

- Fragile, hard to maintain, easy to break
- Files scattered across the project — hard to track what belongs to what
- Removing a feature means finding and deleting scattered files

### ❌ NestJS Dynamic Modules with manual registration

- Still requires editing `app.module.ts` for every new feature
- Same "copy-paste tax" problem

### ✅ Auto-Discovery with Convention (Recommended)

- **One convention** to learn: `extension.module.ts`
- Self-contained folders — copy/delete entire folders
- Zero manual wiring after initial setup
- Same pattern as Nuxt Layers on the frontend
