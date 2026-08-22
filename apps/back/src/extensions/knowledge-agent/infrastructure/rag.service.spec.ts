import { Test, TestingModule } from '@nestjs/testing';
import { RagService } from './rag.service';
import { NoteService } from '../note.service';
import { VectorStoreService } from './vector-store.service';
import { Note } from '../domain/note';

const makeNote = (overrides: Partial<Note> = {}): Note =>
  ({
    id: 'note-1',
    title: 'Test Note',
    contentMd: '# Hello',
    categoryPath: 'tech.notes',
    tags: ['x'],
    frontmatter: { okf_version: '1.0', type: 'note', generated: false },
    embedding: null,
    userId: 1,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    deletedAt: null,
    ...overrides,
  }) as Note;

describe('RagService', () => {
  let service: RagService;
  let noteService: jest.Mocked<NoteService>;
  let vectorStoreService: jest.Mocked<VectorStoreService>;

  beforeEach(async () => {
    const noteServiceMock = {
      findByCategoryPath: jest.fn(),
    };
    const vectorStoreServiceMock = {
      similaritySearch: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RagService,
        { provide: NoteService, useValue: noteServiceMock },
        { provide: VectorStoreService, useValue: vectorStoreServiceMock },
      ],
    }).compile();

    service = module.get<RagService>(RagService);
    noteService = module.get(NoteService) as jest.Mocked<NoteService>;
    vectorStoreService = module.get(
      VectorStoreService,
    ) as jest.Mocked<VectorStoreService>;
  });

  afterEach(() => jest.clearAllMocks());

  describe('tree strategy', () => {
    it('should call NoteService.findByCategoryPath (no userId) and return mapped RagHits', async () => {
      const notes = [
        makeNote({ id: 'n1', title: 'A', categoryPath: 'tech', tags: ['a'] }),
        makeNote({ id: 'n2', title: 'B', categoryPath: 'tech.notes', tags: ['b'] }),
      ];
      noteService.findByCategoryPath.mockResolvedValue(notes);

      const result = await service.search('', 'tree', {
        categoryPath: 'tech',
        depth: 2,
      });

      expect(noteService.findByCategoryPath).toHaveBeenCalledWith('tech', 2);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'n1',
        title: 'A',
        contentMd: '# Hello',
        categoryPath: 'tech',
        tags: ['a'],
        score: null,
        source: 'tree',
      });
      expect(result[1].source).toBe('tree');
    });

    it('should default depth to 0 when not specified', async () => {
      noteService.findByCategoryPath.mockResolvedValue([]);

      await service.search('', 'tree', { categoryPath: 'tech' });

      expect(noteService.findByCategoryPath).toHaveBeenCalledWith('tech', 0);
    });

    it('should throw if categoryPath is missing', async () => {
      await expect(
        service.search('', 'tree', {}),
      ).rejects.toThrow('requires categoryPath');
    });
  });

  describe('semantic strategy', () => {
    it('should call VectorStoreService.similaritySearch and normalize tuples', async () => {
      const hits = [
        [{ content: 'note A', metadata: { id: 'n1', title: 'A' } }, 0.12],
        [{ content: 'note B', metadata: { id: 'n2', title: 'B' } }, 0.34],
      ];
      vectorStoreService.similaritySearch.mockResolvedValue(hits);

      const result = await service.search('query text', 'semantic', { topK: 3 });

      expect(vectorStoreService.similaritySearch).toHaveBeenCalledWith('query text', 3);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'n1',
        title: 'A',
        contentMd: 'note A',
        categoryPath: null,
        tags: [],
        score: 0.12,
        source: 'semantic',
      });
      expect(result[1].source).toBe('semantic');
    });

    it('should default topK to 5 when not specified', async () => {
      vectorStoreService.similaritySearch.mockResolvedValue([]);

      await service.search('text', 'semantic');

      expect(vectorStoreService.similaritySearch).toHaveBeenCalledWith('text', 5);
    });

    it('should handle hits without metadata gracefully', async () => {
      const hits = [[{ content: 'orphan' }, 0.5]];
      vectorStoreService.similaritySearch.mockResolvedValue(hits);

      const result = await service.search('text', 'semantic');

      expect(result[0].id).toBeNull();
      expect(result[0].title).toBeNull();
      expect(result[0].contentMd).toBe('orphan');
    });
  });

  describe('hybrid strategy', () => {
    it('should run tree + semantic in parallel and merge (no userId needed)', async () => {
      noteService.findByCategoryPath.mockResolvedValue([
        makeNote({ id: 'n1', title: 'Tree A', categoryPath: 'tech' }),
        makeNote({ id: 'n2', title: 'Tree B', categoryPath: 'tech.notes' }),
      ]);
      const semanticHits = [
        [{ content: 'note C', metadata: { id: 'n3', title: 'Sem C' } }, 0.1],
      ];
      vectorStoreService.similaritySearch.mockResolvedValue(semanticHits);

      const result = await service.search('concept', 'hybrid', {
        categoryPath: 'tech',
        depth: 1,
        topK: 5,
      });

      expect(noteService.findByCategoryPath).toHaveBeenCalledWith('tech', 1);
      expect(vectorStoreService.similaritySearch).toHaveBeenCalledWith('concept', 5);
      expect(result).toHaveLength(3);
      // Tree hits first, semantic appended after.
      expect(result.map((r) => r.id)).toEqual(['n1', 'n2', 'n3']);
    });

    it('should dedupe by note id when the same note appears in both', async () => {
      // n1 appears in both tree and semantic results.
      noteService.findByCategoryPath.mockResolvedValue([
        makeNote({ id: 'n1', title: 'Tree A', categoryPath: 'tech' }),
        makeNote({ id: 'n2', title: 'Tree B', categoryPath: 'tech.notes' }),
      ]);
      const semanticHits = [
        [{ content: 'note A dup', metadata: { id: 'n1', title: 'Sem A dup' } }, 0.05],
        [{ content: 'note C', metadata: { id: 'n3', title: 'Sem C' } }, 0.2],
      ];
      vectorStoreService.similaritySearch.mockResolvedValue(semanticHits);

      const result = await service.search('concept', 'hybrid', {
        categoryPath: 'tech',
      });

      expect(result).toHaveLength(3);
      // n1 from tree kept (first occurrence), n1 from semantic dropped.
      expect(result.map((r) => r.id)).toEqual(['n1', 'n2', 'n3']);
      // The tree entry retains its tree source.
      expect(result[0].source).toBe('tree');
      expect(result[0].title).toBe('Tree A');
    });

    it('should return only tree results when semantic returns empty', async () => {
      noteService.findByCategoryPath.mockResolvedValue([
        makeNote({ id: 'n1', title: 'Tree A', categoryPath: 'tech' }),
      ]);
      vectorStoreService.similaritySearch.mockResolvedValue([]);

      const result = await service.search('concept', 'hybrid', {
        categoryPath: 'tech',
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('n1');
      expect(result[0].source).toBe('tree');
    });

    it('should return only semantic results when tree returns empty', async () => {
      noteService.findByCategoryPath.mockResolvedValue([]);
      const semanticHits = [
        [{ content: 'note C', metadata: { id: 'n3' } }, 0.1],
      ];
      vectorStoreService.similaritySearch.mockResolvedValue(semanticHits);

      const result = await service.search('concept', 'hybrid', {
        categoryPath: 'tech',
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('n3');
      expect(result[0].source).toBe('semantic');
    });
  });
});