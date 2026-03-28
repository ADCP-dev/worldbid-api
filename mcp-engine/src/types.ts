export interface EngramContent {
  content: string;
  lineStart: number;
  lineEnd: number;
  header: string;
  chunkIndex: number;
  totalChunks: number;
}

export interface EngramMetadata {
  language: string;
  imports: string[];
  exports: string[];
  docComment: string | null;
  framework: string | null;
  keywords: string[];
}

export interface EngramPayload {
  id: string;
  filePath: string;
  fileName: string;
  lineStart: number;
  lineEnd: number;
  chunkIndex: number;
  totalChunks: number;
  codeSnippet: string;
  header: string;
  language: string;
  imports: string[];
  exports: string[];
  docComment: string | null;
  framework: string | null;
  keywords: string[];
  [key: string]: unknown;
}

export interface EngramSearchResult {
  id: string;
  score: number;
  combinedScore?: number;
  payload: EngramPayload;
}

export interface IndexerOptions {
  forceReindex?: boolean;
  dryRun?: boolean;
}

export interface SearchOptions {
  query: string;
  limit?: number;
  fileTypes?: string[];
  frameworks?: string[];
  minScore?: number;
  alpha?: number;
}

export interface BM25Result {
  id: string;
  score: number;
}

export type CliCommand = "index" | "delete" | "list";
