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

const possibleEnvPaths = [
  path.join(process.cwd(), ".env.local"),
];

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

console.error(`🔍 MCP Server inicializado para colección: ${collectionName}`);

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL || "http://localhost:6333",
});

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
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== "buscar_codigo") {
    return {
      content: [{ type: "text", text: "Herramienta desconocida" }],
      isError: true,
    };
  }

  const query = request.params.arguments?.query as string;
  const limit = Math.min((request.params.arguments?.limit as number) || 3, 5);

  try {
    const embedding = await openai.embeddings.create({
      model: "openai/text-embedding-3-small",
      input: query,
    });

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

    return { content: [{ type: "text", text: response }] };
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error al buscar: ${error}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
