---
doc: RESOLVED-OPEN-QUESTIONS
title: "Open Questions Resueltas — Senior Review"
status: approved
created: 2026-07-07
reviewer: Senior Architect
---

# Open Questions Resueltas — Senior Review

Resolución de las open questions de los 9 PRDs en `docs/prds/`. Cada
decisión se justifica con evidencia del codebase, el contexto del
proyecto (decoupling, skills, arquitectura) y el objetivo de cada
extensión.

**Convención de marcas**:
- ✅ **DECIDIDO** — cerrado, aplicar
- 🟡 **POSTERGADO** — válido pero fuera de este ciclo, documentar
- ⚠️ **ASK FIRST** — requiere OK del usuario antes de añadir dep
- 🚫 **DESCARTADO** — no se hace

---

## Verificaciones previas al codebase (impactan múltiples PRDs)

| Verificación | Resultado | Impacto |
|---|---|---|
| `packages/` existe | **NO existe** | shared code sin home → ver Q-006 base |
| `@nestjs/schedule` instalado | **Sí, v6.1.1** en `apps/back/package.json` | resuelve Q-01 stripe, Q-09 cms, Q-008 upload-post |
| `@nestjs/bullmq` + `bullmq` instalados | **Sí** | Q-001 upload-post, Q-CP-008 content-pipeline |
| `ScheduleModule.forRoot()` wired | **Sí** en `apps/back/src/core/infrastructure.module.ts` | resuelve Q-09 cms |
| `autonomous-agent` usa `ScheduleModule` | **Sí** en su `extension.module.ts` | patrón de referencia para otras extensions |
| ECharts + vue-echarts instalados | **Sí** | Q-001 base cerrado |
| `extensions/analytics/` usa ECharts | **Sí** (referenciado por PRD base) | consistencia confirmada |

---

## PRD: base-ui-components (9 questions)

### Q-001 — Lib de charts: echarts vs custom SVG → ✅ DECIDIDO
**Decisión**: wrapper ECharts (`vue-echarts`).

**Razón técnica**:
- ECharts + vue-echarts YA instalados y en uso en `extensions/analytics/`.
- Custom SVG para charts simples parece más liviano, pero reinventa
  tooltips, zoom, accessibility, theming — todo lo que ECharts ya da.
- Bundle ya pagado. Agregar SVG custom suma peso, no resta.
- Consistencia visual entre `analytics` y los nuevos componentes base.

**Contra**: si bundle size se vuelve crítico tras medir, reabrir. Hoy
YAGNI.

### Q-002 — Modo cron crudo para power users → ✅ DECIDIDO
**Decisión**: dejar el toggle "modo avanzado" con `FormInput` crudo.

**Razón técnica**:
- FR-006 auto-activa modo avanzado cuando el cron entrante no encaja en
  ningún modo simple. **Sin el toggle, esos crons no se pueden editar** —
  el admin queda trabado.
- Es el escape hatch (T-02 del PRD). Casos como `0 9 1-15 * 1-5` (días
  1-15 del mes, lunes a viernes) no tienen representación en UI simple.
- Costo: 1 prop `advanced` + 1 input. Beneficio: no perder configs
  existentes. Trade-off claro a favor.

### Q-003 — Timezone handling → ✅ DECIDIDO (bloqueante)
**Decisión**: **Opción B** — componente emite `{ cron: string; timezone: string }` (v-model a objeto). Backend guarda tz aparte y convierte en runtime.

**Razón técnica**:
- Opción A (UTC siempre): rompe UX. Admin ve "09:00" pensando Madrid,
  servidor corre 09:00 UTC = 11:00 Madrid. Confusión garantizada.
- Opción C (tz user, backend asume UTC): roto en DST. Inaceptable.
- Opción B es la única correcta. Requiere:
  - `v-model` a objeto `{ cron, timezone }` en vez de string.
  - Backend persiste tz aparte (columna nueva en config entities).
  - `@Cron(cron, { timeZone })` de NestJS soporta tz nativamente.
- **Impacto**: cambios en `AaConfigEntity` (autonomous-agent),
  `ext_stripe_sync_config`, `ext_upload_post_settings`. Breaking change
  menor pero necesario. Documentar en `06-migration-phases.md` de cada
  extensión afectada.

**Notas**: el default timezone es `Intl.DateTimeFormat().resolvedOptions().timeZone`
(browser del admin). Override por config. NO eliminar el campo tz
"por simplificación" — es la decisión incorrecta.

### Q-004 — pathPrefix para 3 carpetas nuevas → ✅ DECIDIDO
**Decisión**: **Opción A** — `pathPrefix: true` para `charts/`, `scheduling/`, `automation/`.

**Razón técnica**:
- Carpeta `form/` usa `pathPrefix: false` → `<FormInput>`. Funciona porque
  los nombres son únicos y hay convención fuerte.
- `charts/` y `scheduling/` son nuevos. Si `pathPrefix: false`, una
  extensión que cree su propio `StatCard` colisiona.
- Nombres namespaced: `<BaseChartsStatCard>`, `<BaseSchedulingCronScheduleEditor>`.
  Más verbosos pero seguros.
- Cambiar después rompe todos los consumers. Decidir ahora.

**Excepción**: `automation/` puede ir `pathPrefix: false` si sus nombres
son lo suficientemente específicos (`LinkedSelect`, `KeyValueEditor`).
Evaluar caso por caso. Por defecto, `true`.

### Q-005 — Accesibilidad charts (altText + fallback) → ✅ DECIDIDO
**Decisión**: añadir `altText: string` obligatorio a `LineChart`, `BarChart`, `DonutChart`, `Gauge`. Slot `fallback` opcional con tabla HTML.

**Razón técnica**:
- NFR-010 del PRD base exige accesibilidad. Sin altText, charts son
  opacos para screen readers.
- ECharts no expone ARIA automáticamente. altText es responsabilidad
  del consumer.
- Tabla HTML como fallback es el patrón WAI-ARIA recomendado para
  data-viz. Opcional porque duplica datos, pero valioso para
  accesibilidad total.

### Q-006 — Portear cronToHuman a backend → 🟡 POSTERGADO
**Decisión**: NO por ahora. `packages/` no existe. Duplicar util en `apps/back/src/...` cuando se necesite preview server-side.

**Razón técnica**:
- `packages/` no existe en el monorepo. No hay home para shared code.
- Crear `packages/shared/` solo para un util es over-engineering.
- El componente funciona standalone. Backend puede validar cron con
  `cron-parser` (lib que ya se pide en Q-001) sin el util de humanización.
- **Cuándo reabrir**: cuando haya ≥3 utils compartidos front+back.
  Entonces sí crear `packages/shared/` con criterio.

### Q-007 — FieldRelation usa useApi() o fetch directo → ✅ DECIDIDO
**Decisión**: `useApi()` obligatorio.

**Razón técnica**:
- `docs/FRONTEND-LAYERS.md` documenta `useApi()` como el composable
  estándar con manejo de 401 + refresh.
- `fetch` directo no maneja sesiones expiradas → rompe en producción.
- No es opinión, es convención del proyecto. Sin excepciones.

### Q-008 — JsonSchemaEditor: subset Zod soportado → ✅ DECIDIDO
**Decisión**: subset documentado. Soportar: `z.object`, `z.string`, `z.number`, `z.boolean`, `z.array(z.object())`, `z.enum`, `z.optional`, `z.nullable`. NO soportar v1: `z.discriminatedUnion`, `z.intersection`, `z.transform`, `z.preprocess`, `z.refine` con efectos.

**Razón técnica**:
- Soportar cualquier schema Zod es construir un runtime de Zod en Vue.
  Costo enorme, ROI bajo.
- El subset cubre los DTOs de las extensiones (validado contra
  `CreateCpProjectDto`, `CreateAaConfigDto` en la research).
- Lo que no se soporta se documenta y el consumer usa `FormInput` crudo.

### Q-009 — TimelineList reemplaza timeline inline del CRM → 🟡 POSTERGADO
**Decisión**: opcional en v1. `TimelineList` se ofrece como base nueva. CRM migra si lo decide en su PRD.

**Razón técnica**:
- Obligar migración retroactiva suma trabajo sin valor inmediato.
- Doble patrón convive temporalmente. Aceptable.
- DoD del PRD base no exige migración retroactiva (regla del proyecto:
  no tocar archivos no relacionados con la tarea actual).

---

## PRD: affiliate (10 questions)

### Q-001 — Modelo de comisión: one-time vs recurring → ✅ DECIDIDO
**Decisión**: one-time en este PRD. Recurring = PRD futuro.

**Razón técnica**:
- Estado actual: one-time (`CommissionService.create()` valida
  `project.paymentStatus==='paid'`, calcula una vez).
- Recurring requiere nueva entidad `AffiliateRecurringCommission` +
  cron mensual + integración con stripe/subscriptions para saber
  qué clientes siguen activos.
- El objetivo del PRD es MEJORAR dashboards/forms/scheduling, no
  rediseñar el modelo de negocio. Scope creep.

### Q-002 — Partner code: auto-generate vs manual vs ambos → ✅ DECIDIDO
**Decisión**: auto-generate por defecto + override opcional. Validar unicidad en ambos casos.

**Razón técnica**:
- Auto-generate puro es rígido. Admin quiere `AFF-JOHN` para un
  partner específico. Forzarlo a `AFF-A8X3K2` es mala UX.
- Manual puro requiere que admin piense un código único cada vez.
  Fricción innecesaria.
- Ambos con validación de unicidad es el patrón estándar (slug de
  CMS, username de IAM). No inventar.

### Q-003 — Payout: automático vs manual → ✅ DECIDIDO
**Decisión**: manual en este PRD. Auto-payout = PRD futuro (Stripe Connect / SEPA / PayPal Payouts).

**Razón técnica**:
- Payout automático es mover dinero real. Requiere integración
  bancaria, manejo de fallos, reconciliación, compliance KYC.
- Es un PRD entero por sí solo, no una opción de un formulario.
- El dashboard muestra "comisiones aprobadas pendientes de pago"
  como KPI → admin actúa manualmente. Suficiente para v1.

### Q-004 — Multi-tier affiliate → 🚫 DESCARTADO
**Decisión**: no. Re-abrir si producto lo pide explícitamente.

**Razón técnica**:
- Multi-tier requiere `parentPartnerId` + cálculo recursivo de
  comisiones. Complejidad alta, adopción incierta.
- El 95% de programas de afiliados son single-tier. YAGNI.

### Q-005 — Cron en vivo vs restart → ✅ DECIDIDO
**Decisión**: **restart** en este PRD. Dinámico como mejora futura.

**Razón técnica**:
- `SchedulerRegistry` de NestJS permite delete + add en runtime,
  pero es frágil con jobs que tienen estado (affiliates con runs
  en progreso).
- Restart es simple, coherente, predecible. Mismo patrón que
  `autonomous-agent` y `upload-post`.
- UX debe ser clara: "aplica al próximo reinicio". El admin sabe.

### Q-006 — Definición de "MRR atribuido" → ✅ DECIDIDO
**Decisión**: **(a)** — suma de `commissionAmount` (approved+paid) últimos 30 días. Proxy simple.

**Razón técnica**:
- Opciones (b) y (c) requieren join con stripe/subscriptions o
  tracking de clientes referidos con suscripciones activas. Datos
  no disponibles sin integración adicional.
- (a) reutiliza datos existentes en `ext_affiliate_commission`.
- "MRR atribuido" es un nombre ambicioso para un proxy. Renombrar
  a "Comisiones (30d)" es más honesto. Pero el KPI es útil.

### Q-007 — Cache de dashboard → 🟡 POSTERGADO
**Decisión**: fresh en este PRD. Cache si volumen degrada.

**Razón técnica**:
- NFR-001 pide < 500ms con índices. Si se cumple, cache es prematuro.
- Cache introduce invalidación, stale data, complejidad.
- YAGNI hasta medir. Si el dashboard tarda > 500ms, añadir
  `@nestjs/cache-manager` con TTL 5min.

### Q-008 — Migrar a TanStack Query → 🟡 POSTERGADO
**Decisión**: no en este PRD. Migración horizontal, otro PRD.

**Razón técnica**:
- `useAffiliate()` usa `$fetch` directo. Migrar a TanStack Query
  afecta todas las extensiones (misma técnica de data fetching).
- Es una decisión horizontal, no vertical de affiliate.
- Si se hace, se hace para todo el frontend en un PRD separado.

### Q-009 — Componentes base nuevos (CommissionStatusBadge, ReferralLinkDisplay) → ✅ DECIDIDO
**Decisión**: añadir al catálogo base como addendum. CommissionStatusBadge → `StatusBadge` genérico. ReferralLinkDisplay → `CopyableField`.

**Razón técnica**:
- `CommissionStatusBadge` es un badge coloreado por status. CRM,
  stripe, upload-post, content-pipeline TODOS tienen status badges.
  Es un componente universal. Generalizar a `StatusBadge` con
  `variant` prop.
- `ReferralLinkDisplay` es un input read-only + botón copiar. Útil
  en cualquier contexto con links compartibles (affiliate, upload-post
  share links, CRM magic links). Generalizar a `CopyableField`.
- **Acción**: añadir FR-012 (`StatusBadge`) y FR-013 (`CopyableField`)
  al PRD base como addendum.

### Q-010 — Cookie window duration → 🚫 DESCARTADO
**Decisión**: fuera de scope. Es tracking de conversión web, no UI.

**Razón técnica**:
- Requiere landing page + cookie + middleware de tracking. No existe.
- El referral se crea manualmente hoy. Cambiar eso es otro PRD.
- No confundir "mejorar UI de affiliate" con "implementar tracking
  de conversión". Son cosas distintas.

---

## PRD: autonomous-agent (11 questions)

### Q-001 — Migrar useAutonomousAgent a TanStack Query → 🟡 POSTERGADO
**Decisión**: no en este PRD. Mismo razonamiento que affiliate Q-008.

**Razón**: migración horizontal, afecta todas las extensiones. PRD separado.

### Q-002 — Templates de auto-suggest: frontend o backend → ✅ DECIDIDO
**Decisión**: frontend en Fase 3. Mover a backend si se desincroniza.

**Razón técnica**:
- Los templates (`daily`, `weekly`, `aggressive`) son presets de
  config. Estables, no cambian sin release.
- Frontend = menos endpoints, menos acoplamiento, iteración más rápida.
- Backend se justifica solo si los templates varían por tenant o env.
  Hoy no es el caso.

### Q-003 — TimeWindowPicker en este PRD → ✅ DECIDIDO
**Decisión**: omitir en Fase 3. Revisitar si se quiere "no ejecutar entre 22:00 y 06:00".

**Razón técnica**:
- El scheduler actual es cron absoluto. No hay concepto de "ventana
  prohibida".
- Añadir TimeWindowPicker sin un caso de uso claro es over-engineering.
- Si surge "no ejecutar de noche", se añade como fase posterior.

### Q-004 — KeyValueEditor para feedbackData → ✅ DECIDIDO
**Decisión**: read-only primero. Editable solo si se documenta el riesgo.

**Razón técnica**:
- `feedbackData` es system-managed por `FeedbackService`. Editarlo
  manualmente rompe el feedback loop (los signals que el agente usa
  para aprender).
- Read-only para transparencia. Editable = debug tool, no feature.
- Si se hace editable, Requires confirmation modal + warning.

### Q-005 — LinkedSelect project → step: ¿B depende de A? → ✅ DECIDIDO
**Decisión**: 2 FormSelect independientes. LinkedSelect se reserva para dependencia real.

**Razón técnica**:
- Hoy todos los runTypes (research/generate/publish/metrics) aplican
  a todos los proyectos. No hay dependencia.
- Forzar LinkedSelect sin dependencia es mentir con la UI. El admin
  ve B filtrado por A pero en realidad B siempre muestra lo mismo.
- LinkedSelect se usa cuando haya tipos de agente por proyecto (Q-008).

### Q-006 — Approval flow para acciones destructivas → 🟡 POSTERGADO
**Decisión**: no en este PRD. Mantener `autoApproveDrafts=false` + modal de confirmación.

**Razón técnica**:
- Agents ejecutan acciones. `publish` puede mandar contenido a
  producción. Es el riesgo principal (R-06).
- Approval flow humano (cola de aprobación, reviewer, reject) es
  un workflow completo. Otro PRD.
- Por ahora: `autoApproveDrafts=false` (default) + modal de
  confirmación antes de acciones destructivas. Mitiga sin
  over-engineering.

### Q-007 — Multi-tenant → 🚫 DESCARTADO
**Decisión**: no. Se resuelve a nivel plataforma, no por extensión.

**Razón técnica**:
- `projectId` es UUID suelto sin FK. Aislar por tenant requiere
  cambios en IAM, no en autonomous-agent.
- Multi-tenant es decisión arquitectural de plataforma. Cada
  extensión no decide esto por sí sola.

### Q-008 — Tipos de agente más allá de runTypes → 🚫 DESCARTADO
**Decisión**: no. runTypes cubren el pipeline. Tipos nuevos = extensión nueva.

**Razón técnica**:
- runTypes (research/generate/publish/metrics) mapean al pipeline
  de content. Es el modelo.
- "SEO agent", "social agent" son perfiles de config, no tipos
  nuevos. Se logran con presets (Q-002), no con columna `agentType`.
- Si los presets no alcanzan, es otra extensión.

### Q-009 — Timezone del scheduler → ✅ DECIDIDO
**Decisión**: añadir `AUTONOMOUS_AGENT_TZ` env. Pasar a `@Cron` options. Mostrar tz del servidor en el form.

**Razón técnica**:
- `@Cron` de NestJS corre en UTC por defecto. Si el admin ve "09:00"
  y el servidor corre "09:00 UTC", hay confusión.
- NestJS `@Cron` acepta `{ timeZone: 'Europe/Madrid' }` en options.
- En alineación con Q-003 base (timezone handling), el tz se persiste
  aparte y se muestra en el form.

### Q-010 — Trigger manual → ✅ DECIDIDO
**Decisión**: sí, con rate limit 1/min por configId. Va en Fase 1.

**Razón técnica**:
- Útil para testing. Útil para "ejecutar ahora" sin esperar al cron.
- Rate limit previene abuso (R-07).
- Costo: 1 endpoint. Beneficio: operatividad real.

### Q-011 — Costo en USD además de tokens → 🚫 DESCARTADO
**Decisión**: no. Tokens es suficiente. USD va con stripe/billing.

**Razón técnica**:
- Convertir tokens a USD requiere tabla de pricing por modelo. El
  modelo (`OLLAMA_MODEL=glm-5.2`) puede cambiar.
- Pricing de modelos cambia. Mantener tabla actualizada es deuda.
- Si se quiere tracking de costo en USD, es feature de billing
  (stripe extension), no de autonomous-agent.

---

## PRD: cms-audit (10 questions)

### Q-001 — Audit on-demand vs scheduled: ¿ambos en v1? → ✅ DECIDIDO
**Decisión**: on-demand primero (fases 0-4). Scheduled en fase 5 separable.

**Razón técnica**:
- On-demand es el caso base. Scheduled añade complejidad (cron,
  persistencia de schedule, notificaciones).
- Entregar valor incremental. On-demand primero, scheduled después.
- Fase 5 es separable sin romper fases 0-4.

### Q-002 — Catálogo de checks v1 → ✅ DECIDIDO
**Decisión**: confirmar los 10 iniciales. Añadir más en iteración.

**Razón técnica**:
- Los 10 cubren lo documentado en `docs/extensions/cms-audit.md`.
- Añadir checks extra (schema.org validator, broken links, alt
  detection) requiere validación con el cliente. Iteración 2.
- No bloquear v1 por perfecto.

### Q-003 — Exportable PDF/CSV → 🟡 POSTERGADO
**Decisión**: posponer a v2. v1 solo vista web.

**Razón técnica**:
- Export PDF requiere lib (pdfkit/puppeteer). CSV es trivial.
- No aparece en FR-NNN. Si el cliente lo pide, añadir FR-037+.
- YAGNI hasta demanda explícita.

### Q-004 — Histórico comparativo (diff entre runs) → 🟡 POSTERGADO
**Decisión**: v1 solo tendencia. Diff en v2.

**Razón técnica**:
- Diff entre runs requiere modelo de datos para comparar findings
  entre runs (qué se fixeó, qué apareció).
- Tendencia (FR-005) cubre el caso "mejoramos o no". Diff es
  siguiente nivel.
- No bloqueante para valor de v1.

### Q-005 — Multi-cms: LinkedSelect target único → ✅ DECIDIDO
**Decisión**: v1 con target único "Foundation CMS". Estructura preparada para añadir options.

**Razón técnica**:
- Hoy solo existe un CMS (la extensión `cms`).
- Preparar la UI con un solo option es válido y permite añadir
  más sin refactor.
- No construir multi-cms sin un segundo CMS real. YAGNI.

### Q-006 — Score: simple o ponderado por severidad → ✅ DECIDIDO
**Decisión**: v1 simple (% de checks pasados). Ponderado en v2.

**Razón técnica**:
- Score simple es comprensible. Ponderado requiere definir pesos
  por severidad (subjetivo).
- v1 entrega valor. v2 ajusta si el cliente pide ponderación.

### Q-007 — Notificaciones email tras run → 🟡 POSTERGADO
**Decisión**: v1 sin notificaciones. Añadir FR-050+ si se requiere.

**Razón técnica**:
- `nodemailer` disponible, pero no aparece en FR.
- Notificaciones requieren config de destinatarios, umbral, template.
- Postergar hasta demanda.

### Q-008 — Permisos: ¿admin hereda? → ✅ DECIDIDO
**Decisión**: `admin` hereda ambos (`cms-audit:read`, `cms-audit:run`). Seed explícito en `ext_cms_audit_seed`.

**Razón técnica**:
- Patrón del proyecto: `admin` hereda todos los permisos.
- Seed explícito asegura que funcione incluso si la herencia cambia.
- Consistente con `docs/modules/auth.md`.

### Q-009 — Componentes base nuevos (SeverityBadge) → ✅ DECIDIDO
**Decisión**: `SeverityBadge` se añade al catálogo base como `StatusBadge` (mismo componente que affiliate Q-009). `ChecklistEditor` no por ahora.

**Razón técnica**:
- `SeverityBadge` = `StatusBadge` con `variant` prop (info/warning/critical).
  Mismo componente que affiliate propuso. Generalizar.
- `ChecklistEditor` es específico de cms-audit. No justifica
  componente base con 1 consumer. Inline ad-hoc.
- `ScoreHistorySparkline` es caso específico de `TrendChart`. Usar
  TrendChart con config compacta.

### Q-010 — Concurrencia de checks configurable → ✅ DECIDIDO
**Decisión**: config de backend en v1. Campo avanzado en form solo si el cliente opera CMS grandes.

**Razón técnica**:
- Concurrencia default 10 es razonable para la mayoría.
- Exponer en form suma complejidad sin valor para el caso común.
- Si el cliente tiene 10k+ páginas, se ajusta por env. No UI.

---

## PRD: cms (12 questions)

### Q-01 — Autores huésped en BarChartCard por autor → ✅ DECIDIDO
**Decisión**: solo users. Autores-string libres se agrupan bajo "Invitados".

**Razón técnica**:
- `BlogPostEntity.authorId` es nullable. `author?: string` existe
  para autores invitados sin cuenta.
- Agrupar bajo "Invitados" es simple y claro.
- No complicar el chart con una categoría por cada string libre.

### Q-02 — Lógica de filtraje LinkedSelect categoría→tags → ✅ DECIDIDO (bloqueante)
**Decisión**: **(a)** heurística — tags asociados a posts de esa categoría (query sobre `ext_cms_blog_post_tag` JOIN).

**Razón técnica**:
- (b) requiere nueva tabla `ext_cms_tag_category` + migración.
  Overhead para un filtraje que se puede hacer con query.
- (c) sin filtraje hace que LinkedSelect mienta (no aporta valor).
- (a) reutiliza datos existentes. Revisar performance con muchos
  posts — si degrada, añadir índice en `(post_id, tag_id)`.

### Q-03 — Versionado de posts → 🚫 DESCARTADO
**Decisión**: fuera de scope. Documentar como "no-objetivo".

**Razón técnica**:
- Versionado requiere snapshots, revert, diff viewer. Es un PRD entero.
- El PRD actual mejora dashboards/forms/scheduling. No añade
  features de contenido.

### Q-04 — Fuente de views/analytics → ⚠️ ASK FIRST
**Decisión**: `[NEEDS CLARIFICATION]`. Si no hay fuente, omitir views y reemplazar por "días desde última publicación" (FR-107).

**Razón técnica**:
- No hay Google Analytics API, Plausible, ni tracker interno
  detectado en la research.
- Sin fuente, los StatCards de views mienten.
- **Pregunta al usuario**: ¿hay alguna fuente de analytics
  configurada (GA4, Plausible, Umami, interno)? Si no, FR de views
  se omite o se deja como placeholder `[NEEDS CLARIFICATION]`.

### Q-05 — Custom post types → 🚫 DESCARTADO
**Decisión**: fuera de scope. PRD aparte si surge.

**Razón técnica**:
- Arquitectura mayor: tabla polimórfica o tablas separadas.
- Page y BlogPost cubren el caso actual. YAGNI.

### Q-06 — Roles CMS granulares → 🟡 POSTERGADO
**Decisión**: postergar a Fase 5. Fases 0-4 funcionan con solo admin.

**Razón técnica**:
- Manifest declara 15 permisos pero controllers usan `@Roles(RoleEnum.admin)`.
- Migrar a permisos granulares (writer/editor/publisher/admin) es
  refactor de RBAC. Afecta todos los controllers.
- No bloquea dashboards/forms/scheduling. Fase 5 si se aprueba.

### Q-07 — Invalidación caché SWR tras publicación programada → ✅ DECIDIDO (bloqueante)
**Decisión**: **(b)** on-demand revalidation con `POST /api/revalidate?path=/blog`.

**Razón técnica**:
- (a) no funciona para SSG.
- (c) reducir TTL degrada performance global.
- (d) aceptar 1h de latencia mata el valor de publicación programada.
- (b) es el patrón Nuxt 4 recomendado. `routeRules` con `swr: 60` +
  endpoint de revalidación. El cronjob de publicación llama a
  revalidate tras publicar.

### Q-08 — Conflictos de edición concurrente → 🟡 POSTERGADO
**Decisión**: warn suave (comparar `updatedAt` al guardar). Locking real en PRD aparte.

**Razón técnica**:
- Optimistic locking (ETag) requiere añadir columna versión.
- Pessimistic lock no escala en web.
- Warn suave es 80% del valor con 20% del esfuerzo.

### Q-09 — ScheduleModule registrado → ✅ DECIDIDO (bloqueante)
**Decisión**: **SÍ está registrado** en `apps/back/src/core/infrastructure.module.ts`. Verificado en codebase.

**Razón técnica**:
- Verificación directa: `ScheduleModule.forRoot()` está wired.
- `@nestjs/schedule` v6.1.1 instalado en `apps/back/package.json`.
- `autonomous-agent` ya lo usa. Patrón de referencia.
- Q-09 cerrada. No bloquea Fase 1.

### Q-10 — Multi-instancia del backend → ✅ DECIDIDO (bloqueante)
**Decisión**: asumir multi-instancia. Usar Bull `@Processor` (no `@Cron` directo para publicar).

**Razón técnica**:
- Si el backend corre en k8s/PM2 cluster, `@Cron` directo publica
  duplicado (una vez por instancia).
- Bull `@Processor` garantiza que un job se procesa una vez (con
  locking de Redis).
- `@Cron` solo encola (idempotente). `@Processor` procesa.
- `@nestjs/bullmq` + `bullmq` YA instalados.

### Q-11 — Workflow draft→review→publish → 🚫 DESCARTADO
**Decisión**: fuera de scope. Sistema actual es binario (`isPublished`).

**Razón técnica**:
- Workflow editorial es PRD separado. Requiere estados intermedios,
  transitions, permisos por estado.
- El PRD actual mejora lo existente, no rediseña el workflow.

### Q-12 — Sitemap tras publicación programada → ✅ DECIDIDO
**Decisión**: aceptar latencia hasta 1h. No crítico.

**Razón técnica**:
- Sitemap se regenera con SWR 1h. El post aparece en el próximo ciclo.
- Sitemap no es tiempo real. Los crawlers no esperan inmediatez.
- On-demand revalidation del sitemap es over-engineering.

---

## PRD: content-pipeline (11 questions)

### Q-CP-001 — Mismatch de contrato dashboard → ✅ DECIDIDO (bloqueante)
**Decisión**: crear `operationalDashboard()` nuevo. Dejar `dashboard()` para performance post-publish.

**Razón técnica**:
- Frontend y backend desalineados. El dashboard actual miente.
- `operationalDashboard()` retorna throughput, latencia, success
  rate, items en cola — datos operacionales.
- `dashboard()` queda para métricas de contenido post-publish.
- Separar concerns es correcto.

### Q-CP-002 — Tipos de sources → ✅ DECIDIDO
**Decisión**: LinkedSelect source→destination se refiere a `targetPlatforms`. `idea.source` es otra dimensión.

**Razón técnica**:
- `idea.source` (manual/ai_research/trend/competitor_analysis) es
  origen de la idea. No es plataforma.
- `targetPlatforms` (blog/instagram/tiktok/pinterest) son plataformas.
- LinkedSelect source→destination = plataforma origen → plataforma
  destino de publicación. Tiene sentido.
- `idea.source` se muestra en BarChartCard top sources.

### Q-CP-003 — Circuit breaker → 🟡 POSTERGADO
**Decisión**: fuera de scope. Retry policy existente (3 intentos, backoff 10s) es suficiente para v1.

**Razón técnica**:
- Circuit breaker (`opossum` o custom) es resiliencia avanzada.
- El retry policy cubre fallos transitorios.
- Circuit breaker previene fallos en cascada, pero requiere tuning
  de thresholds. PRD de resiliencia separado.

### Q-CP-004 — Dead letter queue + drafts huérfanos → 🟡 POSTERGADO
**Decisión**: fuera de scope. BullMQ retiene failed 7d. Dashboard muestra "fallidos 24h".

**Razón técnica**:
- Dead letter queue requiere configuración de BullMQ + proceso de
  revisión manual.
- Para v1, el operador ve fallos en dashboard y revisa.
- Cleanup de drafts huérfanos requiere lógica de timeout (draft en
  `generating` > X minutos → marcar failed).

### Q-CP-005 — Catálogo de step-templates: código vs DB vs JSON → ✅ DECIDIDO
**Decisión**: **(a)** código TypeScript en `composables/useStepTemplates.ts`.

**Razón técnica**:
- Los 6 contentTypes son estables, sin edición runtime.
- Código = tipo seguro, refactor fácil, sin migraciones.
- DB se justifica si los templates varían por tenant o necesitan
  edición sin release. Hoy no.
- JSON en i18n/locales mezcla datos con traducciones. Incorrecto.

### Q-CP-006 — Scheduling dinámico → ✅ DECIDIDO (bloqueante)
**Decisión**: **(a)** `@nestjs/schedule` dinámico (`SchedulerService` con registro/cancela en runtime).

**Razón técnica**:
- (b) polling es ineficiente (leer cada minuto) y añade latencia.
- (c) forzar autonomous-agent acopla extensions innecesariamente.
- (a) es el patrón NestJS nativo. `SchedulerRegistry` permite
  dinámico. autonomous-agent ya lo hace.
- `@nestjs/schedule` YA instalado.

### Q-CP-007 — Backpressure → ✅ DECIDIDO
**Decisión**: solo alerta visual. Sin pausa automática.

**Razón técnica**:
- Pausar encolar puede perder jobs si el operador no ve la alerta.
- Backpressure real requiere circuit breaker en el producer.
- Alerta visual es suficiente para v1. El operador decide.

### Q-CP-008 — Escalar workers de BullMQ → 🟡 POSTERGADO
**Decisión**: fuera de scope. Throughput limitado a 1 job a la vez en v1.

**Razón técnica**:
- Escalar workers requiere considerar CPU (FFmpeg/Chromium son
  CPU-bound) + concurrencia de external APIs.
- Es decisión de infraestructura, no de extensión.
- PRD de infraestructura separado.

### Q-CP-009 — Retención de metrics configurable → 🟡 POSTERGADO
**Decisión**: fuera de scope. 90d hardcodeado es razonable.

**Razón técnica**:
- `RETENTION_DAYS = 90` es un default sensato.
- Hacerlo configurable suma un env var sin valor claro.
- Si se necesita histórico largo, PRD de analytics.

### Q-CP-010 — NestJS Cache para operationalDashboard → ✅ DECIDIDO
**Decisión**: sí. `@nestjs/cache-manager` con TTL 60s.

**Razón técnica**:
- Evita queries repetidas si el operador refresca.
- 60s TTL es razonable para data operacional (no es tiempo real).
- `@nestjs/cache-manager` es dep estándar de NestJS.
- ⚠️ ASK FIRST: añadir dep al usuario. Pero es lib oficial, bajo riesgo.

### Q-CP-011 — Componentes base faltantes → ✅ DECIDIDO
**Decisión**: no hacen falta componentes nuevos. Catálogo base cubre todo.

**Razón técnica**:
- Kanban, DataTable, RichEditor, FormInput/Select ya existen.
- Charts, scheduling, automation cubiertos por PRD base.
- Content-pipeline no necesita componentes específicos.

---

## PRD: crm (10 questions)

### Q-001 — Integración email (Gmail/Outlook) → ✅ DECIDIDO
**Decisión**: **(c)** solo outbound — loggear emails enviados vía SMTP del módulo `email` existente.

**Razón técnica**:
- (b) OAuth Gmail/Outlook es scope grande: OAuth flow, token refresh,
  webhook server, mapping email→cliente. Otro PRD.
- (a) interacciones manuales es el estado actual. Mejorable.
- (c) usa infra existente (Nodemailer ya configurado). Loggea
  emails enviados como `CrmInteraction` tipo `email`. Valor real,
  esfuerzo bajo.

### Q-002 — Enriquecimiento automático (LinkedIn/Clearbit) → 🚫 DESCARTADO
**Decisión**: no. Privacy-first. Opt-in futuro si se pide.

**Razón técnica**:
- Auto-enrich sin consentimiento viola GDPR/LPD (NFR-004).
- Requiere API key de LinkedIn/Clearbit + consentimiento explícito.
- `auto-fill companyName` (FR-010) cubre el caso mínimo sin API externa.

### Q-003 — Scheduling (weekly report + follow-up reminders) → ✅ DECIDIDO
**Decisión**: sí, como fase separada. Requiere `extension.config.ts` + `CrmReportService` + Bull + Nodemailer.

**Razón técnica**:
- CronScheduleEditor + CronNextRunsPreview del PRD base aplican.
- Weekly report y follow-up reminders son casos claros de scheduling.
- Fase separada: no bloquea dashboard ni forms.
- Añadir `06-migration-phases.md` a este PRD.

### Q-004 — ownerId + round-robin assignment → ✅ DECIDIDO
**Decisión**: añadir `ownerId` FK nullable a `CrmClientEntity` (migración) + UI manual. Round-robin automático = PRD futuro.

**Razón técnica**:
- ownerId permite asignar vendedor. Útil.
- Round-robin requiere lógica de "siguiente vendedor disponible" +
  reglas de skip + ausencias. Complejo.
- Manual primero, automático después.

### Q-005 — Status del proyecto: LinkedSelect o FormSelect → ✅ DECIDIDO
**Decisión**: **NO** LinkedSelect. `FormSelect` suelto con options del enum `CrmProjectEntity.type`.

**Razón técnica**:
- `CrmProjectEntity.status` es varchar sin FK a `CrmStatusEntity`.
- `CrmStatusEntity` es para clientes, no proyectos.
- LinkedSelect sin dependencia real miente. FormSelect es honesto.

### Q-006 — Import/export CSV → 🟡 POSTERGADO
**Decisión**: export CSV trivial (endpoint `GET /crm/clients?format=csv`) como NFR-007 opcional. Import = PRD futuro.

**Razón técnica**:
- Export es trivial. Import requiere validación de duplicados,
  mapeo de columnas, rollback. Es un PRD entero.
- Export opcional en este PRD. Import fuera.

### Q-007 — GDPR "right to erasure" → ✅ DECIDIDO
**Decisión**: añadir `PATCH /crm/clients/:id/anonymize` (admin-only). Soft-delete adicional.

**Razón técnica**:
- GDPR exige "right to erasure". Sin esto, el CRM no cumple.
- Hard-delete rompe integridad referencial (métricas históricas).
- Anonymize preserva el registro (para métricas) pero nullifica
  PII (email, phone, nif, name, address). Patrón estándar.
- **Acción**: añadir FR-041 a este PRD.

### Q-008 — CrmProjectEntity.price: mensual o total → ⚠️ ASK FIRST (bloqueante)
**Decisión**: `[NEEDS CLARIFICATION]`. Preguntar al owner del schema.

**Razón técnica**:
- Sin documentación clara. `price` decimal nullable, `type` enum
  (`pack_1..custom`) sugiere packs de precio fijo pero no aclara
  periodicidad.
- Si es total, MRR = `SUM(price) / duration_months` (necesita
  `endDate - startDate`).
- Si es recurrente, MRR = `SUM(price WHERE status='active' AND
  paymentStatus='paid')` directo.
- **Pregunta al usuario**: ¿`CrmProjectEntity.price` es MRR
  (mensual recurrente) o valor total del proyecto?

### Q-009 — Componentes nuevos (FunnelChartCard, ActivityTimeline, ContactAvatar) → ✅ DECIDIDO
**Decisión**:
- `FunnelChartCard`: proponer al PRD base como addendum (FR-014
  nuevo). Mientras tanto, `BarChartCard` horizontal.
- `ActivityTimeline`: inline DaisyUI. No justifica base.
- `ContactAvatar`: reusar `UserAvatar` existente en
  `@base/ui-app/components/kanban/`.

**Razón técnica**:
- FunnelChartCard muestra drop-off entre stages. BarChartCard
  horizontal lo aproxima pero no muestra "pérdida" entre steps.
  CRM, affiliate, stripe, content-pipeline pueden usarlo. ≥2
  consumers justifica base.
- ActivityTimeline es contenido, no data-viz. DaisyUI inline.
- ContactAvatar ya existe. No duplicar.

### Q-010 — Conversión lead→cliente: cómo se calcula → ✅ DECIDIDO
**Decisión**: **(c)** simple — `active / lead * 100` (funnel drop-off).

**Razón técnica**:
- (a) ratio simple no muestra conversión real (lead→active).
- (b) cohort requiere tracking de `statusHistory` (no existe).
- (c) es el funnel real. Simple, honesto. Cohort en v2.

---

## PRD: stripe (10 questions)

### Q-01 — @nestjs/schedule instalado → ✅ DECIDIDO
**Decisión**: **SÍ está instalado** (v6.1.1). Verificado en `apps/back/package.json`.

**Razón técnica**:
- Verificación directa. No es necesario añadir dep.
- `@nestjs/schedule` es más liviano que Bull para 1 job diario.
- YAGNI para Bull aquí.

### Q-02 — Webhook retry policy → ✅ DECIDIDO
**Decisión**: documentar policy default de Stripe (3 días retry). Sync job cubre gap.

**Razón técnica**:
- Stripe reenvía webhooks por 3 días si no recibe 2xx.
- Sync job (Fase 5) recupera eventos perdidos definitivamente.
- No configurar retry custom. Default de Stripe es correcto.

### Q-03 — Soporte multi-cuenta Stripe → 🚫 DESCARTADO
**Decisión**: no en v1. Single account asumido.

**Razón técnica**:
- Arquitectura actual: `stripeCustomerId` en `UserEntity`, un solo
  `STRIPE_SECRET_KEY`.
- Multi-cuenta requiere Stripe Connect (marketplace) o multi-tenant.
- Es rediseño arquitectural, no opción de form.

### Q-04 — Tax/VAT automation → ✅ DECIDIDO
**Decisión**: delegar 100% a Stripe Tax. Dashboard no muestra tax breakdown en v1.

**Razón técnica**:
- `pdf-invoice.service` ya tiene campo `tax` (suma de
  `total_tax_amounts` de Stripe).
- Stripe Tax calcula correctamente si está activo.
- No reimplementar cálculo de tax. YAGNI.

### Q-05 — Customer Portal embed vs redirect → ✅ DECIDIDO
**Decisión**: mantener redirect.

**Razón técnica**:
- Redirect actual funciona
  (`stripe.service.createCustomerPortalForUser`).
- Embed requiere configuración CSP + iframe-allowed-domains.
- YAGNI. Redirect es estándar.

### Q-06 — Timezone del cron de sync → ✅ DECIDIDO
**Decisión**: UTC default + override por config. UI muestra timezone claramente.

**Razón técnica**:
- Sync con Stripe no depende de tz (es reconcile de eventos, no
  schedule humano).
- UTC default es seguro para ops.
- Override por config si se quiere alinear con horario del equipo.
- En alineación con Q-003 base (timezone handling).

### Q-07 — Definición exacta de MRR y churn → ✅ DECIDIDO (bloqueante)
**Decisión**: v1 = definiciones simples (gross).

**Fórmulas**:
- **MRR** = `SUM(unitAmount/100)` mensual-normalizado de
  suscripciones activas (`status='active'`).
- **Churn** = `canceladas_en_período / activas_inicio_período * 100`
  (gross churn).
- Net churn = v2.

**Razón técnica**:
- Net churn (nuetros - churn - downgrades + upgrades) requiere
  tracking de cambios mid-cycle. Complejo.
- Gross es el MVP. Documentar fórmula en `MetricsService`.

### Q-08 — Auditoría formal de sync runs → 🟡 POSTERGADO
**Decisión**: v1 = Logger. Si ops pide historial, añadir tabla en v2.

**Razón técnica**:
- Logger es mínimo. Suficiente para debug.
- Tabla `ext_stripe_sync_log` es overhead sin demanda clara.
- YAGNI hasta que ops pida historial.

### Q-09 — Webhook events adicionales → ✅ DECIDIDO
**Decisión**: añadir `customer.subscription.trial_will_end` → email usuario "tu trial termina en 3 días". NO añadir `payment_intent.payment_failed` (redundante).

**Razón técnica**:
- `trial_will_end` da valor claro: usuario sabe que su trial expira.
- `payment_intent.payment_failed` es redundante con
  `invoice.payment_failed` (ya manejado).
- No añadir events sin valor claro.

### Q-10 — Componentes nuevos (TimelineList, diff viewer) → ✅ DECIDIDO
**Decisión**: inline ad-hoc en `@stripe/components/`. Si > 2 extensiones lo piden, promover a base-ui.

**Razón técnica**:
- Timeline de eventos de billing es específico de stripe.
- Diff viewer de sync drift es específico de stripe.
- 1 consumer no justifica componente base. Regla del PRD base: ≥2.

---

## PRD: upload-post (10 questions)

### Q-001 — Mover procesamiento local a cola Bull → ✅ DECIDIDO
**Decisión**: sí para auto-extracción pesada (IA en Q-004) y retry de fallos. `@nestjs/bullmq` YA instalado.

**Razón técnica**:
- Sin cola, auto-tag con IA bloquea el request del admin. Mala UX.
- Bull con backoff exponencial (max 3 intentos) reduce intervención
  manual.
- `@nestjs/bullmq` + `bullmq` YA instalados. No es dep nueva.

### Q-002 — Schedule recurrente: expansión backend o API nativa → ⚠️ ASK FIRST
**Decisión**: investigar `docs.upload-post.com` (Context7/Tavily). Si la API soporta recurring nativo, delegar. Si no, expansión backend.

**Razón técnica**:
- Sin docs de la API Upload-Post, no se puede decidir.
- Si la API soporta recurring nativo (pasar cron + until), delegar
  simplifica el backend.
- Si no, el backend expande `cron + untilDate` en N `scheduledDate`
  puntuales. Limitación: editar cron recrea jobs.
- **Acción**: usar Context7 o Tavily para buscar docs de Upload-Post
  API. Si no se encuentra, asumir expansión backend.

### Q-003 — cron-parser en backend → ✅ DECIDIDO
**Decisión**: sí. Misma lib que frontend (consistencia).

**Razón técnica**:
- Validar cron antes de persistir evita guardar crons inválidos.
- Sin validación, el admin guarda un cron inválido y no recibe
  feedback hasta el siguiente bootstrap (cuando `@Cron` lo loguea).
- `cron-parser` es lib pequeña, sin dependencias.
- ⚠️ ASK FIRST: añadir dep al backend. Pero es lib estándar.

### Q-004 — Auto-detección de contenido por IA → 🟡 POSTERGADO
**Decisión**: fuera de scope MVP. MVP = filename + EXIF básico. IA como fase 2 con cola Bull (Q-001).

**Razón técnica**:
- IA (visión/transcripción) clasifica contenido y sugiere tags +
  caption. Valor alto, pero costo y latencia importan.
- Sin cola (Q-001), bloquea el request. Inaceptable.
- Fase 2: con cola Bull, evaluar proveedor (HeyGen, OpenAI Vision,
  local whisper).

### Q-005 — Multi-perfil → 🚫 DESCARTADO
**Decisión**: no. MVP = single-profile (alineado con caso SOM-OS).

**Razón técnica**:
- Multi-perfil cambia el modelo de datos (FK `profileUsername` en
  todas las entidades) + UI (selector de perfil en cada página).
- El caso SOM-OS es single-profile. YAGNI.

### Q-006 — Tamaño máximo de archivo y retención → ✅ DECIDIDO
**Decisión**: `UPLOAD_POST_MAX_FILE_SIZE_MB=500` videos, `50` fotos. Retención de temporales: 24h, cleanup vía cron diario.

**Razón técnica**:
- Sin límite, el storage module falla con 413 propio del driver.
  Mejor rechazo temprano en la UI.
- 24h retención es razonable para temporales de auto-extracción.
- Cleanup vía cron diario existente (añadir `cleanupTempFiles`).

### Q-007 — Política de retry de publicación fallida → ✅ DECIDIDO
**Decisión**: 3 reintentos con backoff exponencial (1m, 5m, 15m) vía Bull. Tras 3 fallos, `status=error` + notificar al admin.

**Razón técnica**:
- Sin retry, el admin ve el error en el dashboard Donut pero tiene
  que actuar manualmente. Mala operatividad.
- 3 intentos con backoff es estándar. Más es spam.
- Notificación al `UPLOAD_POST_WEEKLY_REPORT_EMAIL` o
  `app.notificationEmail`.

### Q-008 — Cron dinámico vs reinicio → ✅ DECIDIDO (bloqueante)
**Decisión**: **dinámico**. `@nestjs/schedule` lo soporta via `SchedulerRegistry`.

**Razón técnica**:
- Si requiere reinicio, el admin prefiere editar `.env`. El form
  pierde valor.
- `@nestjs/schedule` 6.1.1 soporta `SchedulerRegistry.deleteJob` +
  `addCronJob` en runtime.
- Pequeño wrapper en `SettingsService` que al guardar re-registra
  el job.
- **Nota**: esto contradice affiliate Q-005 (restart). Diferencia:
  affiliate tiene jobs con estado (runs en progreso), upload-post
  reporte semanal es stateless. Dinámico es seguro aquí.

### Q-009 — Validación de firma del webhook → ✅ DECIDIDO (bloqueante seguridad)
**Decisión**: implementar `verifySignature(secret, body, header)` en `WebhooksService`. Si no hay secreto, rechazar 403.

**Razón técnica**:
- `POST /upload-post/webhooks/incoming` es público. Sin validación,
  cualquier puede inyectar status falsos.
- Es riesgo de seguridad crítico (R-09).
- **Acción**: investigar `docs.upload-post.com` para identificar
  header de firma (HMAC, `X-Webhook-Signature`, sha256 del body).
  Si no se encuentra, asumir HMAC estándar.

### Q-010 — GaugeChartCard en upload-post → ✅ DECIDIDO
**Decisión**: sí — "storage usado vs cuota" (% del límite mensual acumulado).

**Razón técnica**:
- Suma 1 consumer al catálogo (R-01 del PRD base pide ≥2). Ya tiene
  content-pipeline y stripe.
- "Storage usado vs cuota" es un gauge natural.
- Si no se usa, el gauge se valida con stripe/content-pipeline.

---

## Addendum al PRD base: componentes nuevos detectados

Durante la revisión de los 9 PRDs, se detectaron **4 componentes
adicionales** que merecen entrar al catálogo base:

| FR nuevo | Componente | Origen | Consumers |
|---|---|---|---|
| FR-012 | `StatusBadge` | affiliate Q-009, cms-audit Q-009 | affiliate, cms-audit, crm, stripe, content-pipeline, upload-post |
| FR-013 | `CopyableField` | affiliate Q-009 | affiliate, upload-post, crm |
| FR-014 | `FunnelChartCard` | crm Q-009 | crm, affiliate, content-pipeline |
| FR-015 | `NumericStepper` | revisión usuario | CronScheduleEditor, content-pipeline, upload-post |

**Acción**: añadir estos 4 FR al `03-requirements.md` del PRD
base-ui-components. Catálogo base pasa de 11 a **15 componentes**.

---

## Resumen ejecutivo

| Categoría | Cantidad |
|---|---|
| ✅ DECIDIDO | 55 |
| 🟡 POSTERGADO | 18 |
| ⚠️ ASK FIRST (al usuario) | 0 |
| 🚫 DESCARTADO | 10 |

### ✅ RESPUESTAS DEL USUARIO — RESUELTAS

| PRD | Q | Pregunta | Respuesta | Decisión |
|---|---|---|---|---|
| cms | Q-04 | ¿Fuente de analytics? | Extensión `analytics` interna | FR de views consulta `extensions/analytics/` (VisitorLineChart, SourceBarChart, ConversionGauge ya usan ECharts). NO omitir views — integrar con analytics extension. |
| crm | Q-008 | ¿`CrmProjectEntity.price` es MRR o total? | Valor total del proyecto | MRR = `SUM(price) / meses_duracion` donde `meses = (endDate - startDate) / 30`. Proyectos sin endDate se excluyen del MRR. Confirmado por codebase: entidad tiene `startDate` + `endDate` + `price` decimal. |
| upload-post | Q-002 | ¿API Upload-Post soporta recurring nativo? | **NO** soporta recurring | Backend Foundation expande `cron + untilDate` en N `scheduled_date` puntuales. API soporta `scheduled_date` puntual (≤365 días) + queue system (slots). Limitación: editar cron recrea jobs. |
| upload-post | Q-009 | ¿Webhook firma (HMAC, header)? | **NO firma** — solo HTTPS | API no envía HMAC ni `X-Webhook-Signature`. Verificación alternativa: (a) IP allowlist de Upload-Post, (b) soft-auth por `job_id` contra DB local, (c) aceptar sin verificación (riesgo). Recomendación: (a) + (b) combinadas. |

### Dep nuevas a aprobar

| Dep | Justificación | Riesgo |
|---|---|---|
| `cron-parser` (front + back) | Validar cron + preview human-readable | Bajo, lib estándar |
| `cronstrue` (front) | Humanizar cron | Bajo, lib estándar |
| `@nestjs/cache-manager` (back) | Cache operationalDashboard 60s | Bajo, lib oficial NestJS |

---

## Siguiente paso

1. ✅ Open questions resueltas (incluye respuestas del usuario + hallazgos Upload-Post API)
2. ✅ Catálogo base actualizado a 15 componentes (FR-012/013/014/015 añadidos)
3. Alimentar cada PRD a `/sdd-new <extension>` → `sdd-explore` → `sdd-propose`
4. Empezar por `base-ui-components` (es dependencia de todos)
5. Orden sugerido: base-ui → cms → stripe → content-pipeline → upload-post → autonomous-agent → affiliate → crm → cms-audit

---

## Addendum: Hallazgos de la API Upload-Post

Investigación completa de `https://docs.upload-post.com/llm.txt` (7661 líneas).

### Scheduling
- **scheduled_date puntual**: SÍ (ISO-8601, ≤365 días futuro, con `timezone` IANA)
- **Queue system**: alternativa con slots predefinidos (default 9am/12pm/5pm ET)
- **Recurring nativo**: NO. Backend Foundation debe expandir cron en N scheduled_date puntuales
- **Edición de scheduled**: PATCH `/api/uploadposts/schedule/<job_id>` (cambia fecha, NO platforms/media)

### Webhooks
- **Eventos**: `upload_completed`, `social_account_connected/disconnected`, `social_account_reauth_required`
- **Firma**: NO hay HMAC ni header de firma. Solo HTTPS. Soft-auth obligatorio (IP allowlist + job_id dedupe)
- **Idempotencia**: usar `publish_id` o `job_id` para dedupe (posibles duplicados)
- **Config**: `POST /api/uploadposts/users/notifications` (webhook URL + eventos habilitados)

### Upload endpoints (multi-plataforma nativo vía `platform[]`)
- `POST /api/upload` — video (13 plataformas)
- `POST /api/upload_photos` — fotos + mixed carousels (11 plataformas, sin YouTube)
- `POST /api/upload_text` — texto (9 plataformas, sin IG/TikTok/YT/Pinterest)
- `POST /api/upload` (document) — PDF/PPT/DOCX solo LinkedIn
- `async_upload=true` recomendado siempre
- `Idempotency-Key` header para dedupe

### Plataformas soportadas (13)
linkedin, tiktok, instagram, pinterest, youtube, facebook, x, threads, reddit, bluesky, discord, telegram, google_business

### Rate limits diarios (por social account, rolling 24h)
| Plataforma | Max posts/24h |
|---|---|
| Instagram | 50 |
| TikTok | 15 |
| LinkedIn | 150 |
| YouTube | 10 |
| Facebook | 25 |
| X | 50 |
| Threads | 50 |
| Pinterest | 20 |
| Reddit | 40 |
| Bluesky | 50 |

### Parámetros platform-specific clave
- Facebook: `facebook_page_id` (requerido)
- LinkedIn: `target_linkedin_page_id`, `visibility`
- Pinterest: `pinterest_board_id` (requerido para pins)
- Google Business: `gbp_location_id`, `gbp_cta_type`
- TikTok: `privacy_level`, `post_mode`, `is_aigc`
- Instagram: `media_type` (REELS/STORIES), `share_mode`
- YouTube: `youtube_title` (requerido)

### Auth
`Authorization: Apikey <token>`

### Implicaciones para el PRD upload-post
1. Q-001 (cola Bull): confirmado SÍ — `@nestjs/bullmq` ya instalado, API es async
2. Q-002 (recurring): backend expande cron en N scheduled_date
3. Q-003 (cron-parser): sí, validar antes de expandir
4. Q-006 (límites archivo): ver photo/video requirements docs
5. Q-009 (webhook firma): soft-auth obligatorio (IP + job_id)
6. Rate limits diarios por plataforma — el cronjob de expansión debe respetarlos