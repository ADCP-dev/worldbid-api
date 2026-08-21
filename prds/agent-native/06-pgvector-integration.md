---
doc: agent-native/06-pgvector-integration
title: "pgvector en Spec Engine"
status: draft
created: 2026-08-19
priority: P2
---

# PRD 06 — pgvector Integration en Spec Engine

## Objetivo

Añadir soporte para vector search en el spec engine usando pgvector. Permite features de IA (búsqueda semántica en CRM, RAG sobre base de conocimiento, recomendaciones) sin añadir servicios externos.

## Diseño

### Nuevo field type: `vector`

En `spec.types.ts`:

```typescript
export type FieldType =
  | 'string' | 'text' | 'integer' | 'decimal' | 'boolean'
  | 'datetime' | 'date' | 'json' | 'enum' | 'ref' | 'file'
  | 'computed' | 'many-to-many' | 'password' | 'secret'
  | 'vector';  // ← NUEVO

export interface VectorFieldSpec {
  name: string;
  type: 'vector';
  dimensions: number;          // ej: 1536 para OpenAI text-embedding-3-small
  index?: boolean;
  indexType?: 'hnsw' | 'ivfflat';  // default: hnsw
  indexParams?: {
    m?: number;                // hnsw: connections per layer (default 16)
    efConstruction?: number;   // hnsw: build-time search width (default 64)
    lists?: number;            // ivfflat: number of clusters
  };
  nullable?: boolean;
  autoEmbed?: AutoEmbedSpec;   // si se generan embeddings automáticamente
}

export interface AutoEmbedSpec {
  source: string;              // campo del que se genera el embedding: "description"
  model: string;               // "text-embedding-3-small" | "text-embedding-ada-002"
  provider: 'openai' | 'ollama' | 'local';
  // El hook afterCreate/afterUpdate genera el embedding automáticamente
}
```

### Spec YAML

```yaml
resources:
  - name: kb-article
    table: ext_cms_kb_article
    fields:
      - name: title
        type: string
        required: true
      - name: content
        type: text
        required: true
      - name: embedding
        type: vector
        dimensions: 1536
        index: true
        indexType: hnsw
        autoEmbed:
          source: content
          model: text-embedding-3-small
          provider: openai
```

### EntityFactory: columna vector

TypeORM no tiene un tipo `vector` nativo. Hay dos opciones:

**Opción 1 (recomendada): raw SQL column type**

Usar `columnType: 'vector(1536)'` como string raw. TypeORM lo pasa a Postgres sin validarlo. Funciona porque TypeORM no valida tipos custom — los pasa directamente al driver.

```typescript
// entity-factory.ts (extender)
private buildVectorColumn(field: VectorFieldSpec): ColumnMetadata {
  return {
    name: field.name,
    type: 'vector',                              // type interno para TypeORM metadata
    columnType: `vector(${field.dimensions})`,   // type raw para DDL
    transformer: {
      // JS array → string pgvector '[1,2,3]'
      to: (value: number[] | null) => {
        if (value === null) return null;
        return `[${value.join(',')}]`;
      },
      // string pgvector '[1,2,3]' → JS array [1,2,3]
      from: (value: string | null) => {
        if (value === null) return null;
        return value.slice(1, -1).split(',').map(Number);
      },
    },
    nullable: field.nullable ?? true,
  };
}
```

**Opción 2: column type como `string` con type override**

Si TypeORM rechaza `type: 'vector'`, usar `type: 'text'` y overrides:

```typescript
{
  name: field.name,
  type: 'text' as ColumnType,              // TypeORM accepts
  columnType: `vector(${field.dimensions})`,  // DDL override
  transformer: { to: ..., from: ... },
}
```

La opción 1 es preferible porque es más explícita. TypeORM 0.3.x permite tipos custom como strings.

### Query: similarity search

El operador `<=>` (cosine distance) no es reconocido por TypeORM QueryBuilder. Se usa SQL raw dentro del queryBuilder:

```typescript
const results = await ctx.repo
  .createQueryBuilder('article')
  .addSelect(`1 - (article.embedding <=> vector(:embedding))`, 'similarity')
  .where(`article.embedding IS NOT NULL`)
  .orderBy(`article.embedding <=> vector(:embedding)`)
  .limit(input.limit || 5)
  // pgvector acepta el string '[1,2,3]' con la función vector()
  .setParameter('embedding', `[${embedding.join(',')}]`)
  .getRawAndEntities();
```

Nota: usar `getRawAndEntities()` en lugar de `getMany()` porque `similarity` es una columna computed que `getMany()` no devuelve.

### autoEmbed: hooks generados en runtime

El PRD original proponía escribir hooks en `__generated__/`. Eso es frágil (archivos temporales, path resolution, require()). Mejor: el HookExecutor detecta `autoEmbed` en el spec y ejecuta la lógica inline, sin archivos generados.

```typescript
// hook-executor.ts (extender)
async executeAfterCreate(resource: ResourceSpec, entity: any, ctx: HookContext) {
  // 1. Ejecutar hooks declarados manualmente en spec
  if (resource.hooks?.afterCreate) {
    await this.runHandler(resource.hooks.afterCreate, entity, ctx);
  }

  // 2. Ejecutar auto-embed si está declarado
  const vectorField = resource.fields.find(f => f.type === 'vector' && f.autoEmbed);
  if (vectorField?.autoEmbed) {
    const sourceValue = entity[vectorField.autoEmbed.source];
    if (sourceValue) {
      try {
        const embedding = await ctx.embed(
          sourceValue,
          vectorField.autoEmbed.model,
          vectorField.autoEmbed.provider,
        );
        await ctx.repo.update(entity.id, { [vectorField.name]: embedding });
      } catch (err) {
        // No fallar el create si el embed falla — log + reintentar async
        ctx.logger.warn(`autoEmbed failed for ${resource.name}:${entity.id}: ${err.message}`);
        // Encolar reintentar en BullMQ
        await ctx.queue.add('embed-retry', {
          resourceId: entity.id,
          resource: resource.name,
          field: vectorField.name,
          source: vectorField.autoEmbed.source,
        }, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } });
      }
    }
  }
}
```

Igual para `executeAfterUpdate` — pero solo re-embebe si el campo source cambió:

```typescript
async executeAfterUpdate(resource: ResourceSpec, entity: any, ctx: HookContext, changes?: Record<string, unknown>) {
  // hooks manuales
  if (resource.hooks?.afterUpdate) {
    await this.runHandler(resource.hooks.afterUpdate, entity, ctx);
  }

  // auto-embed: solo si el source field cambió
  const vectorField = resource.fields.find(f => f.type === 'vector' && f.autoEmbed);
  if (vectorField?.autoEmbed && changes && vectorField.autoEmbed.source in changes) {
    // source field cambió → re-calcular embedding
    const sourceValue = entity[vectorField.autoEmbed.source];
    if (sourceValue) {
      const embedding = await ctx.embed(sourceValue, vectorField.autoEmbed.model, vectorField.autoEmbed.provider);
      await ctx.repo.update(entity.id, { [vectorField.name]: embedding });
    }
  }
}
```

Sin archivos `__generated__`. La lógica vive en el HookExecutor, que ya existe.

### HookContext: embed service

Extender `HookContext` (en `hook-context.ts`) con embed service y queue para retries:

```typescript
export interface HookContext {
  // ... existente ...
  embed: (text: string, model: string, provider?: string) => Promise<number[]>;
  queue?: { add: (name: string, data: unknown, opts?: unknown) => Promise<void> }; // opcional, para retry async
}
```

Nota: `ctx.queue` es opcional. Si no está disponible (ej: tests), el catch block del auto-embed solo loguea el error sin encolar retry. La lógica de retry vive en el HookExecutor, no en el HookContext.

### Migration generator

El `migration-generator.ts` debe generar SQL para:

1. `CREATE EXTENSION IF NOT EXISTS vector` (solo si hay campos vector en el spec — se ejecuta una vez)
2. `ALTER TABLE ... ADD COLUMN embedding vector(N)` para cada campo vector
3. `CREATE INDEX ... USING hnsw (embedding vector_cosine_ops) WITH (...)` si `index: true`

```sql
-- Ejemplo generado para kb-article con embedding vector(1536)
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE ext_cms_kb_article ADD COLUMN embedding vector(1536);

CREATE INDEX idx_kb_article_embedding ON ext_cms_kb_article
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

El migration generator detecta campos `type: vector` en el spec y genera estas statements. `CREATE EXTENSION` se incluye solo una vez por database (es idempotente con `IF NOT EXISTS`).

El `EmbedService` usa el Model Gateway (si PRD de model gateway existe) o LangChain directamente:

```typescript
// core/spec-engine/embed-service.ts
@Injectable()
export class EmbedService {
  constructor(private configService: ConfigService) {}

  async embed(text: string, model: string, provider?: string): Promise<number[]> {
    switch (provider || this.configService.get('EMBED_PROVIDER')) {
      case 'openai':
        return this.embedOpenAI(text, model);
      case 'ollama':
        return this.embedOllama(text, model);
      default:
        throw new Error(`Unknown embed provider: ${provider}`);
    }
  }

  private async embedOpenAI(text: string, model: string): Promise<number[]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.configService.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input: text, model }),
    });
    const data = await response.json();
    return data.data[0].embedding;
  }
}
```

## Criterios de aceptación

1. `type: vector` en spec YAML crea columna pgvector con dimensiones correctas
2. `index: true` crea índice HNSW o IVFFlat
3. `autoEmbed` genera hooks que calculan embeddings después de create/update
4. `ctx.embed()` disponible en handlers para generar embeddings manuales
5. Similarity search funciona con `<=>` (cosine) operator
6. El EmbedService soporta OpenAI y Ollama
7. Migration crea `CREATE EXTENSION IF NOT EXISTS vector` automáticamente
8. Entidades existentes sin vector fields no se ven afectadas

## Dependencias

- `pgvector` extensión de Postgres (instalar con `CREATE EXTENSION`)
- API key de OpenAI o Ollama local para embeddings

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| pgvector no instalado en Postgres | Migration falla con mensaje claro si extensión no existe |
| Embeddings costosos (API calls) | Batch embeddings; cachear por hash de texto |
| Vector column sin índice es lento | Forzar `index: true` con warning si se omite |
| autoEmbed falla silenciosamente | Log error + reintentar con backoff; campo queda null |