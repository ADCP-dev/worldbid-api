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

---

## What is it?

**MCP Vector Search** is a semantic search system that allows AI to find relevant code in your project without running commands like `grep`, `find`, or `cat`.

Instead of searching by exact keywords, the system:

1. Converts your code into **embedding vectors** (numeric representations of meaning)
2. Stores them in **Qdrant** (vector database)
3. Allows AI to search by **meaning**, not exact text

---

## Why use it?

### The old way problem

When coding with AI, to find code the AI would run commands like:

```bash
grep -r "login" src/
find src -name "*.ts" | xargs cat
```

This has problems:

- **Slow**: Each command takes time and tokens
- **Inaccurate**: If you don't know the exact path, AI hallucinates paths
- **Expensive**: Wastes context/tokens reading unnecessary files

### The MCP solution

AI has direct tools to search your indexed code:

- **Semantic search**: "find the authentication logic" → finds relevant code
- **Instant**: No need to run commands
- **Precise**: Returns contextualized code snippets

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
│  │ (index code)  │    │   (vectors)  │    │ (MCP server)│  │
│  └───────────────┘    └──────────────┘    └─────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      OpenCode                               │
│              ( AI client with tools )                       │
│                                                             │
│   Available tools:                                          │
│   • buscar_codigo     - Semantic search                     │
│   • stats_index       - Index statistics                    │
│   • necesita_reindex  - Detect outdated files               │
└─────────────────────────────────────────────────────────────┘
```

### Components

| Component         | Purpose                      |
| ----------------- | ---------------------------- |
| **Qdrant**        | Vector database (Docker)     |
| **indexer.ts**    | Indexes project code         |
| **server.ts**     | MCP server for OpenCode      |
| **opencode.json** | MCP configuration in project |

### Embedding Model

| Model                     | Dimensions | Provider   |
| ------------------------- | ---------- | ---------- |
| `qwen/qwen3-embedding-8b` | 4096       | OpenRouter |

Uses Qwen3-Embedding-8B for high-quality semantic representations.

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

Exports the current collection to a JSON file. Useful for:

- **Backup**: Save your indexed vectors
- **Transfer**: Move embeddings between projects
- **Cost savings**: Generate once, reuse many times

### Import embeddings

```bash
npx tsx mcp-engine/src/cli.ts import ./backup.json
```

Imports embeddings from a JSON file. Creates a new collection with the imported data.

**Use case**: Index project A (pays once), export to JSON, import into project B (no API costs).

---

## MCP Tools

When using OpenCode with this project, you have 3 tools available:

### 1. buscar_codigo

**Purpose**: Semantic code search

**Input**:

- `query`: Natural language search
- `limit`: Number of results (max 5, default 3)

**Example**:

```
Find the JWT authentication logic in the project
```

**Response**:

````
📄 **apps\back\src\modules\iam\auth\auth.service.ts**
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

- **Total vectors**: 748
- **Unique files indexed**: 439
- **Files in project**: 440
- **Last indexed**: 2026-03-11T10:30:00.000Z

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

**Result**: Returns relevant code from the users service

### Example 2: Check if code is up to date

**User**: Do you have the code indexed?

**AI uses tool**: `stats_index`

**Result**: Shows number of vectors, files, last indexing

### Example 3: Before making big changes

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
