---
doc: base-ui-components/05-risks-and-tradeoffs
title: "Risks & Trade-offs"
status: draft
created: 2026-07-07
---

# 05 — Risks & Trade-offs

## Riesgos técnicos

### R-01: Over-engineering de componentes que solo usa 1 extensión

**Riesgo**: `KeyValueEditor` podría usarlo solo `content-pipeline` y
`FieldRelation` solo `affiliate`. Si la adopción es baja, el costo de
mantener 14 componentes supera el beneficio.

**Mitigación**:
- Validar en `08-definition-of-done.md` que al menos 1 extensión consuma
  cada componente antes de cerrar el PRD.
- Marcar componentes con adopción < 2 como "experimental" en la demo y
  revisar tras 2 sprints. Si no suman adopción, mover a `labs/` o
  eliminar.
- Priorizar implementación de componentes con ≥3 consumidores (ver
  matriz en `02-architecture.md`).

### R-02: Componentes demasiado genéricos vs demasiado específicos

**Riesgo**: `StatCard` demasiado genérico no cubre casos como
"KPI con sparkline mini" (stripe MRR + tendencia). `CronScheduleEditor`
demasiado específico solo cubre 4 modos y no soporta cron avanzado
(`0 9 1-15 * 1-5`).

**Mitigación**:
- `StatCard` acepta slot `footer` para composición (FR-042) sin
  acoplar variantes.
- `CronScheduleEditor` tiene modo avanzado (FR-005) que cae a
  `FormInput` crudo — escape hatch para casos no cubiertos.
- Documentar en la demo qué NO cubre cada componente (límites
  explícitos).

### R-03: Bundle size por echarts

**Riesgo**: echarts es ~1MB sin tree-shaking. Si todos los dashboards
cargan todos los charts, el bundle inicial crece.

**Mitigación**:
- NFR-002 obliga a lazy-import `vue-echarts` dentro de cada chart.
- Los charts se renderizan solo cuando el tab del dashboard está activo
  (mecanismo existente en `pages/app/index.vue`).
- Evaluar `echarts/core` + imports selectivos (tree-shakeable) en
  SDD-apply — opción a explorar.

### R-04: Timezone handling mal entendido

**Riesgo**: `CronScheduleEditor` con `timezone: 'user'` guarda el cron
en timezone del navegador, pero `@Cron` backend usa UTC por defecto.
Si el usuario edita "lunes 09:00 Madrid" y backend ejecuta en UTC, corre
a las 07:00 UTC = 09:00 Madrid solo en invierno (CET), no en verano
(CEST = 07:00 → 09:00 CEST es 07:00 UTC). Inconsistencia.

**Mitigación**:
- FR-008 muestra nota con offset detectado.
- Q-003 debe resolverse antes de implementar — decidir si el componente
  convierte a UTC antes de emitir o el backend recibe tz + convierte.
- Mientras tanto, el componente NO convierte — emite en la tz elegida y
  documenta el comportamiento.

### R-05: Accesibilidad incompleta en charts

**Riesgo**: `echarts` no es totalmente accesible (sin ARIA en SVG
generado, sin descripciones para screen readers). `LineChart` y
company heredan esa limitación.

**Mitigación**:
- NFR-010 cubre componentes interactivos, no charts.
- Para charts, proveer `altText` prop opcional con descripción textual
  del dataset (añadir a FR-051/061/071 en revisión del PRD).
- Tabla HTML alternativa como slot `fallback` para casos que requieran
  accesibilidad total. [NEEDS CLARIFICATION] — ver Q-005.

## Riesgos de producto

### R-06: Adopción baja por las extensiones

**Riesgo**: aunque los PRD de extensión referencien los componentes, los
equipos pueden preferir su markup DaisyUI conocido.

**Mitigación**:
- KPI "Extensiones que consumen al menos 1 componente nuevo = 8/8".
- DoD exige validación real (al menos 1 extensión consumiendo cada
  componente).
- Las demos en `pages/app/components/` sirven como referencia
  ejecutable.

### R-07: Scope creep — componentes adicionales pedidos en SDD-apply

**Riesgo**: al implementar, las extensiones pidan componentes no
catalogados (Modal, Tabs, Breadcrumb, Pagination standalone, Dropdown
menu, Command palette, Color picker, Stepper, Progress bar, Skeleton,
Tree view, Slider, OTP, Accordion). El PRD se infla.

**Mitigación**:
- Scope explícito: 14 componentes. Fuera de scope, PRD separado.
- `01-overview.md` no-objetivos deja claro que esto no es "todos los
  componentes base faltantes", solo los necesarios para scheduling,
  dashboards y automation forms.
- Otros gaps (Modal, Tabs, Breadcrumb, etc.) se documentan en
  `07-open-questions.md` como candidatos a PRD posterior, no como
  entregables de este.

## Trade-offs

### T-01: echarts wrapper vs custom SVG

| Aspecto | Wrapper echarts | Custom SVG |
|---------|----------------|------------|
| Dependencias | Usa `echarts` ya presente | Cero deps nuevas |
| Bundle | ~1MB sin tree-shake, lazy mitigable | ~10KB por chart |
| Mantenimiento | echo por echarts team | nosotros mantenemos |
| Features | tooltips, zoom, animaciones listas | hay que construir |
| Accesibilidad | limitada (R-05) | control total (más costoso) |
| Tiempo implementación | bajo (wrapper) | alto (3-4x) |

**Decisión**: D-01 — wrapper echarts. Reabrir solo si Q-001 decide
preferir custom SVG para casos simples.

### T-02: CronScheduleEditor UI-only vs UI + cron crudo

| Aspecto | UI-only | UI + modo avanzado (D-02) |
|---------|---------|---------------------------|
| Curva aprendizaje | cero (no cron) | power-users felices |
| Cobertura casos | 4 modos, límite | total (escape hatch) |
| Riesgo syntax error | nulo | regex valida |
| Complejidad implementación | baja | media |

**Decisión**: D-02 — UI + modo avanzado. Mejor trade-off.

### T-03: JsonSchemaEditor con Zod vs JSON Schema estándar

| Aspecto | Zod-driven | JSON Schema estándar |
|---------|------------|----------------------|
| Consistencia con stack | zod ya en package.json | nueva dependencia |
| Tipado TS | inferido de Zod | necesita codegen |
| Validación | `safeParse` ya usado en forms | necesita ajv/io-ts |
| Curva | equipo conoce Zod | spec nueva |
| Anidados/arrays | nativo en Zod | nativo en JSON Schema |

**Decisión**: Zod-driven. Aprovecha el stack existente y el patrón de
forms con `safeParse` ya establecido (skill frontend). No añade deps.

### T-04: Centralizar `cronToHuman` vs inline por componente

| Aspecto | Util `lib/cronToHuman.ts` | Inline en CronScheduleEditor |
|---------|--------------------------|------------------------------|
| Reutilización | backend puede llamarla via shared | acoplado al componente |
| Testabilidad | unit test aislado | testing E2E solo |
| Tamaño | 1 archivo extra | mezclado con UI |

**Decisión**: Util separado `lib/cronToHuman.ts`. Permite testing
unitario directo y eventual porteo a backend si se quiere validar
preview server-side (Q-006).