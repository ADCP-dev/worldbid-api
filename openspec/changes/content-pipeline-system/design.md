# Design: Content Pipeline + Autonomous Agent

## Technical Approach

Dos extensiones NestJS drop-in que cooperan via BullMQ. content-pipeline expone servicios de generación; autonomous-agent los schedulea y monitoriza. Detección runtime de CMS/Upload-Post/Affiliate via ConfigService.

## Architecture Decisions

### Decision: Detección runtime vs dependencias declarativas

**Choice**: `dependencies: { extensions: [] }` en manifest + runtime checks con ConfigService
**Alternatives**: Declarar deps obligatorias en manifest → loader las salta si faltan
**Rationale**: content-pipeline funciona standalone (solo genera drafts). CMS/Upload-Post/Affiliate son enhancement, no requirement. El loader actual no soporta deps opcionales.

### Decision: BullMQ vs @Cron directo

**Choice**: BullMQ para jobs de generación (long-running, retryable) + @Cron para scheduling
**Alternatives**: Solo @Cron (sin cola) — más simple pero sin retry/parallelism
**Rationale**: LLM calls tardan 30-90s. Sin cola, un @Cron bloquea el event loop. BullMQ da retries, dead letter, paralelismo, y observabilidad.

### Decision: LangChain vs HTTP directo a Ollama

**Choice**: HTTP directo (fetch) a Ollama Cloud API
**Alternatives**: LangChain SDK — más abstracción pero añade dependencia pesada
**Rationale**: GLM-5.2 usa API OpenAI-compatible. Un wrapper HTTP de 30 líneas es más ligero que LangChain. Si cambiamos de modelo, solo cambia la URL.

### Decision: Frontend con @base/ui-app

**Choice**: Kanban component para ideas, DataTable para drafts, FormInput/FormSelect para config, RichEditor para draft review
**Alternatives**: Componentes custom — prohibido por skill frontend
**Rationale**: El skill dice "SIEMPRE @base/ui-app, NUNCA custom". Kanban ya existe con KanbanColumn, KanbanCard, KanbanTag.

### Decision: Dos extensiones vs una

**Choice**: content-pipeline (motor) + autonomous-agent (cerebro) separadas
**Alternatives**: Una sola extensión — más simple
**Rationale**: content-pipeline funciona standalone via API. autonomous-agent añade scheduling autónomo. Borrar autonomous-agent deja content-pipeline manual. Separación de concerns.

## Data Flow

```
Hermes Cron / @Cron
    │
    ▼
autonomous-agent (BullMQ enqueue)
    │
    ▼
content-pipeline services
    ├── TrendResearchService (Tavily HTTP)
    │     └── → ext_cp_idea (status: idea)
    │
    ├── ContentGeneratorService (Ollama HTTP)
    │     ├── ImageGeneratorService (WaveSpeed HTTP)
    │     ├── SeoOptimizerService
    │     ├── AffiliateInjectorService (if affiliate present)
    │     └── → ext_cp_draft (status: draft)
    │
    ├── PublishingService
    │     ├── BlogPostsService.create() (if CMS present)
    │     ├── UploadPostClientService.uploadVideo/photo (if Upload-Post present)
    │     └── → ext_cp_draft.publishedTo
    │
    └── MetricsService
          ├── CMS views (if CMS present)
          ├── Upload-Post analytics (if Upload-Post present)
          └── → ext_cp_metrics
                │
                ▼
          autonomous-agent feedback loop
                │
                ▼
          next research cycle (prioritized)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `apps/back/src/extensions/content-pipeline/` | Create | Extension completa |
| `apps/back/src/extensions/autonomous-agent/` | Create | Extension completa |
| `apps/front/extensions/content-pipeline/` | Create | Nuxt layer frontend |
| `apps/front/extensions/autonomous-agent/` | Create | Nuxt layer frontend |
| `apps/back/src/config/config.type.ts` | Modify | +2 tipos de config |
| `apps/back/src/core/infrastructure.module.ts` | Modify | +2 registerAs imports |
| `apps/front/nuxt.config.ts` | Modify | +2 extends + aliases |

## Interfaces / Contracts

### content-pipeline entities

```typescript
// ext_cp_project
@Entity('ext_cp_project')
class CpProjectEntity {
  id: uuid; name: string; slug: string; niche: string;
  keywords: string[]; brandVoice: string; targetAudience: string;
  language: string; authorPersona: jsonb;
  affiliateConfig: jsonb; socialConfig: jsonb; cmsConfig: jsonb;
  autoPublish: jsonb; status: 'active'|'paused'|'archived';
}

// ext_cp_idea
@Entity('ext_cp_idea')
@Index(['projectId'])
class CpIdeaEntity {
  id: uuid; projectId: uuid;
  title: string; angle: string; keywords: string[];
  targetPlatforms: string[]; contentType: string;
  source: string; researchData: jsonb;
  status: 'idea'|'approved'|'generating'|'generated'|'rejected';
  priority: number; order: number;
}

// ext_cp_draft
@Entity('ext_cp_draft')
@Index(['ideaId']) @Index(['projectId'])
class CpDraftEntity {
  id: uuid; ideaId: uuid; projectId: uuid;
  blogContent: text; seoMetadata: jsonb;
  socialVariants: jsonb; images: jsonb;
  affiliateLinks: jsonb; generationLog: jsonb;
  status: 'draft'|'in_review'|'approved'|'publishing'|'published'|'rejected';
  reviewNotes: string; publishedTo: jsonb; publishedAt: Date;
}

// ext_cp_metrics
@Entity('ext_cp_metrics')
@Index(['draftId']) @Index(['projectId']) @Index(['snapshotDate'])
class CpMetricsEntity {
  id: uuid; draftId: uuid|null; projectId: uuid;
  platform: string; snapshotDate: date; metrics: jsonb;
}
```

### autonomous-agent entities

```typescript
// ext_aa_config
@Entity('ext_aa_config')
@Index(['projectId'], { unique: true })
class AaConfigEntity {
  id: uuid; projectId: uuid;
  researchCron: string; generateCron: string; publishCron: string;
  metricsCron: string; autoApproveIdeas: boolean;
  autoApproveDrafts: boolean; notifyEmail: boolean;
  notifyTelegram: boolean; telegramChatId: string|null;
  feedbackData: jsonb; status: 'active'|'paused';
}

// ext_aa_run
@Entity('ext_aa_run')
@Index(['configId']) @Index(['projectId'])
class AaRunEntity {
  id: uuid; configId: uuid; projectId: uuid;
  runType: 'research'|'generate'|'publish'|'metrics';
  status: 'pending'|'running'|'completed'|'failed';
  startedAt: Date; completedAt: Date|null;
  duration: number|null; output: jsonb; errorMessage: string|null;
}
```

### Runtime detection pattern

```typescript
// PublishingService
private async isCmsAvailable(): Promise<boolean> {
  return !!this.configService.get('cms', { infer: true })?...;
}
// Si CMS no instalado, config 'cms' no existe → retorna falsy → skip
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | TrendResearchService con Tavily mock | Jest + mocked fetch |
| Unit | ContentGeneratorService con LLM mock | Jest + mocked HTTP |
| Unit | SeoOptimizerService (pure functions) | Jest, sin mocks |
| Unit | AffiliateInjectorService (pure logic) | Jest, sin mocks |
| Integration | PublishingService con CMS real module | Test.createTestingModule |
| Integration | BullMQ queue processing | Integration test con Redis |
| E2E | Full pipeline: idea → draft → publish | Supertest con AppModule |

## Migration / Rollout

1. Fase 1: content-pipeline backend (entities + services + controllers) — sin frontend
2. Fase 2: autonomous-agent backend (entities + orchestrator + crons)
3. Fase 3: Frontend de ambas extensiones
4. Fase 4: Hermes crons config + testing end-to-end
5. Migraciones: `pnpm migration:generate AddContentPipelineTables` + `AddAutonomousAgentTables`

## Open Questions

- [ ] ¿Amazon API integration en fase 1 o posterior? → Posterior (requiere 3 ventas)
- [ ] ¿Telegram bot integration en autonomous-agent o via Hermes? → Via Hermes crons (notificación nativa)
- [ ] ¿WaveSpeed model default? → Flux 2 Klein ($0.008/image) para成本, Z Image Turbo para pins