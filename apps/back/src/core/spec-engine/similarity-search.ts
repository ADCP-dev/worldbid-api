/**
 * SimilaritySearch — pgvector cosine similarity search helper (PRD 06).
 *
 * Uses TypeORM QueryBuilder with raw SQL for the pgvector `<=>` cosine
 * distance operator (not recognized by QueryBuilder natively). Returns
 * entities ranked by similarity (1 - distance).
 *
 * Requires the pgvector extension and a vector column with an HNSW or
 * IVFFlat index for acceptable performance.
 */
import type { Repository, ObjectLiteral } from 'typeorm';

export interface SimilarityResult<T> {
  entity: T;
  similarity: number;
}

/**
 * Perform a cosine similarity search on a vector column.
 *
 * @param repo       TypeORM repository for the entity
 * @param field      Name of the vector column
 * @param embedding  Query embedding (number array)
 * @param limit      Max results (default 5)
 * @returns          Array of { entity, similarity } sorted by most similar first
 */
export function similaritySearch<T extends ObjectLiteral = Record<string, unknown>>(
  repo: Repository<T>,
  field: string,
  embedding: number[],
  limit = 5,
): Promise<SimilarityResult<T>[]> {
  const embeddingStr = `[${embedding.join(',')}]`;
  const alias = repo.metadata.name;

  return repo
    .createQueryBuilder(alias)
    .addSelect(`1 - (${alias}.${field} <=> vector(:embedding))`, 'similarity')
    .where(`${alias}.${field} IS NOT NULL`)
    .orderBy(`${alias}.${field} <=> vector(:embedding)`)
    .limit(limit)
    .setParameter('embedding', embeddingStr)
    .getRawAndEntities()
    .then(({ entities, raw }) =>
      entities.map((entity, i) => ({
        entity,
        similarity: Number((raw[i] as { similarity?: unknown })?.similarity ?? 0),
      })),
    );
}