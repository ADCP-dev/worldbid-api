import type { SearchOptions, EngramSearchResult } from "../types.js";
import { QdrantClient } from "@qdrant/js-client-rest";
import OpenAI from "openai";
import { createBM25Index, searchBM25, type BM25Index } from "./bm25.js";

export { createBM25Index, searchBM25 };
export type { BM25Index };

export interface HybridSearchDeps {
  openai: OpenAI;
  qdrant: QdrantClient;
  collectionName: string;
  bm25Index?: BM25Index;
}

export async function hybridSearch(
  query: string,
  options: SearchOptions,
  deps: HybridSearchDeps,
): Promise<EngramSearchResult[]> {
  const {
    limit = 10,
    alpha = 0.7,
    fileTypes,
    frameworks,
    minScore = 0.3,
  } = options;

  const embedding = await deps.openai.embeddings.create({
    model: "qwen/qwen3-embedding-8b",
    input: query,
  });

  const vectorResults = (await deps.qdrant.search(deps.collectionName, {
    vector: embedding.data[0].embedding as number[],
    limit: limit * 3,
    with_payload: true,
    filter: buildFilter(fileTypes, frameworks),
  })) as any[];

  if (!deps.bm25Index || deps.bm25Index.documents.size === 0) {
    return vectorResults.slice(0, limit).map((r: any) => ({
      id: r.id,
      score: r.score || 0,
      combinedScore: r.score || 0,
      payload: r.payload,
    }));
  }

  const bm25Results = searchBM25(deps.bm25Index, query, limit * 3);
  const bm25Map = new Map(bm25Results.map((r) => [r.id, r.score]));
  const maxBm25 = Math.max(...bm25Results.map((r) => r.score), 0.001);

  const combined = vectorResults.map((r: any) => {
    const bm25Score = bm25Map.get(String(r.id)) || 0;
    const normalizedBm25 = bm25Score / maxBm25;
    const combinedScore = alpha * (r.score || 0) + (1 - alpha) * normalizedBm25;
    return {
      id: String(r.id),
      score: r.score || 0,
      combinedScore,
      payload: r.payload,
    };
  });

  return combined
    .filter((r) => r.combinedScore >= minScore)
    .sort((a, b) => b.combinedScore - a.combinedScore)
    .slice(0, limit);
}

function buildFilter(fileTypes?: string[], frameworks?: string[]): any {
  if (!fileTypes?.length && !frameworks?.length) return undefined;

  const must: any[] = [];
  if (fileTypes?.length) {
    must.push({
      key: "filePath",
      match: { any: fileTypes },
    });
  }
  if (frameworks?.length) {
    must.push({
      key: "framework",
      match: { any: frameworks },
    });
  }

  return must.length > 0 ? { must } : undefined;
}
