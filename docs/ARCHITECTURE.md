# Foundation — Architecture Overview

A **Turborepo** monorepo with two applications sharing code through workspace packages.

```
foundation/
├── apps/
│   ├── back/     # NestJS API
│   └── front/    # Nuxt 3 SPA
├── docs/         # This directory
└── docker-compose.yml
```

## Running the Project

```bash
# Root — starts both apps in parallel
pnpm dev

# Individual apps
pnpm dev --filter back
pnpm dev --filter front
```

---

## Backend (`apps/back`)

Built with **NestJS + TypeORM + PostgreSQL**.

### `src/` Directory Structure

```
src/
├── main.ts               # App bootstrap
├── app.module.ts         # Root module (registers all modules)
│
├── config/               # Global env config (app, worker)
├── core/                 # Extension loader, seed loader
├── i18n/                 # Translation JSON files
│
├── infrastructure/
│   ├── database/         # TypeORM config, migrations, seeds
│   ├── mailer/          # Nodemailer wrapper (MailerService)
│   └── utils/            # Shared utilities (types, transformers, validators)
│
├── modules/              # Boilerplate base modules (development only)
│   ├── iam/              # Identity & Access Management
│   ├── users/            # User CRUD
│   ├── billing/           # Stripe integration
│   ├── storage/          # File upload
│   └── communications/   # Mail, home
│
├── extensions/           # Dynamic modules (generatable)
│
└── custom/              # Código específico del cliente
```

### APP_MODE Variable

Located in `.env`:

| Value         | Behavior                                     |
| ------------- | -------------------------------------------- |
| `development` | Allows choosing destination (custom/modules) |
| `client`      | Only generates in `custom/`                  |

See **[GENERATORS.md](./GENERATORS.md)** for more details.

### TypeScript Path Aliases

Defined in `tsconfig.json`. Use these instead of long relative paths:

| Alias        | Maps to                        |
| ------------ | ------------------------------ |
| `@iam/*`     | `src/modules/iam/*`            |
| `@users/*`   | `src/modules/users/*`          |
| `@comms/*`   | `src/modules/communications/*` |
| `@billing/*` | `src/modules/billing/*`        |
| `@storage/*` | `src/modules/storage/*`        |
| `@social/*`  | `src/modules/social/*`         |
| `@infra/*`   | `src/infrastructure/*`         |
| `@src/*`     | `src/*`                        |

---

## Frontend (`apps/front`)

Built with **Nuxt 3 + Vue 3 + DaisyUI + Pinia + TanStack Query**.

### Layer System

The frontend is split into **Nuxt Layers** (mini-apps extended by the main app):

```
apps/front/
├── nuxt.config.ts      # Main app — registers all layers in "extends"
├── app.vue
├── layouts/
├── public/
└── modules/
    ├── auth/           # Login, register, password reset
    ├── ui-app/         # Shared UI: DataTable, Form components, sidebar
    └── <feature>/      # Arbitrary feature layers (incidents, properties…)
```

Each layer has its own `nuxt.config.ts`, `pages/`, `components/`, `store/`, `composables/`.

See **[FRONTEND-LAYERS.md](./FRONTEND-LAYERS.md)** for the full guide.

---

## Environment Variables

Copy `.env.example` → `.env` in `apps/back/`. Key variables:

| Variable                    | Purpose                       |
| --------------------------- | ----------------------------- |
| `DATABASE_URL`              | PostgreSQL connection string  |
| `AUTH_JWT_SECRET`           | JWT signing secret            |
| `AUTH_JWT_TOKEN_EXPIRES_IN` | e.g. `15m`                    |
| `AUTH_REFRESH_SECRET`       | Refresh token secret          |
| `MAIL_HOST`, `MAIL_PORT`    | SMTP config                   |
| `FILE_DRIVER`               | `local` or `s3`               |
| `REDIS_URL`                 | Required if using email queue |
| `STRIPE_SECRET_KEY`         | Stripe integration            |

---

## Related Docs

| File                                           | Topic                                |
| ---------------------------------------------- | ------------------------------------ |
| [BACKEND-RESOURCES.md](./BACKEND-RESOURCES.md) | Creating CRUD resources & migrations |
| [AUTHORIZATION.md](./AUTHORIZATION.md)         | Auth decorators, guards, RBAC        |
| [FRONTEND-LAYERS.md](./FRONTEND-LAYERS.md)     | Nuxt layers, middleware, auth store  |
| [EMAIL-SYSTEM.md](./EMAIL-SYSTEM.md)           | Mail service, templates, queue       |
| [EXTENSIONS-SYSTEM.md](./EXTENSIONS-SYSTEM.md) | Dynamic extension modules            |
| [GENERATORS.md](./GENERATORS.md)               | Hygen CLI generators                 |
