# Validación de Skills

Guía para verificar que una skill está correctamente estructurada.

## Verificaciones Obligatorias

### 1. SKILL.md existe

```
skill-name/
└── SKILL.md    # ← Debe existir
```

### 2. Nombre coincide con directorio

```yaml
# Directorio: .opencode/skills/my-skill/
---
name: my-skill # ← Debe coincidir exactamente
---
```

### 3. Frontmatter YAML válido

```yaml
---
name: skill-name
description: |-
  Contenido...
---
```

### 4. Campo `name` válido

- 1-64 caracteres
- Solo minúsculas, números y guiones simples
- Sin guiones al inicio/final
- Sin guiones consecutivos
- Coincide con nombre del directorio

**Pattern:** `^[a-z0-9]+(-[a-z0-9]+)*$`

### 5. Campo `description` válido

- 1-1024 caracteres
- Usa `|-` literal block scalar para multi-línea
- Empieza con verbo de acción (no "You are" ni "Role expert")
- Incluye 3-5 ejemplos concretos

## Checklist Rápido

```markdown
- [ ] SKILL.md existe
- [ ] name coincide con directorio
- [ ] YAML frontmatter tiene --- al inicio y fin
- [ ] name: 1-64 chars, lowercase-hyphen
- [ ] description: 1-1024 chars, usa |-
- [ ] description empieza con verbo
- [ ] description tiene ejemplos user → action
```

## Errores Comunes

| Error                           | Causa                                     | Solución                               |
| ------------------------------- | ----------------------------------------- | -------------------------------------- | ------------------ | ---------- |
| `name does not match directory` | Nombre en frontmatter diferente al folder | Renombrar para que coincidan           |
| YAML parsing error              | Usar `:` sin `                            | -` en multi-línea                      | Usar `description: | -\n texto` |
| Empty frontmatter               | Falta segundo `---`                       | Agregar `---` al final del frontmatter |
| Description too long            | >1024 caracteres                          | Acortar descripción                    |

## Validación Manual

1. **Abrir SKILL.md** y verificar frontmatter
2. **Comparar** `name:` con nombre del directorio
3. **Validar YAML**: copiar frontmatter y pegar en yaml checker
4. **Contar caracteres** de description (max 1024)
5. **Verificar** que description tenga ejemplos

## Ejemplo Válido

```yaml
---
name: api-doc-generator
description: |-
  Generate API documentation from OpenAPI specs. Use for creating markdown docs,
  README updates, and API reference pages. Use proactively when users mention
  "API docs", "OpenAPI", "generate documentation", or "update README".

  Examples:
  - user: "Generate docs for our API" → parse OpenAPI and create markdown
  - user: "Update API reference" → regenerate from updated spec
  - user: "Create OpenAPI from code" → analyze code and produce spec
---
```
