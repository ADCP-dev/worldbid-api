import type { EngramMetadata } from "../types.js";

export function parseTypeScript(
  content: string,
  filePath: string,
): EngramMetadata {
  return {
    language: detectLanguage(filePath),
    imports: extractImports(content),
    exports: extractNamedExports(content),
    docComment: extractLeadingDocComment(content),
    framework: detectFramework(content, filePath),
    keywords: extractKeywords(content),
  };
}

function detectLanguage(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    vue: "vue",
    js: "javascript",
    jsx: "javascript",
    md: "markdown",
    json: "json",
  };
  return languageMap[ext || ""] || "unknown";
}

function extractImports(content: string): string[] {
  const regex =
    /import\s+(?:{[^}]+}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g;
  const imports: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  return imports;
}

function extractNamedExports(content: string): string[] {
  const regex =
    /(?:export|declare)\s+(?:abstract\s+)?(?:class|interface|type|enum|function|const|var|let)\s+(\w+)/g;
  const exports: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    exports.push(match[1]);
  }
  return exports;
}

function extractLeadingDocComment(content: string): string | null {
  const match = content.match(/^\s*\/\*\*[\s\S]*?\*\//);
  return match ? match[0].replace(/\s*\*\s*/g, " ").trim() : null;
}

function detectFramework(content: string, filePath: string): string | null {
  if (filePath.endsWith(".vue")) return "vue";
  if (content.includes("@Injectable()") || content.includes("@Injectable({"))
    return "nestjs";
  if (content.includes("@Module({") || content.includes("@Module("))
    return "nestjs";
  if (content.includes("@Component") || content.includes("defineComponent"))
    return "vue";
  if (
    content.includes("@Inject(") ||
    content.includes("@Res(") ||
    content.includes("@Req(")
  )
    return "nestjs";
  return null;
}

function extractKeywords(content: string): string[] {
  const regex = /\b[a-zA-Z][a-zA-Z0-9]{3,}\b/g;
  const words = content.match(regex) || [];
  const stopWords = new Set([
    "function",
    "class",
    "const",
    "export",
    "import",
    "return",
    "interface",
    "type",
    "enum",
    "async",
    "await",
    "public",
    "private",
    "protected",
    "static",
    "readonly",
    "extends",
    "implements",
    "abstract",
    "override",
    "default",
    "delete",
    "typeof",
    "instanceof",
    "new",
    "this",
    "super",
    "void",
    "never",
    "any",
    "unknown",
    "string",
    "number",
    "boolean",
    "object",
    "array",
    "promise",
    "callback",
    "error",
    "true",
    "false",
    "null",
    "undefined",
    "then",
    "catch",
    "finally",
    "params",
    "args",
    "options",
    "config",
    "data",
    "result",
  ]);
  return [...new Set(words.filter((w) => !stopWords.has(w)))];
}
