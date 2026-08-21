import { registerAs } from '@nestjs/config';

export default registerAs('ka', () => {
  return {
    embeddingDimension: Number(process.env.KA_EMBEDDING_DIM ?? 1536),
    embeddingModel: process.env.KA_EMBEDDING_MODEL ?? 'nomic-embed-text',
    ollamaBaseUrl: process.env.KA_OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434',
  };
});