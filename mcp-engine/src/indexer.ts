import fs from "fs";
import path from "path";
import { QdrantClient } from "@qdrant/js-client-rest";
import OpenAI from "openai";
import type { IndexerOptions } from "./types.js";
import dotenv from "dotenv";

const possibleEnvPaths = [path.join(process.cwd(), ".env.local")];

for (const envPath of possibleEnvPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

const IGNORE_DIRS = [
  "node_modules",
  ".git",
  ".nuxt",
  "dist",
  ".turbo",
  ".output",
  ".data",
  "mcp-engine",
];
const VALID_EXTENSIONS = [".ts", ".vue", ".js", ".tsx", ".jsx", ".json", ".md"];

export class CodeIndexer {
  private openai: OpenAI;
  private qdrant: QdrantClient;
  private collectionName: string;
  private projectPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.collectionName = path
      .basename(projectPath)
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .toLowerCase();

    const apiKey = process.env.OPENROUTER_API_KEY;
    const qdrantUrl = process.env.QDRANT_URL || "http://localhost:6333";

    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY no encontrada en .env");
    }

    this.openai = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey,
    });

    this.qdrant = new QdrantClient({ url: qdrantUrl });
  }

  getCollectionName(): string {
    return this.collectionName;
  }

  private getFiles(dir: string): string[] {
    const files: string[] = [];

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (IGNORE_DIRS.includes(entry.name)) continue;

        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          files.push(...this.getFiles(fullPath));
        } else if (VALID_EXTENSIONS.some((ext) => entry.name.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    } catch {
      // Silently ignore permission errors
    }

    return files;
  }

  private chunkIfNeeded(content: string): string[] {
    const lines = content.split("\n");
    if (lines.length <= 400) {
      return [content];
    }

    const chunks: string[] = [];
    for (let i = 0; i < lines.length; i += 150) {
      chunks.push(lines.slice(i, i + 150).join("\n"));
    }
    return chunks;
  }

  private generateStableId(relativePath: string, chunkIndex: number): string {
    return crypto.randomUUID();
  }

  async ensureCollection(
    exists: boolean,
    forceRecreate: boolean,
  ): Promise<void> {
    if (forceRecreate && exists) {
      console.log("🗑️  Eliminando colección existente...");
      await this.qdrant.deleteCollection(this.collectionName);
      exists = false;
    }

    if (!exists) {
      console.log("✅ Creando nueva colección...");
      await this.qdrant.createCollection(this.collectionName, {
        vectors: { size: 1536, distance: "Cosine" },
      });
    }
  }

  async index(options: IndexerOptions = {}): Promise<void> {
    const { forceReindex = false, dryRun = false } = options;

    console.log(`🚀 Indexando proyecto: ${this.collectionName}`);
    console.log(`📁 Ruta: ${this.projectPath}`);

    // Check if collection exists
    let collectionExists = false;
    try {
      await this.qdrant.getCollection(this.collectionName);
      collectionExists = true;
    } catch {
      collectionExists = false;
    }

    await this.ensureCollection(collectionExists, forceReindex);

    const files = this.getFiles(this.projectPath);
    console.log(`📄 ${files.length} archivos encontrados`);

    if (dryRun) {
      console.log("\n📋 Archivos que serían indexados:");
      files.forEach((f) =>
        console.log(`  - ${f.replace(this.projectPath, "")}`),
      );
      return;
    }

    let processed = 0;
    let totalChunks = 0;

    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      const chunks = this.chunkIfNeeded(content);
      const relativePath = file
        .replace(this.projectPath, "")
        .replace(/^[/\\]/, "");

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (!chunk.trim()) continue;

        const embedding = await this.openai.embeddings.create({
          model: "openai/text-embedding-3-small",
          input: chunk,
        });

        const stableId = this.generateStableId(relativePath, i);

        await this.qdrant.upsert(this.collectionName, {
          wait: true,
          points: [
            {
              id: stableId,
              vector: embedding.data[0].embedding,
              payload: {
                filePath: relativePath,
                codeSnippet: chunk,
              },
            },
          ],
        });

        totalChunks++;
      }

      processed++;
      if (processed % 50 === 0) {
        console.log(`⏳ Procesados: ${processed}/${files.length} archivos`);
      }
    }

    console.log(
      `\n✅ Indexación completa: ${processed} archivos, ${totalChunks} chunks`,
    );

    const metaFilePath = path.join(this.projectPath, ".mcp-index-meta.json");
    fs.writeFileSync(
      metaFilePath,
      JSON.stringify(
        {
          lastIndexed: new Date().toISOString(),
          totalFiles: processed,
        },
        null,
        2,
      ),
    );
    console.log(`💾 Metadata guardada en ${metaFilePath}`);
  }

  async delete(): Promise<void> {
    console.log(`🗑️  Eliminando colección: ${this.collectionName}`);

    try {
      await this.qdrant.deleteCollection(this.collectionName);
      console.log("✅ Colección eliminada");

      const metaFilePath = path.join(this.projectPath, ".mcp-index-meta.json");
      if (fs.existsSync(metaFilePath)) {
        fs.unlinkSync(metaFilePath);
        console.log("✅ Metadata eliminada");
      }
    } catch (error) {
      console.log("⚠️  La colección no existía");
    }
  }

  async list(): Promise<void> {
    const collections = await this.qdrant.getCollections();

    console.log("\n📚 Colecciones en Qdrant:\n");

    for (const col of collections.collections) {
      const info = await this.qdrant.getCollection(col.name);
      console.log(`  • ${col.name} - ${info.points_count} vectores`);
    }
  }
}
