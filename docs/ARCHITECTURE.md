# Foundation Monorepo Architecture Guide

This guide explains the architecture of the Foundation monorepo, designed for modularity and scalability. It covers the structure, extension system, authentication, authorization, and key components for both Frontend (Nuxt) and Backend (NestJS).

## Table of Contents

1. [Monorepo Structure](#monorepo-structure)
2. [Extensions & Layers System (The "Copy-Paste" Standard)](#extensions--layers-system)
   - [Frontend Layers (Nuxt)](#frontend-layers-nuxt)
   - [Backend Modules (NestJS)](#backend-modules-nestjs)
3. [Authentication](#authentication)
4. [Authorization (RBAC)](#authorization-rbac)
5. [Polymorphic File System](#polymorphic-file-system)
6. [Email System (Maizzle)](#email-system-maizzle)
7. [Queue System](#queue-system)
8. [CLI Commands & Generators](#cli-commands--generators)
9. [Frontend Custom Components](#frontend-custom-components)

---

## Monorepo Structure

The project uses **Turborepo** to manage the monorepo.

- **`apps/front`**: The Frontend application built with **Nuxt 3**.
- **`apps/back`**: The Backend API built with **NestJS**.
- **`packages/`**: Shared configuration packages (eslint, typescript, ui).

### Workspaces

The `pnpm-workspace.yaml` defines the workspace structure. You can run commands from the root:

- `npm run dev`: Starts both frontend and backend in development mode.
- `npm run build`: Builds all applications.

---

## Extensions & Layers System

The core philosophy for extending the application is a **"Copy-Paste" Modular Architecture**. This allows you to create self-contained features (like a "Shop" or "Blog") that can be easily added, removed, or reused across projects.

### Frontend Layers (Nuxt)

The frontend uses **Nuxt Layers**. A layer is essentially a mini-Nuxt app that can be extended by the main application.

#### Structure of a Layer

A typical layer is located in `apps/front/modules/<module-name>` and looks like this:

```
apps/front/modules/shop/
├── nuxt.config.ts       # Register components, imports, etc.
├── pages/               # Pages for this module (e.g., /shop)
├── components/          # Components specific to this module
├── composables/         # Shared logic
├── plugins/             # Plugins (e.g., for Sidebar injection)
└── store/               # Pinia stores
```

#### How to Create/Install a Layer

1.  **Create the Folder**: Copy an existing module (like `ui-app`) or create a new folder in `apps/front/modules/`.
2.  **Configure `nuxt.config.ts` (Layer)**:
    Inside your module folder, create a `nuxt.config.ts`:
    ```typescript
    // apps/front/modules/shop/nuxt.config.ts
    export default defineNuxtConfig({
      // Auto-import components
      components: [{ path: "./components", pathPrefix: false }],
      // Auto-import stores/composables
      imports: {
        dirs: ["./stores", "./composables"],
      },
    });
    ```
3.  **Register in Main App**:
    Open `apps/front/nuxt.config.ts` and add your module to the `extends` array:
    ```typescript
    export default defineNuxtConfig({
      extends: [
        "./modules/landing",
        "./modules/auth",
        "./modules/shop", // <-- Add your new layer here
      ],
      // ...
    });
    ```

#### Injecting into Sidebar

To add your module's links to the sidebar, create a plugin in your layer:

```typescript
// apps/front/modules/shop/plugins/nav.ts
import type { NavMenu } from "~/types/nav";

export default defineNuxtPlugin((nuxtApp) => {
  const menuItems = useState<NavMenu[]>("nav:menuItems", () => []);

  menuItems.value.push({
    heading: "Shop",
    items: [
      {
        title: "Products",
        icon: "ShoppingBag",
        link: "/app/shop/products",
      },
    ],
  });
});
```

### Backend Modules (NestJS)

The backend uses standard **NestJS Modules**. A module encapsulates all logic (Controllers, Services, Entities) for a specific domain.

#### Structure of a Module

A typical module is located in `apps/back/src/<module-name>`:

```
apps/back/src/shop/
├── shop.module.ts       # The main module file
├── shop.controller.ts   # API Endpoints
├── shop.service.ts      # Business Logic
├── entities/            # TypeORM Entities
│   └── product.entity.ts
└── dto/                 # Data Transfer Objects
    └── create-product.dto.ts
```

#### How to Create/Install a Module

1.  **Create the Folder**: Copy an existing module (like `home` or `statuses`) to `apps/back/src/`.
2.  **Register in App Module**:
    Open `apps/back/src/app.module.ts` and import your module:

    ```typescript
    import { ShopModule } from "./shop/shop.module";

    @Module({
      imports: [
        // ... other modules
        ShopModule, // <-- Add your new module here
      ],
    })
    export class AppModule {}
    ```

---

## Authentication

The system supports multiple authentication methods:

- **Email/Password**: Standard login.
- **Social Auth**: Google, Facebook, Apple (configured in `apps/back/src/auth-*`).
- **Session Management**: Uses **JWT** (JSON Web Tokens) with Refresh Tokens.

**Key Files**:

- `apps/back/src/auth/auth.service.ts`: Handles login, registration, and token generation.
- `apps/back/src/session/`: Manages active user sessions.

---

## Authorization (RBAC)

Role-Based Access Control is implemented on both ends.

### Backend

- **Guard**: `RolesGuard` (`apps/back/src/roles/roles.guard.ts`) checks if a user has the required role.
- **Decorator**: Use `@Roles(RoleEnum.admin)` to protect an endpoint.
- **Enums**: Roles are defined in `RoleEnum`.

Example:

```typescript
@Roles(RoleEnum.admin)
@Get('users')
findAll() { ... }
```

### Frontend

- **Store**: `useAuthStore` holds the current user's role.
- **Usage**: Check `authStore.user.role.id` to conditionally render UI elements.

---

## Polymorphic File System

The `FilesModule` (`apps/back/src/files`) allows attaching files to _any_ entity using a polymorphic relationship.

**Entity (`FileEntity`)**:

- `path`: S3 or local path.
- `entity`: The name of the related table (e.g., 'user', 'product').
- `entityId`: The ID of the related record.

**Usage**:
When uploading a file, you can specify the `entity` and `entityId` to automatically link it.
Alternatively, in your Entity (e.g., `User`), you can use `@OneToOne` or `@ManyToOne` to link to `FileEntity`.

---

## Email System (Maizzle)

Emails are built using **Maizzle**, which allows writing emails with **Tailwind CSS**.

- **Config**: `apps/back/maizzle.config.js`.
- **Templates**: Located in `apps/back/src/mail/mail-templates/emails`.
- **Build**: Run `npm run maizzle:build` in `apps/back` to compile templates to HTML.

The `MailService` (`apps/back/src/mail/mail.service.ts`) picks up the compiled HTML templates to send emails.

---

## Queue System

The backend uses **BullMQ** (Redis) for background jobs, primarily for sending emails asynchronously.

- **Module**: `EmailQueueModule` (`apps/back/src/email-queue/`).
- **Processor**: `EmailProcessor` handles the jobs.
- **Usage**: `emailQueueService.add('job-name', { ...data })`.

Ensure you have Redis running (configured in `.env`).

---

## CLI Commands & Generators

The backend includes custom scripts (using **Hygen**) to automate development.

Run these commands in `apps/back`:

- **`npm run generate:resource`**: Creates a new full CRUD resource (Module, Controller, Service, Entity, DTOs).
  - _Usage_: Follow the interactive prompts to name your resource.
- **`npm run add:property`**: Adds a new column/property to an existing entity and updates DTOs.
- **`npm run migration:generate --name=MyMigration`**: Generates a TypeORM migration file based on entity changes.
- **`npm run seed:run`**: Runs database seeders.

---

## Frontend Custom Components

The `apps/front/modules/ui-app` layer contains custom, reusable components.

### 1. Data Table (`DataTable.vue`)

A powerful wrapper around TanStack Table.

- **Location**: `apps/front/modules/ui-app/components/data-table/DataTable.vue`
- **Features**: Sorting, Filtering, Pagination, Visibility Toggle.
- **Usage**:
  Pass `columns` (definitions) and `data` props.
  The state (sorting, filters) is persisted in `useTableState` store.

### 2. Custom Forms

Built with **VeeValidate** and **shadcn-vue**.

- **Location**: `apps/front/components/ui/form` & `apps/front/modules/ui-app/components/form`.
- **Key Components**:
  - `FormInput`, `FormSelect`, `FormDate`, etc.
  - Automatically handle validation errors and labels.

**Usage Example**:

```vue
<FormInput name="email" label="Email" placeholder="Enter email" />
```
