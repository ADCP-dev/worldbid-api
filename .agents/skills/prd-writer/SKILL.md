---
name: prd-writer
description: "Writes high-quality PRDs (Product Requirements Documents) optimized for AI coding agents. Uses EARS notation, multi-file structure, explicit open questions, Definition of Done. Trigger: when user asks to write a PRD, create product requirements, document a feature before implementation, or says /prd-new, /prd-review, /prd-update."
---

# Skill: prd-writer

Write PRDs that AI coding agents can consume to implement features with precision.
PRD describes **QUÉ** and **POR QUÉ**, not **CÓMO**. The AI decides implementation with its skills.

This skill is compatible with and complementary to the `prd-writer` opencode agent at
`~/.config/opencode/prompts/prd-writer.md`. It contains the same actionable rules, adapted
to the Agent Skills format so any agent that loads it can write PRDs of quality.

---

## Propósito

Escribir PRDs que agentes de IA pueden consumir para programar con precisión.
Sin adivinar, sin sobre-especificar, sin inventar.

**Filosofía**: CONCEPTOS > CÓDIGO. El PRD describe QUÉ y POR QUÉ. La IA decide CÓMO con sus skills.

---

## Triggers

Cargar esta skill cuando el usuario:

- Pide escribir / crear / actualizar un PRD
- Pide documentar una feature antes de implementarla
- Ejecuta `/prd-new <slug>`, `/prd-review <slug>`, `/prd-update <slug>`
- Pide "requisitos de producto", "especificación de feature", "documentar cambio antes de codear"

---

## Workflow (7 fases)

### 1. Discovery

Pregunta al usuario (NO asumas):

- ¿Qué feature/sistema se documenta?
- Contexto: ¿feature nueva? ¿refactor? ¿integración? ¿migración?
- Scope: ¿qué módulos/extensiones se ven afectados?
- Stakeholders/owner (si se conocen)

### 2. Research

- Explora codebase relevante.
  - Si es grande (>4 archivos o módulo completo) → delegar a sub-agente (explore).
  - Si es puntual (1-3 archivos) → leer directamente.
- Investigar mejores prácticas externas SOLO si el tema lo requiere.
  - Orden: Context7 (free) → Tavily (credits, máx 3 queries).
  - Guardar hallazgos en `docs/research/<slug>--<topic>.md` con YAML frontmatter si son extensos.
- Identificar archivos/paths afectados para mencionarlos concretos en el PRD.

### 3. Structure decision

Decidir single-file vs multi-file:

- **Single-file**: features chicas (<5 secciones complejas). Archivo `docs/prds/<slug>.md`.
- **Multi-file**: features grandes (migraciones, arquitectura, sistemas completos).
  Estructura: `docs/prds/<slug>/00-index.md` + archivos numerados por sección.

### 4. Drafting

Escribir el PRD siguiendo la estructura canónica (ver abajo). Usar EARS notation.
Marcar `[NEEDS CLARIFICATION]`. Numerar FR-NNN / NFR-NNN. YAML frontmatter al inicio de cada archivo.

### 5. Review

Releer el PRD desde la perspectiva de una IA que va a programarlo. Preguntarse:

- ¿Tengo TODO el contexto necesario?
- ¿Los requisitos son suficientes y no ambiguos?
- ¿El Definition of Done es claro y objetivo?
- ¿Los trade-offs están decididos (no abiertos)?
- ¿Los constraints son explícitos (Always / Ask first / Never)?

### 6. Open questions

Listar todas las decisiones pendientes que requieren input del usuario/equipo.
Marcar impacto: bloqueante / no-bloqueante. Opcional: recomendación del agente.

### 7. Entrega

Reportar:

- Archivos creados (paths)
- Open questions detectadas
- Supuestos asumidos (asumido X porque Y)
- Siguiente paso recomendado (normalmente: alimentar el PRD a `sdd-explore` / `sdd-propose`)

---

## Estructura canónica del PRD

Cada PRD debe contener estas secciones (adaptar al scope, pero justificar si se omite alguna):

```
docs/prds/<slug>/                        # o docs/prds/<slug>.md si single-file
├── 00-index.md          # solo si multi-file
├── 01-overview.md
├── 02-architecture.md
├── 03-requirements.md
├── 04-context.md
├── 05-risks-and-tradeoffs.md
├── 06-migration-phases.md   # solo si migración/refactor
├── 07-open-questions.md
└── 08-definition-of-done.md
```

### 00-index.md (solo multi-file)
- Tabla de contenidos
- Estado del PRD (draft | review | approved)
- Owner
- Fecha creación / última actualización

### 01-overview.md
- Título
- Resumen ejecutivo (3-5 líneas)
- Problema / motivación (por qué se hace)
- Objetivos (medibles, con criterios de éxito)
- No-objetivos (explícitamente fuera de scope)
- Métricas de éxito / KPIs

### 02-architecture.md
- Arquitectura actual (si aplica)
- Arquitectura propuesta (diagramas ASCII o Mermaid)
- Flujo de datos
- Componentes afectados
- Decisiones técnicas con trade-offs (decisión + razones + alternativas descartadas)

### 03-requirements.md
- Requisitos funcionales (FR-NNN) con notación EARS:

  ```
  FR-NNN: [nombre]
    WHEN <trigger> THE SYSTEM SHALL <response>
    IF <condition> THEN THE SYSTEM SHALL <response>
    WHILE <state> THE SYSTEM SHALL <response>
    THE SYSTEM SHALL <capability>          # always active
  ```

- Requisitos no funcionales (NFR-NNN): performance, security, accessibility, i18n, etc.
- Criterios de aceptación por requisito (Given/When/Then opcional para los complejos)

### 04-context.md
- Stack actual
- Convenciones del proyecto (aliases, naming, estructura)
- Dependencias (librerías, módulos, APIs externas)
- Constraints (three-tier: ✅ Always / ⚠️ Ask first / 🚫 Never)
- Supuestos asumidos (asumido X porque Y)

### 05-risks-and-tradeoffs.md
- Riesgos técnicos con mitigación
- Riesgos de seguridad
- Riesgos de performance
- Trade-offs (decisión tomada, qué se sacrifica, qué se gana, por qué)

### 06-migration-phases.md (solo migración/refactor)
- Fases incrementales
- Cada fase: objetivo, entregables, criterios de salida, riesgos
- Estrategia de rollback

### 07-open-questions.md
- Lista de Q-NNN con descripción
- Impacto si no se resuelve (bloqueante / no-bloqueante)
- Recomendación del agente (opcional)

### 08-definition-of-done.md
- Criterios objetivos para considerar la feature completa
- Tests necesarios (unit, integration, e2e)
- Documentación necesaria
- Linting / type-check passing
- Otros gates (deploy, review, etc.)

---

## EARS notation

Notación EARS para requisitos funcionales (reduce ambigüedad vía restricción sintáctica):

- `WHEN <trigger> THE SYSTEM SHALL <response>` — event-driven
- `IF <condition> THEN THE SYSTEM SHALL <response>` — conditional
- `WHILE <state> THE SYSTEM SHALL <response>` — state-driven
- `THE SYSTEM SHALL <capability>` — always active

---

## Three-tier boundaries (constraints)

Toda constraint se clasifica en uno de tres tiers:

- ✅ **Always** — siempre aplicable, no requiere confirmación
- ⚠️ **Ask first** — preguntar antes de hacer
- 🚫 **Never** — prohibido

---

## Numbering

- `FR-NNN` — requisitos funcionales
- `NFR-NNN` — requisitos no funcionales
- `Q-NNN` — open questions

Referencias estables. Aceptance criteria y DoD referencian por número.

---

## Reglas de escritura

- **Idioma**: español, tuteo neutral (NUNCA voseo rioplatense: no "podés/tenés/decidís/contás").
  Si el input del usuario es inglés, el PRD se escribe en inglés.
- **Tono**: técnico, directo, sin fluff. Documentación de arquitectura seria.
- **YAML frontmatter** al inicio de cada archivo:

  ```yaml
  ---
  doc: <slug>/<nombre-archivo>
  title: "<Título>"
  status: draft
  created: YYYY-MM-DD
  ---
  ```

- **Diagramas**: ASCII o Mermaid cuando aporten claridad.
- **Tablas**: Markdown para comparaciones.
- **Listas**: para enumeraciones.
- **MÁXIMO 200 líneas por archivo.** Si excede, dividir.
- **NO escribir código de implementación.** Esto es PRD, no código.
- **NO sobre-especificar implementación.** Describir QUÉ y POR QUÉ, no CÓMO.
- **NO inventar detalles técnicos.** Si no se sabe → `[NEEDS CLARIFICATION]`.
- **Verificar contexto del codebase** antes de escribir (leer archivos relevantes o delegar a explore).
- **Si el PRD toca código existente**, mencionar archivos/paths concretos afectados.

---

## Anti-patterns a evitar

- Vague prompts ("hazlo mejor")
- Monolithic prompt / curse of instructions (todo mezclado en un prompt gigante)
- Sin `[NEEDS CLARIFICATION]` (la IA adivina y erra)
- Sobre-especificar implementación (micro-manejar código)
- Sin numbering (referencias rotas)
- Sin contexto arquitectural (la IA reinventa la rueda)
- Sin Definition of Done (la IA no sabe cuándo parar)
- Reabrir trade-offs ya decididos dentro del PRD

---

## Integración con SDD

El PRD es **INPUT** para `sdd-explore` y `sdd-propose`. NO reemplaza el spec SDD.
Es el documento de requisitos de alto nivel que alimenta el proceso SDD.

Flujo:

```
prd-writer (PRD) → sdd-explore → sdd-propose → sdd-spec → sdd-design → sdd-tasks → sdd-apply → sdd-verify → sdd-archive
```

---

## Meta-comandos

Invocables por el usuario:

- `/prd-new <slug>` — crea PRD nuevo. Pregunta contexto, explora codebase, escribe.
- `/prd-review <slug>` — revisa PRD existente desde perspectiva de IA que programa. Sugiere mejoras.
- `/prd-update <slug>` — actualiza PRD existente (contexto cambió o open question resuelta).

---

## Output format

Siempre cerrar la sesión reportando:

1. **status**: `success` | `partial` | `failed`
2. **Archivos creados** (paths)
3. **Open questions detectadas** (lista Q-NNN)
4. **Supuestos asumidos** (asumido X porque Y)
5. **Siguiente paso recomendado** (ej: alimentar el PRD a `sdd-explore` / `sdd-propose`)