import { Injectable, Logger } from '@nestjs/common';
import { NoteService } from '../note.service';
import { VectorStoreService } from './vector-store.service';
import type { Note } from '../domain/note';

/**
 * RagService — single entry point for retrieval-augmented generation queries.
 *
 * Wraps the two retrieval primitives exposed by the extension:
 *   - `tree`     → NoteService.findByCategoryPath (hierarchical lookup)
 *   - `semantic` → VectorStoreService.similaritySearch (pgvector cosine)
 *   - `hybrid`   → both, merged + deduped by note id
 *
 * The hybrid strategy runs both retrievals in parallel, then deduplicates notes
 * that appear in both result sets (keeping the tree occurrence first since
 * tree hits are deterministic by path). This keeps the caller (agent tool,
 * future RAG orchestrator) free from merge/dedup logic.
 *
 * NOTE: the semantic results come back as `[document, score][]` tuples from
 * PGVectorStore. We normalize them to a `RagHit` shape so the caller has a
 * single contract regardless of strategy.
 */
@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  constructor(
    private readonly noteService: NoteService,
    private readonly vectorStoreService: VectorStoreService,
  ) {}

  /**
   * Run a retrieval query using the given strategy.
   *
   * @param query          Natural-language query (ignored by `tree`).
   * @param strategy       `tree` | `semantic` | `hybrid`.
   * @param options        `categoryPath` + `depth` for tree; `topK` for semantic;
   *                       `userId` is REQUIRED for tree + hybrid (scoping).
   */
  async search(
    query: string,
    strategy: 'tree' | 'semantic' | 'hybrid',
    options: {
      categoryPath?: string;
      depth?: number;
      topK?: number;
      userId?: number;
    } = {},
  ): Promise<RagHit[]> {
    this.logger.debug(
      `RAG search strategy=${strategy} query="${query.slice(0, 60)}" opts=${JSON.stringify(options)}`,
    );

    if (strategy === 'tree') {
      return this.searchTree(options);
    }
    if (strategy === 'semantic') {
      return this.searchSemantic(query, options);
    }
    // hybrid
    if (options.userId === undefined) {
      throw new Error('RagService hybrid search requires userId');
    }
    const [treeResults, semanticResults] = await Promise.all([
      this.searchTree(options),
      this.searchSemantic(query, options),
    ]);
    return this.mergeResults(treeResults, semanticResults);
  }

  private async searchTree(options: {
    categoryPath?: string;
    depth?: number;
    userId?: number;
  }): Promise<RagHit[]> {
    if (options.userId === undefined) {
      throw new Error('RagService tree search requires userId');
    }
    if (!options.categoryPath) {
      throw new Error('RagService tree search requires categoryPath');
    }
    const notes = await this.noteService.findByCategoryPath(
      options.userId,
      options.categoryPath,
      options.depth ?? 0,
    );
    return notes.map((n) => this.fromNote(n, 'tree'));
  }

  private async searchSemantic(
    query: string,
    options: { topK?: number },
  ): Promise<RagHit[]> {
    const hits = (await this.vectorStoreService.similaritySearch(
      query,
      options.topK ?? 5,
    )) as unknown[];
    return (hits as Array<[unknown, number]>).map((h) =>
      this.fromSemanticTuple(h),
    );
  }

  /**
   * Merge tree + semantic results, deduplicating by note id. Tree hits come
   * first (deterministic path match); semantic hits that are NOT already
   * present are appended in score order.
   */
  private mergeResults(
    treeResults: RagHit[],
    semanticResults: RagHit[],
  ): RagHit[] {
    const seen = new Set<string>();
    const merged: RagHit[] = [];
    for (const hit of treeResults) {
      if (hit.id && !seen.has(hit.id)) {
        seen.add(hit.id);
        merged.push(hit);
      }
    }
    for (const hit of semanticResults) {
      if (hit.id && !seen.has(hit.id)) {
        seen.add(hit.id);
        merged.push(hit);
      }
    }
    return merged;
  }

  private fromNote(note: Note, source: 'tree'): RagHit {
    return {
      id: note.id,
      title: note.title,
      contentMd: note.contentMd,
      categoryPath: note.categoryPath,
      tags: note.tags,
      score: null,
      source,
    };
  }

  private fromSemanticTuple(tuple: [unknown, number]): RagHit {
    const [doc, score] = tuple as [
      { content?: string; metadata?: { id?: string; title?: string } },
      number,
    ];
    return {
      id: doc?.metadata?.id ?? null,
      title: doc?.metadata?.title ?? null,
      contentMd: doc?.content ?? null,
      categoryPath: null,
      tags: [],
      score,
      source: 'semantic',
    };
  }
}

export interface RagHit {
  id: string | null;
  title: string | null;
  contentMd: string | null;
  categoryPath: string | null;
  tags: string[];
  score: number | null;
  source: 'tree' | 'semantic';
}