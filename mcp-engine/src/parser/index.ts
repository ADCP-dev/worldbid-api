import type { EngramMetadata } from "../types.js";
import { parseTypeScript } from "./typescript.js";
import { parseMarkdown } from "./markdown.js";

export { parseTypeScript, parseMarkdown };

export function parseFile(content: string, filePath: string): EngramMetadata {
  const ext = filePath.split(".").pop()?.toLowerCase();

  if (ext === "md") {
    return parseMarkdown(content, filePath);
  }

  return parseTypeScript(content, filePath);
}
