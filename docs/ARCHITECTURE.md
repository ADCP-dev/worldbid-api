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
├── main.ts                       # App bootstrap
├── app.module.ts                 # Root module (2 imports: InfrastructureModule + FoundationModule)
│
├── config/                       # Global env config (app, worker)
├── core/                         # Core infrastructure
│   ├── infrastructure.module.ts  # DB, Config, i18n, static files, scheduler
│   ├── foundation.module.ts      # All feature modules (what makes this app an app)
│   ├── extension-loader.ts       # Extension auto-discovery
│   ├── seed-loader.ts           # Extension seed auto-discovery
│   └── config-loader.ts         # Extension config auto-discovery
│
├── infrastructure/               # Cross-cutting concerns
│   ├── database/                # TypeORM config, migrations, seeds
│   ├── mailer/                  # Nodemailer wrapper (MailerService)
│   └── utils/                   # Shared utilities
│
├── modules/                     # Feature modules
│   ├── iam/                     # Identity & Access Management
│   │   ├── iam.module.ts       # Groups: Auth + Session + ApiKeys + Social
│   │   ├── auth/               # JWT + API Key authentication
│   │   ├── auth-facebook/       # Facebook OAuth
│   │   ├── auth-google/         # Google OAuth
│   │   ├── auth-apple/          # Apple OAuth
│   │   ├── session/            # Session management
│   │   ├── roles/              # Roles + Guard + Decorator
│   │   └── api-keys/           # API Keys authentication
│   ├── users/                   # User CRUD + Status
│   ├── communications/          # Communications
│   │   ├── comms.module.ts     # Groups: Mail + Home
│   │   ├── mail/               # Email templates and sending
│   │   ├── email-queue/        # Bull queue for async emails
│   │   └── home/               # Home controller
│   ├── storage/                 # File storage
│   │   ├── storage.module.ts   # Groups: FilesModule
│   │   └── files/             # Files with local/S3/S3-presigned drivers
│   ├── billing/                 # Billing
│   │   └── billing.module.ts   # Groups: StripeModule
│   │       └── stripe/        # Stripe integration
│   ├── translations/           # Database i18n
│   └── error-tracker/         # Error tracking
│
├── extensions/                   # Dynamic extensions (auto-discovery)
│   └── .gitkeep                # Drop-in features — copy folder, works
│
└── i18n/                        # JSON translation files
```

### AppModule — Minimal Template

```typescript
// app.module.ts — 15 líneas, 2 imports
@Module({
  imports: [
    InfrastructureModule, // DB, Config, i18n, static files, scheduler
    FoundationModule, // All feature modules
  ],
})
export class AppModule {}
```

**Principio**: `app.module.ts` es el template. Para agregar/quitar features, editás `FoundationModule`, no `app.module.ts`.

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
