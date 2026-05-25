# Foundation Monorepo

A **Turborepo** monorepo containing the Foundation project's frontend (**Nuxt 3**) and backend (**NestJS**).

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Environment variables
cp apps/back/.env.example apps/back/.env
# Edit apps/back/.env with your credentials

# 3. Sync assets (logo, favicon, etc.)
pnpm assets:sync

# 4. Build email templates (Maizzle + Tailwind → inline CSS)
cd apps/back && pnpm maizzle:build

# 5. Run database migrations (requires PostgreSQL running)
cd apps/back && pnpm migration:run

# 6. Start development
cd apps/back && pnpm dev    # Backend: http://localhost:3001
cd apps/front && pnpm dev   # Frontend: http://localhost:3000

# Or both at once from root:
pnpm dev
```

---

## 📚 Documentation

All technical documentation is in `docs/`:

| Document                                                  | Topics                                                    |
| --------------------------------------------------------- | --------------------------------------------------------- |
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md)                 | Project structure, `src/` directories, TypeScript aliases |
| [BACKEND-RESOURCES.md](./docs/BACKEND-RESOURCES.md)       | CRUD modules, migrations, seeds, module anatomy           |
| [AUTHORIZATION.md](./docs/AUTHORIZATION.md)               | Auth decorators, guards, RBAC                             |
| [API-KEYS.md](./docs/API-KEYS.md)                         | Permanent API keys, `@ApiKeyAuth`, security               |
| [WEBHOOKS.md](./docs/WEBHOOKS.md)                         | Webhook events, payloads, signatures, retries             |
| [FRONTEND-LAYERS.md](./docs/FRONTEND-LAYERS.md)           | Nuxt layers, middleware, auth store, UI components        |
| [EMAIL-SYSTEM.md](./docs/EMAIL-SYSTEM.md)                 | MailService, Maizzle templates, BullMQ queue              |
| [GENERATORS.md](./docs/GENERATORS.md)                     | Hygen CLI, creating resources, adding properties          |
| [EXTENSIONS-SYSTEM.md](./docs/EXTENSIONS-SYSTEM.md)       | Dynamic extension modules                                 |
| [TRANSLATIONS.md](./docs/TRANSLATIONS.md)                 | i18n system, translation keys, AI translation             |
| [MCP-VECTOR-SEARCH.md](./docs/MCP-VECTOR-SEARCH.md)       | Semantic code search for AI assistants                    |
| [ERROR-LOGGING.md](./docs/ERROR-LOGGING.md)               | Error tracking, deduplication, dashboard                  |
| [STORAGE-ARCHITECTURE.md](./docs/STORAGE-ARCHITECTURE.md) | File storage, polymorphic relationships                   |

---

## 🐳 Docker

Start the full stack (Frontend, Backend, PostgreSQL, Redis, Mailpit):

```bash
docker-compose up --build
```

| Service     | URL                        |
| ----------- | -------------------------- |
| Frontend    | http://localhost:3000      |
| Backend API | http://localhost:3001      |
| Swagger     | http://localhost:3001/docs |
| Mailpit     | http://localhost:8025      |
| Redis       | port 6379                  |

---

## 📦 Monorepo Structure

```
foundation/
├── apps/
│   ├── front/          # Nuxt 3 SPA
│   └── back/           # NestJS API + PostgreSQL + TypeORM
├── docs/               # Technical documentation
├── mcp-engine/         # MCP Vector Search engine
└── docker-compose.yml
```

### Backend (`apps/back/src/`)

```
src/
├── config/             # Global config (app, worker)
├── core/               # Extension loader, seed loader
├── i18n/               # JSON translation files
├── infrastructure/     # Database, mailer, utils
└── modules/
    ├── iam/            # Auth, roles, sessions, API keys
    ├── users/          # Users & statuses
    ├── communications/ # Mail, email-queue, home
    ├── billing/        # Stripe integration
    ├── storage/        # Files (local / S3)
    ├── error-tracker/  # Error logging
    └── social/
```

### Frontend (`apps/front/modules/`)

```
modules/
├── auth/               # Login, register, password recovery
├── ui-app/             # DataTable, Form components, sidebar
└── <feature>/          # Feature-specific modules
```

---

## ⚙️ Environment Variables

Copy `apps/back/.env.example` → `apps/back/.env`. Key variables:

| Variable                    | Description                  |
| --------------------------- | ---------------------------- |
| `DATABASE_URL`              | PostgreSQL connection string |
| `AUTH_JWT_SECRET`           | JWT signing secret           |
| `AUTH_JWT_TOKEN_EXPIRES_IN` | e.g., `15m`                  |
| `AUTH_REFRESH_SECRET`       | Refresh token secret         |
| `MAIL_HOST`, `MAIL_PORT`    | SMTP configuration           |
| `FILE_DRIVER`               | `local` or `s3`              |
| `REDIS_URL`                 | Required for email queue     |
| `STRIPE_SECRET_KEY`         | Stripe integration           |

---

## 🤖 AI-Assisted Development (MCP Vector Search)

This project includes an **MCP Vector Search** system for semantic code search. When using AI assistants (like OpenCode), the AI can search your codebase by meaning instead of using shell commands.

### Setup

```bash
# 1. Start Qdrant (vector database)
cd mcp-engine && docker-compose up -d

# 2. Add your OpenRouter API key to .env.local
echo "OPENROUTER_API_KEY=your_key" > .env.local

# 3. Index your project
npx tsx mcp-engine/src/cli.ts index
```

### Usage

The AI will automatically use these tools:

- `buscar_codigo` - Semantic code search
- `stats_index` - View index statistics
- `necesita_reindex` - Check if code is up to date

### Configuration

The project already includes `opencode.json` and `AGENTS.md` configured for AI assistants to use the MCP search.

See [MCP-VECTOR-SEARCH.md](./docs/MCP-VECTOR-SEARCH.md) for detailed setup instructions.

---

## 🧰 Useful Commands

From `apps/back`:

```bash
pnpm generate:resource      # Create a full CRUD module
pnpm generate:extension     # Create an extension module
pnpm add:property           # Add a property to a resource
pnpm migration:generate     # Generate migration from entity changes
pnpm migration:run          # Run pending migrations
pnpm migration:revert       # Revert last migration
pnpm seed:run               # Run seeders (roles, initial users)
pnpm maizzle:build          # Compile email templates (Tailwind → inline CSS)
```

From root:

```bash
pnpm assets:sync            # Sync frontend assets → backend (logo, favicon)
pnpm build                  # Build both apps via Turborepo
pnpm --filter foundation-nestjs build   # Build backend only (SWC: ~200ms)
```

---

Built with ❤️ by the Foundation team.
