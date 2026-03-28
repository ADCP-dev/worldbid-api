import { describe, it, expect } from "vitest";
import { createBM25Index, searchBM25 } from "../search/bm25";
import type { EngramPayload } from "../types";

describe("BM25", () => {
  describe("createBM25Index", () => {
    it("should create index from engrams", () => {
      const engrams: EngramPayload[] = [
        {
          id: "1",
          codeSnippet: "user service authentication login jwt",
          filePath: "a.ts",
          fileName: "a.ts",
          lineStart: 1,
          lineEnd: 5,
          chunkIndex: 0,
          totalChunks: 1,
          header: "",
          language: "typescript",
          imports: [],
          exports: [],
          docComment: null,
          framework: null,
          keywords: [],
        },
        {
          id: "2",
          codeSnippet: "product catalog inventory stock management",
          filePath: "b.ts",
          fileName: "b.ts",
          lineStart: 1,
          lineEnd: 5,
          chunkIndex: 0,
          totalChunks: 1,
          header: "",
          language: "typescript",
          imports: [],
          exports: [],
          docComment: null,
          framework: null,
          keywords: [],
        },
      ];

      const index = createBM25Index(engrams);

      expect(index.documents.size).toBe(2);
      expect(index.avgdl).toBeGreaterThan(0);
    });

    it("should handle empty engrams", () => {
      const index = createBM25Index([]);

      expect(index.documents.size).toBe(0);
      expect(index.avgdl).toBe(0);
    });

    it("should tokenize content correctly", () => {
      const engrams: EngramPayload[] = [
        {
          id: "1",
          codeSnippet: "UserService authentication",
          filePath: "a.ts",
          fileName: "a.ts",
          lineStart: 1,
          lineEnd: 5,
          chunkIndex: 0,
          totalChunks: 1,
          header: "",
          language: "typescript",
          imports: [],
          exports: [],
          docComment: null,
          framework: null,
          keywords: [],
        },
      ];

      const index = createBM25Index(engrams);
      const doc = index.documents.get("1");

      expect(doc?.tokens).toContain("userservice");
      expect(doc?.tokens).toContain("authentication");
    });
  });

  describe("searchBM25", () => {
    it("should rank documents by relevance", () => {
      const engrams: EngramPayload[] = [
        {
          id: "1",
          codeSnippet: "user service authentication login jwt",
          filePath: "a.ts",
          fileName: "a.ts",
          lineStart: 1,
          lineEnd: 5,
          chunkIndex: 0,
          totalChunks: 1,
          header: "",
          language: "typescript",
          imports: [],
          exports: [],
          docComment: null,
          framework: null,
          keywords: [],
        },
        {
          id: "2",
          codeSnippet: "product catalog inventory stock management",
          filePath: "b.ts",
          fileName: "b.ts",
          lineStart: 1,
          lineEnd: 5,
          chunkIndex: 0,
          totalChunks: 1,
          header: "",
          language: "typescript",
          imports: [],
          exports: [],
          docComment: null,
          framework: null,
          keywords: [],
        },
        {
          id: "3",
          codeSnippet: "authentication middleware auth guard jwt token",
          filePath: "c.ts",
          fileName: "c.ts",
          lineStart: 1,
          lineEnd: 5,
          chunkIndex: 0,
          totalChunks: 1,
          header: "",
          language: "typescript",
          imports: [],
          exports: [],
          docComment: null,
          framework: null,
          keywords: [],
        },
      ];

      const index = createBM25Index(engrams);
      const results = searchBM25(index, "authentication jwt", 3);

      expect(results).toHaveLength(3);
      expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
      expect(results[1].score).toBeGreaterThanOrEqual(results[2].score);
      expect(results[0].score).toBeGreaterThan(0);
    });

    it("should return results limited by limit parameter", () => {
      const engrams: EngramPayload[] = [
        {
          id: "1",
          codeSnippet: "test code",
          filePath: "a.ts",
          fileName: "a.ts",
          lineStart: 1,
          lineEnd: 5,
          chunkIndex: 0,
          totalChunks: 1,
          header: "",
          language: "typescript",
          imports: [],
          exports: [],
          docComment: null,
          framework: null,
          keywords: [],
        },
        {
          id: "2",
          codeSnippet: "test code here",
          filePath: "b.ts",
          fileName: "b.ts",
          lineStart: 1,
          lineEnd: 5,
          chunkIndex: 0,
          totalChunks: 1,
          header: "",
          language: "typescript",
          imports: [],
          exports: [],
          docComment: null,
          framework: null,
          keywords: [],
        },
        {
          id: "3",
          codeSnippet: "test code there",
          filePath: "c.ts",
          fileName: "c.ts",
          lineStart: 1,
          lineEnd: 5,
          chunkIndex: 0,
          totalChunks: 1,
          header: "",
          language: "typescript",
          imports: [],
          exports: [],
          docComment: null,
          framework: null,
          keywords: [],
        },
      ];

      const index = createBM25Index(engrams);
      const results = searchBM25(index, "test", 2);

      expect(results).toHaveLength(2);
    });

    it("should handle query with no matching terms", () => {
      const engrams: EngramPayload[] = [
        {
          id: "1",
          codeSnippet: "user authentication",
          filePath: "a.ts",
          fileName: "a.ts",
          lineStart: 1,
          lineEnd: 5,
          chunkIndex: 0,
          totalChunks: 1,
          header: "",
          language: "typescript",
          imports: [],
          exports: [],
          docComment: null,
          framework: null,
          keywords: [],
        },
      ];

      const index = createBM25Index(engrams);
      const results = searchBM25(index, "xyznonexistent", 3);

      expect(results).toHaveLength(1);
      expect(results[0].score).toBe(0);
    });

    it("should score exact matches higher", () => {
      const engrams: EngramPayload[] = [
        {
          id: "1",
          codeSnippet: "user authentication",
          filePath: "a.ts",
          fileName: "a.ts",
          lineStart: 1,
          lineEnd: 5,
          chunkIndex: 0,
          totalChunks: 1,
          header: "",
          language: "typescript",
          imports: [],
          exports: [],
          docComment: null,
          framework: null,
          keywords: [],
        },
        {
          id: "2",
          codeSnippet: "user authentication authentication",
          filePath: "b.ts",
          fileName: "b.ts",
          lineStart: 1,
          lineEnd: 5,
          chunkIndex: 0,
          totalChunks: 1,
          header: "",
          language: "typescript",
          imports: [],
          exports: [],
          docComment: null,
          framework: null,
          keywords: [],
        },
      ];

      const index = createBM25Index(engrams);
      const results = searchBM25(index, "authentication", 2);

      expect(results[0].id).toBe("2");
      expect(results[0].score).toBeGreaterThan(results[1].score);
    });

    it("should handle case insensitive queries", () => {
      const engrams: EngramPayload[] = [
        {
          id: "1",
          codeSnippet: "authentication service login jwt",
          filePath: "a.ts",
          fileName: "a.ts",
          lineStart: 1,
          lineEnd: 5,
          chunkIndex: 0,
          totalChunks: 1,
          header: "",
          language: "typescript",
          imports: [],
          exports: [],
          docComment: null,
          framework: null,
          keywords: [],
        },
      ];

      const index = createBM25Index(engrams);
      const results = searchBM25(index, "AUTHENTICATION JWT", 1);

      expect(results).toHaveLength(1);
      expect(results[0].score).toBeGreaterThan(0);
    });
  });
});
