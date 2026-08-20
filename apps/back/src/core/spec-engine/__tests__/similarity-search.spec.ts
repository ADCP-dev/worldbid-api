/**
 * TDD tests for SimilaritySearch helper (PRD 06).
 *
 * REQ-11: similaritySearch uses QueryBuilder with <=> cosine operator.
 */
import { describe, it, expect, vi } from 'vitest';
import { similaritySearch } from '@src/core/spec-engine/similarity-search';

function makeQueryBuilderMock(rawResult: Array<{ similarity: number }> = []) {
  const chain: any = {
    addSelect: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    setParameter: vi.fn().mockReturnThis(),
    getRawAndEntities: vi.fn().mockResolvedValue({
      raw: rawResult,
      entities: rawResult.map((_, i) => ({ id: i + 1 })),
    }),
  };
  return chain;
}

function makeRepoMock(qb: any) {
  const metadata = { name: 'kb-article' };
  return {
    metadata,
    createQueryBuilder: vi.fn().mockReturnValue(qb),
  } as any;
}

describe('similaritySearch (PRD 06 — REQ-11)', () => {
  it('should build a QueryBuilder with cosine distance operator <=>', async () => {
    const qb = makeQueryBuilderMock([{ similarity: 0.95 }]);
    const repo = makeRepoMock(qb);

    await similaritySearch(repo as any, 'embedding', [0.1, 0.2], 5);

    expect(repo.createQueryBuilder).toHaveBeenCalledWith('kb-article');
    expect(qb.addSelect).toHaveBeenCalledWith(
      '1 - (kb-article.embedding <=> vector(:embedding))',
      'similarity',
    );
  });

  it('should filter where embedding IS NOT NULL', async () => {
    const qb = makeQueryBuilderMock([{ similarity: 0.9 }]);
    const repo = makeRepoMock(qb);

    await similaritySearch(repo as any, 'embedding', [0.1], 5);

    expect(qb.where).toHaveBeenCalledWith('kb-article.embedding IS NOT NULL');
  });

  it('should order by cosine distance', async () => {
    const qb = makeQueryBuilderMock([{ similarity: 0.9 }]);
    const repo = makeRepoMock(qb);

    await similaritySearch(repo as any, 'embedding', [0.1], 5);

    expect(qb.orderBy).toHaveBeenCalledWith(
      'kb-article.embedding <=> vector(:embedding)',
    );
  });

  it('should set embedding parameter as pgvector string', async () => {
    const qb = makeQueryBuilderMock([{ similarity: 0.9 }]);
    const repo = makeRepoMock(qb);

    await similaritySearch(repo as any, 'embedding', [0.1, 0.2, 0.3], 5);

    expect(qb.setParameter).toHaveBeenCalledWith('embedding', '[0.1,0.2,0.3]');
  });

  it('should apply limit', async () => {
    const qb = makeQueryBuilderMock([{ similarity: 0.9 }]);
    const repo = makeRepoMock(qb);

    await similaritySearch(repo as any, 'embedding', [0.1], 10);

    expect(qb.limit).toHaveBeenCalledWith(10);
  });

  it('should default limit to 5', async () => {
    const qb = makeQueryBuilderMock([{ similarity: 0.9 }]);
    const repo = makeRepoMock(qb);

    await similaritySearch(repo as any, 'embedding', [0.1]);

    expect(qb.limit).toHaveBeenCalledWith(5);
  });

  it('should return entities with similarity scores', async () => {
    const qb = makeQueryBuilderMock([
      { similarity: 0.95 },
      { similarity: 0.80 },
    ]);
    const repo = makeRepoMock(qb);

    const results = await similaritySearch(repo as any, 'embedding', [0.1], 5);

    expect(results).toHaveLength(2);
    expect(results[0].similarity).toBe(0.95);
    expect(results[0].entity).toEqual({ id: 1 });
    expect(results[1].similarity).toBe(0.80);
    expect(results[1].entity).toEqual({ id: 2 });
  });

  it('should use getRawAndEntities (not getMany)', async () => {
    const qb = makeQueryBuilderMock([{ similarity: 0.9 }]);
    const repo = makeRepoMock(qb);

    await similaritySearch(repo as any, 'embedding', [0.1], 5);

    expect(qb.getRawAndEntities).toHaveBeenCalled();
  });

  it('should handle empty results', async () => {
    const qb = makeQueryBuilderMock([]);
    const repo = makeRepoMock(qb);

    const results = await similaritySearch(repo as any, 'embedding', [0.1], 5);

    expect(results).toEqual([]);
  });
});