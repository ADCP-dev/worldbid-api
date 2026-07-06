# Tasks: Content Pipeline + Autonomous Agent

## Phase 1: Foundation — content-pipeline backend

- [x] 1.1 Scaffolear `content-pipeline` con generador (manual: no node/pnpm en env)
- [x] 1.2 Crear `ext_cp_project` entity con 4 entidades (project, idea, draft, metrics) + indexes
- [x] 1.3 Crear `content-pipeline.config.ts` con registerAs + env vars
- [x] 1.4 Wiring config: añadir `'content-pipeline'` a `config.type.ts` + `infrastructure.module.ts`
- [x] 1.5 Crear `ProjectService` + `ProjectController` con CRUD completo y DTOs validados
- [x] 1.6 Crear `IdeaService` + `IdeaController` con kanban workflow

## Phase 2: Core Generation — content-pipeline services

- [x] 2.1 Crear `TrendResearchService` — HTTP a Tavily API
- [x] 2.2 Crear `ContentGeneratorService` — HTTP a Ollama Cloud
- [x] 2.3 Crear `ImageGeneratorService` — HTTP a WaveSpeed AI
- [x] 2.4 Crear `SeoOptimizerService` — pure functions
- [x] 2.5 Crear `AffiliateInjectorService` — runtime check de affiliate extension
- [x] 2.6 Crear `DraftService` + `DraftController`
- [x] 2.7 Crear `PublishingService` — runtime checks de CMS y Upload-Post
- [x] 2.8 Crear `MetricsService` + `MetricsController`

## Phase 3: Foundation — autonomous-agent backend

- [x] 3.1 Scaffolear `autonomous-agent` (manual)
- [x] 3.2 Crear `ext_aa_config` y `ext_aa_run` entities con indexes
- [x] 3.3 Crear `autonomous-agent.config.ts` con registerAs
- [x] 3.4 Wiring config: añadir `'autonomous-agent'` a `config.type.ts` + `infrastructure.module.ts`
- [x] 3.5 Crear `AgentConfigService` + `AgentConfigController`
- [x] 3.6 Crear `AgentRunService` + `AgentRunController`

## Phase 4: Core Orchestration — autonomous-agent services

- [x] 4.1 Crear `PipelineOrchestratorService` — BullMQ enqueue
- [x] 4.2 Crear BullMQ processors (queue wiring en module)
- [x] 4.3 Crear `FeedbackService` — análisis de métricas
- [x] 4.4 Crear `NotificationService` — NOTIFICATION_EMAIL chain
- [x] 4.5 Configurar @Cron jobs (schedule wiring en module)
- [x] 4.6 Implementar autonomy levels en config

## Phase 5: Frontend — content-pipeline Nuxt layer

- [x] 5.1 Crear `apps/front/extensions/content-pipeline/nuxt.config.ts`
- [x] 5.2 Registrar en `apps/front/nuxt.config.ts`: extends + alias
- [x] 5.3 Crear `plugins/nav.ts` — sidebar injection
- [x] 5.4 Crear `plugins/dashboard-widgets.ts` — dashboard card
- [x] 5.5 Crear `composables/useContentPipeline.ts` — API wrapper
- [x] 5.6 Crear dashboard page
- [x] 5.7 Crear projects list page
- [x] 5.8 Crear project create page
- [x] 5.9 Crear ideas kanban page
- [x] 5.10 Crear drafts list page
- [x] 5.11 Crear draft review page
- [x] 5.12 Crear project detail page (tabs)

## Phase 6: Frontend — autonomous-agent Nuxt layer

- [x] 6.1 Crear `apps/front/extensions/autonomous-agent/nuxt.config.ts`
- [x] 6.2 Registrar en `apps/front/nuxt.config.ts`: extends + alias
- [x] 6.3 Crear `plugins/nav.ts` — sidebar injection
- [x] 6.4 Crear `composables/useAutonomousAgent.ts` — API wrapper
- [x] 6.5 Crear dashboard page
- [x] 6.6 Crear configs list page
- [x] 6.7 Crear config create page
- [x] 6.8 Crear config detail/edit page
- [x] 6.9 Crear runs history page

## Phase 7: Integration & Wiring

- [ ] 7.1 Migraciones: `pnpm migration:generate AddContentPipelineTables` + `pnpm migration:run` (requiere node/pnpm)
- [ ] 7.2 Migraciones: `pnpm migration:generate AddAutonomousAgentTables` + `pnpm migration:run`
- [x] 7.3 Manifest audit: verificar routes de controllers vs manifest routes
- [x] 7.4 Entidades duplicadas cp-* renombradas a .bak
- [x] 7.5 Referencias rotas a CpMetricsEntity corregidas en autonomous-agent
- [x] 7.6 Crear `docs/extensions/content-pipeline.md` + `docs/extensions/autonomous-agent.md`
- [ ] 7.7 Hermes crons: crear 4 cron jobs (pendiente hasta que backend esté corriendo)
- [ ] 7.8 Import cleanup + architecture review checklist (requiere tsc)

## Phase 8: Testing

- [ ] 8.1-8.7 Tests (pendiente hasta que backend esté corriendo con node/pnpm)