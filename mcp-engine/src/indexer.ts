import fs from "fs";
import path from "path";
import crypto from "crypto";
import { QdrantClient } from "@qdrant/js-client-rest";
import OpenAI from "openai";
import type {
  IndexerOptions,
  EngramContent,
  EngramPayload,
  EngramMetadata,
} from "./types.js";
import { parseTypeScript, parseMarkdown } from "./parser/index.js";
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
  "public",
  ".opencode",
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

  private segmentIntoEngrams(
    content: string,
    relativePath: string,
  ): EngramContent[] {
    const lines = content.split("\n");
    const fileName = path.basename(relativePath);

    if (lines.length <= 400) {
      return [
        {
          content: `// ${relativePath}\n${content}`,
          lineStart: 1,
          lineEnd: lines.length,
          header: `// ${fileName}:1-${lines.length}`,
          chunkIndex: 0,
          totalChunks: 1,
        },
      ];
    }

    const engrams: EngramContent[] = [];
    for (let i = 0; i < lines.length; i += 150) {
      const chunkLines = lines.slice(i, i + 150);
      const lineStart = i + 1;
      const lineEnd = i + chunkLines.length;

      engrams.push({
        content: `// ${fileName}:${lineStart}-${lineEnd}\n${chunkLines.join("\n")}`,
        lineStart,
        lineEnd,
        header: `// ${fileName}:${lineStart}-${lineEnd}`,
        chunkIndex: engrams.length,
        totalChunks: 0,
      });
    }

    engrams.forEach((e) => (e.totalChunks = engrams.length));

    return engrams;
  }

  private generateStableId(relativePath: string, chunkIndex: number): string {
    const hash = crypto
      .createHash("sha256")
      .update(`${relativePath}:${chunkIndex}`)
      .digest("hex");
    return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
  }

  private async getIndexedFilePaths(): Promise<Map<string, string[]>> {
    const fileChunks = new Map<string, string[]>();
    let offset: string | undefined = undefined;

    do {
      const scroll = (await this.qdrant.scroll(this.collectionName, {
        limit: 1000,
        with_payload: true,
        offset,
      })) as any;

      const points = scroll.points || [];
      for (const point of points) {
        const filePath = point.payload?.filePath;
        if (filePath) {
          if (!fileChunks.has(filePath)) {
            fileChunks.set(filePath, []);
          }
          fileChunks.get(filePath)!.push(point.id);
        }
      }

      offset = scroll.next_page_offset;
    } while (offset);

    return fileChunks;
  }

  private async deletePoints(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    const batches: string[][] = [];
    for (let i = 0; i < ids.length; i += 100) {
      batches.push(ids.slice(i, i + 100));
    }

    for (const batch of batches) {
      await this.qdrant.delete(this.collectionName, {
        wait: true,
        points: batch,
      });
    }
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
        vectors: { size: 4096, distance: "Cosine" },
      });
    }
  }

  async index(options: IndexerOptions = {}): Promise<void> {
    const { forceReindex = false, dryRun = false } = options;

    console.log(`🚀 Indexando proyecto: ${this.collectionName}`);
    console.log(`📁 Ruta: ${this.projectPath}`);

    let collectionExists = false;
    try {
      await this.qdrant.getCollection(this.collectionName);
      collectionExists = true;
    } catch {
      collectionExists = false;
    }

    if (forceReindex && collectionExists) {
      console.log("🗑️  Eliminando colección existente...");
      await this.qdrant.deleteCollection(this.collectionName);
      collectionExists = false;
    }

    if (!collectionExists) {
      console.log("✅ Creando nueva colección...");
      await this.qdrant.createCollection(this.collectionName, {
        vectors: { size: 4096, distance: "Cosine" },
      });
    }

    const metaFilePath = path.join(this.projectPath, ".mcp-index-meta.json");
    let lastIndexed: Date | null = null;
    let existingFileChunks = new Map<string, string[]>();

    if (!forceReindex && fs.existsSync(metaFilePath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaFilePath, "utf-8"));
        if (meta.lastIndexed) {
          lastIndexed = new Date(meta.lastIndexed);
        }
      } catch {}

      if (lastIndexed) {
        console.log(`📅 Última indexación: ${lastIndexed.toISOString()}`);
        existingFileChunks = await this.getIndexedFilePaths();
        console.log(`📂 Archivos ya indexados: ${existingFileChunks.size}`);
      }
    }

    const files = this.getFiles(this.projectPath);
    console.log(`📄 ${files.length} archivos encontrados`);

    if (dryRun) {
      console.log("\n📋 Archivos que serían indexados:");
      files.forEach((f) =>
        console.log(`  - ${f.replace(this.projectPath, "")}`),
      );
      return;
    }

    const startTime = Date.now();
    const CONCURRENCY = 5;
    const QDRANT_BATCH_SIZE = 100;
    const BATCH_DELAY_MS = 500;

    const filesToProcess: Array<{
      file: string;
      relativePath: string;
      mtime: Date;
    }> = [];
    const filesToRemove: Array<{ relativePath: string; chunkIds: string[] }> =
      [];

    for (const file of files) {
      const relativePath = file
        .replace(this.projectPath, "")
        .replace(/^[/\\]/, "");
      const stats = fs.statSync(file);

      if (lastIndexed && existingFileChunks.has(relativePath)) {
        if (stats.mtime <= lastIndexed) {
          continue;
        }
        filesToRemove.push({
          relativePath,
          chunkIds: existingFileChunks.get(relativePath)!,
        });
      }
      filesToProcess.push({ file, relativePath, mtime: stats.mtime });
    }

    if (filesToRemove.length > 0) {
      console.log(
        `🗑️  Eliminando ${filesToRemove.length} archivos modificados...`,
      );
      for (const { chunkIds } of filesToRemove) {
        await this.deletePoints(chunkIds);
      }
    }

    const allEngrams: Array<{
      relativePath: string;
      chunkIndex: number;
      content: EngramContent;
      metadata: EngramMetadata;
    }> = [];

    for (const { file, relativePath } of filesToProcess) {
      const content = fs.readFileSync(file, "utf-8");
      const engramContents = this.segmentIntoEngrams(content, relativePath);
      const ext = path.extname(file);
      const metadata =
        ext === ".md"
          ? parseMarkdown(content, relativePath)
          : parseTypeScript(content, relativePath);

      for (let i = 0; i < engramContents.length; i++) {
        const engram = engramContents[i];
        if (engram.content.trim()) {
          allEngrams.push({
            relativePath,
            chunkIndex: i,
            content: engram,
            metadata,
          });
        }
      }
    }

    console.log(
      `📝 ${allEngrams.length} engrams a procesar (concurrencia: ${CONCURRENCY})`,
    );

    if (allEngrams.length === 0) {
      console.log("✅ No hay cambios que procesar");
      return;
    }

    const points: Array<{
      id: string;
      vector: number[];
      payload: EngramPayload;
    }> = [];
    let processedEngrams = 0;
    let errors = 0;

    const processEngram = async (
      engram: (typeof allEngrams)[number],
    ): Promise<{
      id: string;
      vector: number[];
      payload: EngramPayload;
    } | null> => {
      try {
        const embedding = await this.openai.embeddings.create({
          model: "qwen/qwen3-embedding-8b",
          input: engram.content.content,
        });

        if (!embedding.data || embedding.data.length === 0) {
          return null;
        }

        return {
          id: this.generateStableId(engram.relativePath, engram.chunkIndex),
          vector: embedding.data[0].embedding as number[],
          payload: {
            id: this.generateStableId(engram.relativePath, engram.chunkIndex),
            filePath: engram.relativePath,
            fileName: path.basename(engram.relativePath),
            lineStart: engram.content.lineStart,
            lineEnd: engram.content.lineEnd,
            chunkIndex: engram.content.chunkIndex,
            totalChunks: engram.content.totalChunks,
            codeSnippet: engram.content.content,
            header: engram.content.header,
            language: engram.metadata.language,
            imports: engram.metadata.imports,
            exports: engram.metadata.exports,
            docComment: engram.metadata.docComment,
            framework: engram.metadata.framework,
            keywords: engram.metadata.keywords,
          },
        };
      } catch (error) {
        errors++;
        if (errors <= 5) {
          console.error(
            `⚠️  Error ${engram.relativePath}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
        return null;
      }
    };

    for (let i = 0; i < allEngrams.length; i += CONCURRENCY) {
      const wave = allEngrams.slice(i, i + CONCURRENCY);
      const results = await Promise.all(wave.map(processEngram));

      for (const result of results) {
        if (result) {
          points.push(result);
        }
      }
      processedEngrams += wave.length;

      if (points.length >= QDRANT_BATCH_SIZE) {
        await this.qdrant.upsert(this.collectionName, {
          wait: true,
          points: [...points],
        });
        points.length = 0;
        // Small delay between batches to let Qdrant breathe
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
      }

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const rate = (
        processedEngrams / Math.max(1, (Date.now() - startTime) / 1000)
      ).toFixed(1);
      console.log(
        `⏳ ${processedEngrams}/${allEngrams.length} engrams (${elapsed}s, ~${rate}/s)`,
      );
    }

    if (points.length > 0) {
      await this.qdrant.upsert(this.collectionName, {
        wait: true,
        points: [...points],
      });
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `\n✅ Indexación completa: ${processedEngrams} engrams en ${totalTime}s (${errors} errores)`,
    );

    fs.writeFileSync(
      metaFilePath,
      JSON.stringify(
        {
          lastIndexed: new Date().toISOString(),
          totalEngrams: processedEngrams,
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

  async export(outputPath?: string): Promise<void> {
    console.log(`📤 Exportando colección: ${this.collectionName}`);

    const exportFilePath =
      outputPath ||
      path.join(this.projectPath, `${this.collectionName}-embeddings.json`);

    let offset: string | undefined = undefined;
    const allPoints: any[] = [];
    let totalPoints = 0;

    do {
      const scroll = (await this.qdrant.scroll(this.collectionName, {
        limit: 1000,
        with_payload: true,
        with_vector: true,
        offset,
      })) as any;

      const points = scroll.points || [];
      allPoints.push(...points);
      totalPoints += points.length;
      offset = scroll.next_page_offset;

      console.log(`📥 Procesados ${totalPoints} puntos...`);
    } while (offset);

    const exportData = {
      collectionName: this.collectionName,
      exportedAt: new Date().toISOString(),
      vectorSize: 4096,
      pointsCount: totalPoints,
      points: allPoints.map((p) => ({
        id: p.id,
        vector: p.vector,
        payload: p.payload,
      })),
    };

    fs.writeFileSync(exportFilePath, JSON.stringify(exportData));

    const fileSize = (fs.statSync(exportFilePath).size / 1024 / 1024).toFixed(
      2,
    );
    console.log(`\n✅ Exportación completa: ${totalPoints} puntos exportados`);
    console.log(`📁 Archivo: ${exportFilePath} (${fileSize} MB)`);
  }

  async import(inputPath: string): Promise<void> {
    console.log(`📥 Importando desde: ${inputPath}`);

    if (!fs.existsSync(inputPath)) {
      console.error(`❌ Archivo no encontrado: ${inputPath}`);
      return;
    }

    const importData = JSON.parse(fs.readFileSync(inputPath, "utf-8"));

    if (!importData.points || !Array.isArray(importData.points)) {
      console.error("❌ Formato de archivo inválido");
      return;
    }

    const pointsToImport = importData.points;
    console.log(`📦 Puntos a importar: ${pointsToImport.length}`);

    const collectionExists = await this.qdrant
      .getCollection(this.collectionName)
      .then(() => true)
      .catch(() => false);

    if (collectionExists) {
      console.log("⚠️  La colección ya existe. Eliminando...");
      await this.qdrant.deleteCollection(this.collectionName);
    }

    console.log("✅ Creando colección...");
    await this.qdrant.createCollection(this.collectionName, {
      vectors: { size: importData.vectorSize || 4096, distance: "Cosine" },
    });

    const IMPORT_BATCH_SIZE = 100;
    let imported = 0;

    for (let i = 0; i < pointsToImport.length; i += IMPORT_BATCH_SIZE) {
      const batch = pointsToImport.slice(i, i + IMPORT_BATCH_SIZE);

      await this.qdrant.upsert(this.collectionName, {
        wait: true,
        points: batch,
      });

      imported += batch.length;
      console.log(`📥 Importados ${imported}/${pointsToImport.length}...`);
    }

    const metaFilePath = path.join(this.projectPath, ".mcp-index-meta.json");
    fs.writeFileSync(
      metaFilePath,
      JSON.stringify(
        {
          lastIndexed: new Date().toISOString(),
          totalEngrams: pointsToImport.length,
        },
        null,
        2,
      ),
    );

    console.log(`\n✅ Importación completa: ${imported} puntos`);
    console.log(`💾 Metadata guardada en ${metaFilePath}`);
  }
}
