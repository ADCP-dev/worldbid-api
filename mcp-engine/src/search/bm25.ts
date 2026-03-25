import type { BM25Result, EngramPayload } from "../types.js";

export interface BM25Index {
  documents: Map<string, { tokens: string[]; engramId: string }>;
  avgdl: number;
  k1: number;
  b: number;
}

export function createBM25Index(engrams: EngramPayload[]): BM25Index {
  const documents = new Map<string, { tokens: string[]; engramId: string }>();
  let totalTokens = 0;

  for (const engram of engrams) {
    const tokens = tokenize(engram.codeSnippet);
    documents.set(engram.id, { tokens, engramId: engram.id });
    totalTokens += tokens.length;
  }

  return {
    documents,
    avgdl: totalTokens / Math.max(engrams.length, 1),
    k1: 1.5,
    b: 0.75,
  };
}

export function searchBM25(
  index: BM25Index,
  query: string,
  limit: number,
): BM25Result[] {
  const queryTokens = tokenize(query);
  const scores = new Map<string, number>();

  for (const [docId, doc] of index.documents) {
    let score = 0;
    for (const term of queryTokens) {
      const tf = doc.tokens.filter((t) => t === term).length;
      if (tf > 0) {
        const idf = Math.log(
          (index.documents.size - df(term, index) + 0.5) /
            (df(term, index) + 0.5) +
            1,
        );
        score +=
          (idf * (tf * (index.k1 + 1))) /
          (tf +
            index.k1 *
              (1 - index.b + index.b * (doc.tokens.length / index.avgdl)));
      }
    }
    scores.set(docId, score);
  }

  return Array.from(scores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id, score]) => ({ id, score }));
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-zA-Z0-9]+/)
    .filter((t) => t.length > 2);
}

function df(term: string, index: BM25Index): number {
  let count = 0;
  for (const doc of index.documents.values()) {
    if (doc.tokens.includes(term)) count++;
  }
  return count;
}
