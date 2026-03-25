import type { EngramMetadata } from "../types.js";

export function parseMarkdown(
  content: string,
  filePath: string,
): EngramMetadata {
  return {
    language: "markdown",
    imports: [],
    exports: [],
    docComment:
      extractFrontmatterTitle(content) || extractFirstHeading(content),
    framework: detectDocFramework(content),
    keywords: extractMarkdownKeywords(content),
  };
}

function extractFrontmatterTitle(content: string): string | null {
  const match = content.match(/^---\n[\s\S]*?title:\s*(.+)\n[\s\S]*?---/);
  return match ? match[1].trim().replace(/^["']|["']$/g, "") : null;
}

function extractFirstHeading(content: string): string | null {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

function detectDocFramework(content: string): string | null {
  if (content.includes("nestjs") || content.includes("NestJS")) return "nestjs";
  if (content.includes("vue") || content.includes("Vue")) return "vue";
  if (content.includes("react") || content.includes("React")) return "react";
  return null;
}

function extractMarkdownKeywords(content: string): string[] {
  const regex = /#+\s*([^\n]+)/g;
  const headings: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    const words = match[1].split(/\s+/).filter((w) => w.length > 3);
    headings.push(...words);
  }
  const codeBlocks = content.match(/```\w*\n([\s\S]*?)```/g) || [];
  const codeWords: string[] = [];
  for (const block of codeBlocks) {
    const words = block.match(/\b[a-zA-Z]{4,}\b/g) || [];
    codeWords.push(...words);
  }
  return [...new Set([...headings, ...codeWords])];
}
