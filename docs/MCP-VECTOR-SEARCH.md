# MCP Vector Search - Semantic Code Search

## Table of Contents

- [What is it?](#what-is-it)
- [Why use it?](#why-use-it)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [CLI Commands](#cli-commands)
- [MCP Tools](#mcp-tools)
- [OpenCode Integration](#opencode-integration)
- [Usage Examples](#usage-examples)
- [Costs](#costs)
- [Engram System](#engram-system)

---

## What is it?

**MCP Vector Search** es un sistema de búsqueda semántica que permite a la IA encontrar código relevante en tu proyecto sin ejecutar comandos como `grep`, `find` o `cat`.

El sistema convierte tu código en **engrams** - representaciones vectoriales de conocimiento semántico - y las almacena en **Qdrant** (base de datos vectorial).

### Concepto de Engram

Un **engram** es una unidad de conocimiento codificada:

- Cada chunk de código → embedding de 4096 dims → **engram**
- Los engrams incluyen metadatos ricos: imports, exports, framework, keywords
- La búsqueda semántica = recuperación de engrams por similitud

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Your Project                         │
│                     ( source code )                         │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    MCP Engine (CLI)                         │
│  ┌───────────────┐    ┌──────────────┐    ┌─────────────┐  │
│  │   indexer.ts  │───▶│    Qdrant    │◀───│  server.ts  │  │
│  │ (engram index)│    │   (vectors)  │    │ (MCP server)│  │
│  └───────────────┘    └──────────────┘    └─────────────┘  │
│           │                                      │          │
│  ┌────────┴────────┐                            │          │
│  │   parser/       │                            │          │
│  │ typescript.ts   │                            │          │
│  │ markdown.ts     │                            │          │
│  └─────────────────┘                            │          │
│           │                                      │          │
│  ┌────────┴────────┐                            │          │
│  │   search/       │                            │          │
│  │ hybrid.ts       │◀──────────────────────────┘          │
│  │ bm25.ts         │   (uses hybrid search)               │
│  └─────────────────┘                                      │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                      OpenCode                               │
│              ( AI client with tools )                       │
│                                                             │
│   Available tools:                                          │
│   • buscar_codigo     - Hybrid semantic + BM25 search       │
│   • stats_index       - Index statistics                    │
│   • necesita_reindex  - Detect outdated files               │
└─────────────────────────────────────────────────────────────┘
```

### Components

| Component         | Purpose                                         |
| ----------------- | ----------------------------------------------- |
| **Qdrant**        | Vector database (Docker)                        |
| **indexer.ts**    | Creates engrams from code                       |
| **parser/**       | Extracts metadata (imports, exports, framework) |
| **search/**       | Hybrid search (vector + BM25)                   |
| **server.ts**     | MCP server for OpenCode                         |
| **opencode.json** | MCP configuration in project                    |

### Engram Payload Structure

```typescript
interface EngramPayload {
  id: string;
  filePath: string; // Relative path
  fileName: string; // "auth.service.ts"
  lineStart: number; // 45
  lineEnd: number; // 194
  chunkIndex: number; // 0, 1, 2...
  totalChunks: number; // 3
  codeSnippet: string; // Code with header
  header: string; // "// auth.service.ts:45-194"
  language: string; // "typescript"
  imports: string[]; // ["@users/users.service", "@nestjs/config"]
  exports: string[]; // ["AuthService", "validateLogin"]
  docComment: string | null;
  framework: string | null; // "nestjs", "vue", etc.
  keywords: string[]; // Significant identifiers
}
```

---

## Engram System

### Chunking Strategy

Files are split into engrams of max 150 lines with context headers:

```
// auth.service.ts:45-194

async validateLogin(loginDto: AuthEmailLoginDto): Promise<LoginResponseDto> {
  const user = await this.usersService.findByEmail(loginDto.email);
  // ...
}
```

- Small files (≤400 lines): Single engram
- Large files: Multiple engrams of 150 lines each
- Each engram includes `fileName:lineStart-lineEnd` header

### Metadata Extraction

**TypeScript/Vue files:**

- Imports: `import { X } from '...'`
- Named exports: classes, interfaces, types, functions, const
- Framework detection: NestJS (@Injectable, @Module), Vue (defineComponent, @Component)
- Doc comments: JSDoc leading comments
- Keywords: identifiers (camelCase, PascalCase) filtered by stop words

**Markdown files:**

- Frontmatter title
- First heading
- Doc framework detection
- Keywords from headings and code blocks

### Hybrid Search

Combines vector similarity with BM25 keyword matching:

```
score = α × vector_similarity + (1-α) × normalized_BM25
```

- `α = 0.7` (default): 70% vector, 30% BM25
- Adjustable via `alpha` parameter in `buscar_codigo`

---

## Getting Started

### 1. Requirements

- Docker Desktop running
- Node.js 18+
- OpenRouter API key (free, with credits)

### 2. Configure API Key

Create `.env.local` file in the project root:

```bash
OPENROUTER_API_KEY=your_api_key_here
```

Get your API key at: https://openrouter.ai/settings/keys

### 3. Start Qdrant

```bash
cd mcp-engine
docker-compose up -d
```

Verify it's running:

```bash
curl http://localhost:6333/collections
```

### 4. Index the project

```bash
npx tsx mcp-engine/src/cli.ts index
```

This will index all `.ts`, `.vue`, `.js`, `.json`, `.md` files in the project.

**Ignored directories**: `node_modules`, `.git`, `.nuxt`, `dist`, `.turbo`, `.output`, `.data`, `mcp-engine`, `public`

---

## CLI Commands

### Index project (incremental)

```bash
npx tsx mcp-engine/src/cli.ts index
```

Creates or updates the index for the current project. **Only indexes new or modified files** - files that haven't changed since the last indexing are skipped automatically.

### Re-index from scratch

```bash
npx tsx mcp-engine/src/cli.ts index --force
```

Deletes and recreates the collection. Useful if the index is corrupted or you want a fresh start.

### Dry-run (preview)

```bash
npx tsx mcp-engine/src/cli.ts index --dry-run
```

Shows files that would be indexed without actually indexing.

### Delete index

```bash
npx tsx mcp-engine/src/cli.ts delete
```

Deletes the collection for the current project from Qdrant.

### List all collections

```bash
npx tsx mcp-engine/src/cli.ts list
```

Shows all collections in Qdrant and how many vectors each has.

### Export embeddings

```bash
npx tsx mcp-engine/src/cli.ts export
npx tsx mcp-engine/src/cli.ts export ./backup.json
```

Exports the current collection to a JSON file. Useful for backup, transfer, and cost savings.

### Import embeddings

```bash
npx tsx mcp-engine/src/cli.ts import ./backup.json
```

Imports embeddings from a JSON file. Creates a new collection with the imported data.

---

## MCP Tools

When using OpenCode with this project, you have 3 tools available:

### 1. buscar_codigo

**Purpose**: Hybrid semantic + keyword search

**Input**:

- `query`: Natural language search
- `limit`: Number of results (max 5, default 3)
- `fileTypes`: Filter by extensions (e.g., `[".ts", ".vue"]`)
- `frameworks`: Filter by framework (e.g., `["nestjs", "vue"]`)
- `minScore`: Minimum relevance score (0-1, default: 0.3)
- `alpha`: Vector weight vs BM25 weight (0-1, default: 0.7)

**Example**:

```
Find the JWT authentication logic in the project
```

**Response**:

````
📄 **apps\back\src\modules\iam\auth\auth.service.ts** auth.service.ts:45-194 [score: 94.2%]
  [exports: AuthService, validateLogin | framework: nestjs]

```typescript
async validateLogin(loginDto: AuthEmailLoginDto): Promise<LoginResponseDto> {
  const user = await this.usersService.findByEmail(loginDto.email);
  // ...
}
````

```

### 2. stats_index

**Purpose**: View index statistics

**Input**: No parameters

**Example**:
```

Is my code up to date?

```

**Response**:
```

📊 **Index Statistics**

- **Engrams totales**: 1247
- **Archivos únicos indexados**: 439
- **Archivos en proyecto**: 440
- **Última indexación**: 2026-03-11T10:30:00.000Z
- **Hybrid search**: Activo

```

### 3. necesita_reindex

**Purpose**: Detect new or modified files

**Input**: No parameters

**Example**:
```

Do I need to re-index?

```

**Response**:
```

⚠️ **Index needs updating**

- New files: 3
- Modified files: 0
- Total changes: 3

🆕 **New files** (first 5):

- src/new-service.ts
- src/new-component.vue
- ...

Run: `npx tsx mcp-engine/src/cli.ts index --force` to re-index

````

---

## OpenCode Integration

### Automatic Configuration

The project already has the `opencode.json` file configured:

```json
{
  "mcp": {
    "vectorize": {
      "type": "local",
      "command": ["npx", "tsx", "mcp-engine/src/server.ts"],
      "enabled": true
    }
  }
}
````

### How to Use

1. Make sure Qdrant is running:

   ```bash
   cd mcp-engine && docker-compose up -d
   ```

2. Make sure the project is indexed:

   ```bash
   npx tsx mcp-engine/src/cli.ts index
   ```

3. Open OpenCode:

   ```bash
   opencode
   ```

4. The tools will be available automatically. AI will use them when it needs to search code.

---

## Usage Examples

### Example 1: Find a specific service

**User**: Find the users service in the backend

**AI uses tool**: `buscar_codigo` with query "users service"

**Result**: Returns relevant engrams from the users service with framework and export info

### Example 2: Filter by framework

**User**: Find Vue components only

**AI uses tool**: `buscar_codigo` with query "form input" and `frameworks: ["vue"]`

**Result**: Only returns engrams from Vue files

### Example 3: Check if code is up to date

**User**: Do you have the code indexed?

**AI uses tool**: `stats_index`

**Result**: Shows number of engrams, files, last indexing, and hybrid search status

### Example 4: Before making big changes

**User**: I'm going to refactor the authentication

**AI uses tool**: `necesita_reindex`

**Result**: If there are outdated files, recommends re-indexing before proceeding

---

## Costs

### Embeddings (OpenRouter)

| Operation                  | Approximate Cost |
| -------------------------- | ---------------- |
| Index project (~500 files) | $0.10 - $0.20    |
| Each search                | $0.0001          |

> **Note**: Uses `qwen/qwen3-embedding-8b` model via OpenRouter. First index costs ~$0.10-0.20, subsequent incremental updates cost much less.

### Qdrant (Docker)

No additional cost (local Docker).

### Notes

- **Search cache** reduces costs: repeated searches within the same session are instant
- **Vectors persist** in Qdrant: you don't need to re-index every time
- **Each project** has its own collection in Qdrant: total isolation
- **Incremental indexing** saves costs: only changed files are re-indexed
- **Hybrid search** uses more compute but provides better results for keyword-based queries

### Cost-Saving Tip: Export & Import

Since embeddings are expensive to generate but cheap to store/transfer:

```bash
# Project A: Index once (pay)
npx tsx mcp-engine/src/cli.ts index --force

# Project A: Export
npx tsx mcp-engine/src/cli.ts export ./my-project-embeddings.json

# Project B: Import (free, no API calls)
npx tsx mcp-engine/src/cli.ts import ./my-project-embeddings.json
```

---

## Testing

Run tests with Vitest:

```bash
cd mcp-engine
npm run test        # Watch mode
npm run test:run    # Single run
```

Test files:

- `src/__tests__/indexer.test.ts` - Engram segmentation tests
- `src/__tests__/parser.test.ts` - Metadata extraction tests
- `src/__tests__/search.test.ts` - BM25 search tests

---

## Troubleshooting

### Qdrant not responding

```bash
# Check Docker is running
docker ps

# Restart Qdrant
cd mcp-engine
docker-compose restart
```

### Error "OPENROUTER_API_KEY not found"

Make sure the `.env.local` file exists in the project root with the API key.

### Index doesn't find new code

```bash
# Re-index the project
npx tsx mcp-engine/src/cli.ts index --force
```

### Collection doesn't exist

The indexer creates it automatically. Make sure to run `index` at least once.

---

## Next Steps

- [View source code](./MCP-ENGINE.md) (for developers)
- [Configure in other projects](#configuration-in-other-projects)

### Configuration in Other Projects

To use MCP Vector Search in another project:

1. Copy the `mcp-engine` folder to the new project
2. Create `.env.local` with your `OPENROUTER_API_KEY`
3. Run `docker-compose up -d` in the `mcp-engine` folder
4. Index: `npx tsx mcp-engine/src/cli.ts index`
5. Configure `opencode.json` pointing to `mcp-engine/src/server.ts`
