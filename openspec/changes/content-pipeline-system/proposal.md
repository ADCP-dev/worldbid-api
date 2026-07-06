# Proposal: Content Pipeline + Autonomous Agent System

## Intent

Sistema autónomo de generación de contenido multi-nicho que produce blogs, posts sociales, y productos digitales usando IA. El humano aprueba ideas y contenido final; el sistema hace el 90% del trabajo. Diseñado para monetizar via afiliados, dropshipping, y productos digitales.

Dos extensiones:
1. **content-pipeline** — Pipeline de contenido: research → ideas → drafts → publish. Orquesta CMS, Upload-Post, y Affiliate (opcionales).
2. **autonomous-agent** — Bucle autónomo: scheduling, monitoring, feedback loop. Coordina content-pipeline via BullMQ + cron.

## Scope

### In Scope

- `content-pipeline` extension: 4 entidades (project, idea, draft, metrics), 9 services, controllers admin, frontend Kanban + DataTable + review UI
- `autonomous-agent` extension: 2 entidades (agent-run, agent-config), 3 services (orchestrator, feedback, alert), BullMQ queue integration, cron scheduling
- Integración opcional con CMS (blog publish), Upload-Post (social publish), Affiliate (link injection)
- Detección runtime de extensiones opcionales (graceful degradation)
- Hermes cron jobs: research (diario), generate (diario), publish (diario), metrics (semanal)
- Multi-nicho: cada project es un nicho independiente con su brandVoice, keywords, affiliateConfig, socialConfig

### Out of Scope

- Amazon Product Advertising API integration (requiere 3 ventas previas)
- Dropshipping fulfillment integration (fase posterior)
- Ebook generation automática (fase posterior)
- Multi-idioma (solo ES al inicio, CMS ya soporta translations)
- Video generation automática (WaveSpeed images solo, no video)

## Capabilities

### New Capabilities

- `content-pipeline`: Pipeline de contenido multi-nicho con research, generación, revisión, y publicación. Integra CMS + Upload-Post + Affiliate opcionalmente.
- `autonomous-agent`: Bucle autónomo que schedula, ejecuta, monitoriza, y aprende del pipeline de contenido. Feedback loop de métricas a research.

### Modified Capabilities

Ninguna — ambas son nuevas extensiones, no modifican comportamiento existente.

## Approach

**content-pipeline** es el motor de generación. Toma ideas (manuales o AI-researched), genera drafts (GLM-5.2 + WaveSpeed), optimiza SEO, inyecta afiliados, y publica via CMS/Upload-Post cuando el humano aprueba.

**autonomous-agent** es el cerebro. Schedulea runs del pipeline, recopila métricas, ajusta estrategia (feedback loop), y alerta via Telegram/email. Usa BullMQ para colas y NestJS @Cron para scheduling.

Arquitectura: content-pipeline NO depende de autonomous-agent. Funciona standalone via API. autonomous-agent depende de content-pipeline (declara dependency en manifest).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/back/src/extensions/content-pipeline/` | New | Extension completa: entities, services, controllers, DTOs, config |
| `apps/back/src/extensions/autonomous-agent/` | New | Extension completa: entities, services, controllers, DTOs, config |
| `apps/front/extensions/content-pipeline/` | New | Nuxt layer: Kanban ideas, DataTable drafts, project config, metrics dashboard |
| `apps/front/extensions/autonomous-agent/` | New | Nuxt layer: agent status, run history, config, logs |
| `apps/back/src/config/config.type.ts` | Modified | Añadir `'content-pipeline'` y `'autonomous-agent'` a AllConfigType |
| `apps/back/src/core/infrastructure.module.ts` | Modified | Importar configs de ambas extensiones |
| `apps/front/nuxt.config.ts` | Modified | Añadir extends + alias para ambas extensiones |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Google penaliza contenido a escala | Medium | Human-in-the-loop obligatorio. No auto-publish por defecto |
| GLM-5.2 calidad insuficiente | Medium | Prompts estructurados + iteración draft→critique→revise |
| Cuentas sociales nuevas penalizadas | High | Warmup phase config en socialConfig. Gradual ramp-up |
| Coste tokens LLM | Low | Ollama Cloud $20/mes flat. Coste despreciable |
| Extensiones opcionales no detectadas | Low | Runtime checks con ConfigService. Graceful degradation |

## Rollback Plan

Borrar ambas carpetas de extensions/. App arranca sin ellas. Quitar entries de config.type.ts, infrastructure.module.ts, y nuxt.config.ts. Tablas DB quedan huérfanas (migración de cleanup posterior).

## Dependencies

- Ollama Cloud (GLM-5.2) — LLM para content generation
- WaveSpeed AI — Image generation
- Tavily API — Trend research (ya en Hermes env)
- BullMQ + Redis — Queue system (ya en Foundation)
- CMS extension (opcional) — Blog publishing
- Upload-Post extension (opcional) — Social publishing
- Affiliate extension (opcional) — Link injection

## Success Criteria

- [ ] Crear un proyecto "Air Fryer ES" desde el panel admin
- [ ] Sistema genera 3-5 ideas/día via Tavily research
- [ ] Human aprueba ideas → sistema genera drafts con GLM-5.2 + imágenes WaveSpeed
- [ ] Human aprueba drafts → sistema publica blog post via CMS + programa social via Upload-Post
- [ ] Sistema inyecta links de afiliado si affiliate extension está activa
- [ ] Cron diario ejecuta pipeline automáticamente
- [ ] Reporte semanal via email/Telegram con métricas
- [ ] Segundo nicho configurable sin cambiar código