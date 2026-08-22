import { registerAs } from '@nestjs/config';

export default registerAs('ka', () => {
  return {
    embeddingDimension: Number(process.env.KA_EMBEDDING_DIM ?? 1536),
    embeddingModel: process.env.KA_EMBEDDING_MODEL ?? 'nomic-embed-text',
    ollamaBaseUrl: process.env.KA_OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434',
    // Sandbox JS eval engine: 'quickjs' (default, WASM) or 'vm' (Node vm fallback).
    sandbox: {
      engine: process.env.KA_SANDBOX_ENGINE === 'vm' ? 'vm' : 'quickjs',
    },
    // Local McpModule HTTP endpoint for the agent runtime to introspect its own tools.
    localMcpUrl:
      process.env.KA_LOCAL_MCP_URL ??
      'http://localhost:3000/api/v1/_mcp/tools',
  };
});