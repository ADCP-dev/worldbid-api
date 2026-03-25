import { describe, it, expect } from "vitest";
import path from "path";

interface EngramContent {
  content: string;
  lineStart: number;
  lineEnd: number;
  header: string;
  chunkIndex: number;
  totalChunks: number;
}

function segmentIntoEngrams(
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

function generateStableId(relativePath: string, chunkIndex: number): string {
  const crypto = require("crypto");
  const hash = crypto
    .createHash("sha256")
    .update(`${relativePath}:${chunkIndex}`)
    .digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

describe("segmentIntoEngrams", () => {
  it("should not split small files", () => {
    const content = "line1\nline2\nline3";
    const engrams = segmentIntoEngrams(content, "test.ts");

    expect(engrams).toHaveLength(1);
    expect(engrams[0].lineStart).toBe(1);
    expect(engrams[0].lineEnd).toBe(3);
    expect(engrams[0].totalChunks).toBe(1);
  });

  it("should not split files with exactly 400 lines", () => {
    const lines = Array.from({ length: 400 }, (_, i) => `line ${i + 1}`);
    const content = lines.join("\n");
    const engrams = segmentIntoEngrams(content, "test.ts");

    expect(engrams).toHaveLength(1);
    expect(engrams[0].lineStart).toBe(1);
    expect(engrams[0].lineEnd).toBe(400);
  });

  it("should add header with file path and line numbers", () => {
    const lines = Array.from({ length: 500 }, (_, i) => `line ${i + 1}`);
    const content = lines.join("\n");
    const engrams = segmentIntoEngrams(content, "auth/service.ts");

    expect(engrams).toHaveLength(4);
    expect(engrams[0].header).toContain("service.ts:1-150");
    expect(engrams[1].header).toContain("service.ts:151-300");
    expect(engrams[0].content).toContain("// service.ts:1-150");
  });

  it("should calculate correct totalChunks", () => {
    const lines = Array.from({ length: 500 }, (_, i) => `line ${i + 1}`);
    const content = lines.join("\n");
    const engrams = segmentIntoEngrams(content, "test.ts");

    expect(engrams).toHaveLength(4);
    engrams.forEach((e) => expect(e.totalChunks).toBe(4));
  });

  it("should split at boundary over 400 lines", () => {
    const lines = Array.from({ length: 451 }, (_, i) => `line ${i + 1}`);
    const content = lines.join("\n");
    const engrams = segmentIntoEngrams(content, "test.ts");

    expect(engrams).toHaveLength(4);
    expect(engrams[0].lineEnd).toBe(150);
    expect(engrams[1].lineStart).toBe(151);
    expect(engrams[1].lineEnd).toBe(300);
    expect(engrams[3].lineStart).toBe(451);
    expect(engrams[3].lineEnd).toBe(451);
  });

  it("should include file context in content", () => {
    const content = "const x = 1;";
    const engrams = segmentIntoEngrams(content, "src/test.ts");

    expect(engrams[0].content).toContain("// src/test.ts");
    expect(engrams[0].content).toContain("const x = 1;");
  });
});

describe("generateStableId", () => {
  it("should generate same ID for same path and index", () => {
    const id1 = generateStableId("src/foo.ts", 0);
    const id2 = generateStableId("src/foo.ts", 0);

    expect(id1).toBe(id2);
  });

  it("should generate different ID for different chunks", () => {
    const id1 = generateStableId("src/foo.ts", 0);
    const id2 = generateStableId("src/foo.ts", 1);

    expect(id1).not.toBe(id2);
  });

  it("should generate different ID for different files", () => {
    const id1 = generateStableId("src/foo.ts", 0);
    const id2 = generateStableId("src/bar.ts", 0);

    expect(id1).not.toBe(id2);
  });

  it("should have correct UUID format", () => {
    const id = generateStableId("src/test.ts", 0);

    expect(id).toMatch(
      /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/,
    );
  });
});
