---
name: nestjs-best-practices
description: NestJS best practices and architecture patterns for building production-ready applications. This skill should be used when writing, reviewing, or refactoring NestJS code to ensure proper patterns for modules, dependency injection, security, and performance.
license: MIT
metadata:
  author: Kadajett
  version: "1.1.0"
---
# NestJS Best Practices

Trigger: escribir/revisar/refactorizar módulos NestJS. Contiene 40 reglas en 10 categorías priorizadas.

## Categorías por Prioridad

| Prio | Categoría | Impacto | Prefix |
|------|-----------|---------|--------|
| 1 | Architecture | CRITICAL | `arch-` |
| 2 | Dependency Injection | CRITICAL | `di-` |
| 3 | Error Handling | HIGH | `error-` |
| 4 | Security | HIGH | `security-` |
| 5 | Performance | HIGH | `perf-` |
| 6 | Testing | MEDIUM-HIGH | `test-` |
| 7 | Database & ORM | MEDIUM-HIGH | `db-` |
| 8 | API Design | MEDIUM | `api-` |
| 9 | Microservices | MEDIUM | `micro-` |
| 10 | DevOps & Deployment | LOW-MEDIUM | `devops-` |

## Cómo Usar

1. Identificar categoría según lo que estás haciendo
2. Buscar regla específica en el documento completo
3. Aplicar patrón correcto

Reglas individuales en `rules/` — ej: `rules/arch-avoid-circular-deps.md`

## Documento Completo

Todas las reglas expandidas con ejemplos incorrectos/correctos:
`AGENTS.md` (en este mismo directorio)
