# Documentation Index

## Core Modules (`docs/modules/`)

Each file has YAML frontmatter declaring its `id`, `type`, `dependencies`, and conventions.

| Document | Topics |
|---|---|
| [auth.md](./modules/auth.md) | JWT + Refresh Token rotation, RBAC via `@Roles`/`@Permissions`, social login (Google/Facebook/Apple), API Key auth, guards, session management |
| [database.md](./modules/database.md) | Domain-Driven architecture, CRUD modules, TypeORM migrations, seeds, DTO patterns, entity conventions |
| [storage.md](./modules/storage.md) | File storage (local/S3 drivers), polymorphic relationships, garbage collection, FileEntity schema |
| [email.md](./modules/email.md) | MailerService, Maizzle templates, BullMQ queue, SMTP config, Mailpit local dev |
| [webhooks.md](./modules/webhooks.md) | Webhook standard, HMAC signatures, dispatch service, retry policy, security |
| [translations.md](./modules/translations.md) | i18n system (DB + file hybrid), Lang entity, translation CLI, AI translation agent |
| [error-logging.md](./modules/error-logging.md) | Error tracking, deduplication, dashboard, Telegram notifications |

## Extensions (`docs/extensions/`)

| Document | Topics |
|---|---|
| [cms.md](./extensions/cms.md) | CMS — pages, blog posts, SEO, media management, TipTap editor, sitemap, rendering strategy (SSR/SSG/SWR) |

## Architecture & Reference

| Document | Topics |
|---|---|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Auto-generated dependency graph (Mermaid) from YAML frontmatter |
| [TOOLS.md](./TOOLS.md) | Complete tool catalog — code generation, database, development, skills, research, worktrees |
| [FRONTEND-LAYERS.md](./FRONTEND-LAYERS.md) | Nuxt layers, page routing, middleware, auth store, TanStack Query, sidebar injection |
| [EXTENSIONS-SYSTEM.md](./EXTENSIONS-SYSTEM.md) | Extension auto-discovery architecture, extension manifest, dependency resolution |
| [GENERATORS.md](./GENERATORS.md) | Hygen commands, EJS templates, creating and customizing generators |
| [CREATE-EXTENSION.md](./CREATE-EXTENSION.md) | Step-by-step guide to create a new extension |
| [TYPESCRIPT-GUIDELINES.md](./TYPESCRIPT-GUIDELINES.md) | TypeScript conventions — imports, types, null handling, env, logging |

## For AI Agents

Start here: **[ARCHITECTURE.md](./ARCHITECTURE.md)** → **[TOOLS.md](./TOOLS.md)**
Module details: **[docs/modules/](./modules/)** — each file is a self-contained reference with YAML frontmatter.
