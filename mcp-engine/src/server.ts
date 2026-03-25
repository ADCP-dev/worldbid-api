import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { QdrantClient } from "@qdrant/js-client-rest";
import OpenAI from "openai";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import crypto from "crypto";

const possibleEnvPaths = [path.join(process.cwd(), ".env.local")];

for (const envPath of possibleEnvPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

const currentPath = process.cwd();
const collectionName = path
  .basename(currentPath)
  .replace(/[^a-zA-Z0-9_-]/g, "_")
  .toLowerCase();

const metaFilePath = path.join(currentPath, ".mcp-index-meta.json");
const CACHE_MAX_SIZE = 100;

console.error(`🔍 MCP Server inicializado para colección: ${collectionName}`);

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL || "http://localhost:6333",
});

interface CacheEntry {
  result: any;
  timestamp: number;
}

const searchCache = new Map<string, CacheEntry>();

function normalizeQuery(query: string): string {
  return query.toLowerCase().trim().replace(/\s+/g, " ");
}

function getCachedResult(query: string): string | null {
  const normalized = normalizeQuery(query);
  const entry = searchCache.get(normalized);

  if (entry) {
    const age = Date.now() - entry.timestamp;
    if (age < 3600000) {
      return entry.result;
    }
    searchCache.delete(normalized);
  }
  return null;
}

function setCachedResult(query: string, result: string): void {
  const normalized = normalizeQuery(query);

  if (searchCache.size >= CACHE_MAX_SIZE) {
    const oldestKey = searchCache.keys().next().value;
    if (oldestKey) searchCache.delete(oldestKey);
  }

  searchCache.set(normalized, { result, timestamp: Date.now() });
}

function getIndexMeta(): { lastIndexed: string | null; totalFiles: number } {
  try {
    if (fs.existsSync(metaFilePath)) {
      return JSON.parse(fs.readFileSync(metaFilePath, "utf-8"));
    }
  } catch {}
  return { lastIndexed: null, totalFiles: 0 };
}

function getProjectFiles(): string[] {
  const IGNORE_DIRS = [
    "node_modules",
    ".git",
    ".nuxt",
    "dist",
    ".turbo",
    ".output",
    ".data",
    "mcp-engine",
    "public",
  ];
  const VALID_EXTENSIONS = [
    ".ts",
    ".vue",
    ".js",
    ".tsx",
    ".jsx",
    ".json",
    ".md",
  ];

  function getFiles(dir: string): string[] {
    const files: string[] = [];
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (IGNORE_DIRS.includes(entry.name)) continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...getFiles(fullPath));
        } else if (VALID_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    } catch {}
    return files;
  }

  return getFiles(currentPath);
}

const server = new Server(
  { name: `code-search-${collectionName}`, version: "1.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "buscar_codigo",
      description: `Busca código en el proyecto "${collectionName}" usando búsqueda semántica. Útil para encontrar funciones, componentes, clases o lógica específica.`,
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Qué buscas (ej: 'lógica de autenticación JWT', 'componente de login', 'servicio de usuarios')",
          },
          limit: {
            type: "number",
            description: "Número de resultados (máximo 5)",
            default: 3,
          },
        },
        required: ["query"],
      },
    },
    {
      name: "stats_index",
      description: `Muestra estadísticas del índice de código del proyecto "${collectionName}". Útil para saber cuánto código está indexado.`,
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
    {
      name: "necesita_reindex",
      description: `Detecta si el índice de código está desactualizado comparando con los archivos actuales del proyecto "${collectionName}".`,
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "buscar_codigo") {
    const query = args?.query as string;
    const limit = Math.min((args?.limit as number) || 3, 5);

    const cached = getCachedResult(query);
    if (cached) {
      return { content: [{ type: "text", text: `🔄 (cached)\n\n${cached}` }] };
    }

    try {
      const embedding = await openai.embeddings.create({
        model: "qwen/qwen3-embedding-8b",
        input: query,
      });

      console.error(
        `[DEBUG] Embedding received: ${JSON.stringify({ hasData: !!embedding.data, length: embedding.data?.length })}`,
      );

      if (!embedding.data || embedding.data.length === 0) {
        return {
          content: [
            { type: "text", text: "Error: No se pudo generar embedding" },
          ],
          isError: true,
        };
      }

      const results = await qdrant.search(collectionName, {
        vector: embedding.data[0].embedding,
        limit,
        with_payload: true,
      });

      if (results.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No se encontró código relevante en el proyecto.",
            },
          ],
        };
      }

      const response = results
        .map((r: any) => {
          return `📄 **${r.payload.filePath}**\n\`\`\`\n${r.payload.codeSnippet}\n\`\`\``;
        })
        .join("\n\n");

      setCachedResult(query, response);
      return { content: [{ type: "text", text: response }] };
    } catch (error) {
      console.error(`[ERROR] Buscar error:`, error);
      return {
        content: [{ type: "text", text: `Error al buscar: ${error}` }],
        isError: true,
      };
    }
  }

  if (name === "stats_index") {
    try {
      const info = await qdrant.getCollection(collectionName);
      const meta = getIndexMeta();
      const files = getProjectFiles();
      const uniqueFiles = new Set<string>();

      try {
        const scroll = (await qdrant.scroll(collectionName, {
          limit: 10000,
          with_payload: true,
        })) as any;
        const points = scroll.points || [];
        for (const point of points) {
          if (point.payload?.filePath) {
            uniqueFiles.add(point.payload.filePath);
          }
        }
      } catch {}

      const stats = `
📊 **Estadísticas del Índice**

- **Vectores totales**: ${info.points_count}
- **Archivos únicos indexados**: ${uniqueFiles.size}
- **Archivos en proyecto**: ${files.length}
- **Última indexación**: ${meta.lastIndexed || "Desconocida"}
`;

      return { content: [{ type: "text", text: stats }] };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error al obtener stats: ${error}` }],
        isError: true,
      };
    }
  }

  if (name === "necesita_reindex") {
    try {
      const meta = getIndexMeta();
      const files = getProjectFiles();
      const lastIndexed = meta.lastIndexed ? new Date(meta.lastIndexed) : null;

      const outdatedFiles: string[] = [];
      const newFiles: string[] = [];

      const indexedPaths = new Set<string>();
      try {
        const scroll = (await qdrant.scroll(collectionName, {
          limit: 10000,
          with_payload: true,
        })) as any;
        const points = scroll.points || [];
        for (const point of points) {
          if (point.payload?.filePath) {
            indexedPaths.add(point.payload.filePath);
          }
        }
      } catch {}

      for (const file of files) {
        const relativePath = file
          .replace(currentPath, "")
          .replace(/^[/\\]/, "");
        const stats = fs.statSync(file);

        if (!indexedPaths.has(relativePath)) {
          newFiles.push(relativePath);
        } else if (lastIndexed && stats.mtime > lastIndexed) {
          outdatedFiles.push(relativePath);
        }
      }

      const totalChanges = outdatedFiles.length + newFiles.length;

      if (totalChanges === 0) {
        return {
          content: [
            {
              type: "text",
              text: `✅ **El índice está actualizado**\n\nÚltima indexación: ${meta.lastIndexed || "Desconocida"}\nArchivos indexados: ${indexedPaths.size}`,
            },
          ],
        };
      }

      let response = `⚠️ **El índice necesita actualización**\n\n`;
      response += `- Archivos nuevos: ${newFiles.length}\n`;
      response += `- Archivos modificados: ${outdatedFiles.length}\n`;
      response += `- Total cambios: ${totalChanges}\n\n`;

      if (outdatedFiles.length > 0) {
        response += `📝 **Archivos modificados** (los primeros 5):\n`;
        response += outdatedFiles
          .slice(0, 5)
          .map((f) => `- ${f}`)
          .join("\n");
        if (outdatedFiles.length > 5)
          response += `\n...y ${outdatedFiles.length - 5} más`;
        response += "\n";
      }

      if (newFiles.length > 0) {
        response += `\n🆕 **Archivos nuevos** (los primeros 5):\n`;
        response += newFiles
          .slice(0, 5)
          .map((f) => `- ${f}`)
          .join("\n");
        if (newFiles.length > 5)
          response += `\n...y ${newFiles.length - 5} más`;
      }

      response += `\n\nEjecuta: \`npx tsx mcp-engine/src/cli.ts index --force\` para re-indexar`;

      return { content: [{ type: "text", text: response }] };
    } catch (error) {
      return {
        content: [
          { type: "text", text: `Error al verificar reindex: ${error}` },
        ],
        isError: true,
      };
    }
  }

  return {
    content: [{ type: "text", text: "Herramienta desconocida" }],
    isError: true,
  };
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
