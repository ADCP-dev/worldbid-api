export interface ChunkResult {
  id: string;
  filePath: string;
  codeSnippet: string;
}

export interface IndexerOptions {
  forceReindex?: boolean;
  dryRun?: boolean;
}

export type CliCommand = "index" | "delete" | "list";
