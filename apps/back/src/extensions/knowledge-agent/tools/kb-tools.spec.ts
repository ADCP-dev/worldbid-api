import { NoteService } from '../note.service';
import { VectorStoreService } from '../infrastructure/vector-store.service';
import { Note } from '../domain/note';
import { createSearchNotesTreeTool } from './search-notes-tree.tool';
import { createSearchNotesSemanticTool } from './search-notes-semantic.tool';
import { createCreateNoteTool } from './create-note.tool';
import { createUpdateNoteTool } from './update-note.tool';
import { createDeleteNoteTool } from './delete-note.tool';

const makeNote = (overrides: Partial<Note> = {}): Note => ({
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
});

describe('KB tools (LangChain tool factories)', () => {
  describe('search_notes_tree', () => {
    it('should call NoteService.findByCategoryPath (global, no userId) and return mapped notes', async () => {
      const noteService = {
        findByCategoryPath: jest.fn().mockResolvedValue([
          makeNote({ id: 'n1', title: 'A', categoryPath: 'tech', tags: ['a'] }),
          makeNote({ id: 'n2', title: 'B', categoryPath: 'tech.notes', tags: ['b'] }),
        ]),
      } as unknown as jest.Mocked<NoteService>;

      const tool = createSearchNotesTreeTool(noteService);
      const result = await tool.invoke({ categoryPath: 'tech', depth: 2 });

      expect(noteService.findByCategoryPath).toHaveBeenCalledWith('tech', 2);
      const parsed = JSON.parse(result as string);
      expect(parsed).toHaveLength(2);
      expect(parsed[0]).toEqual({ id: 'n1', title: 'A', categoryPath: 'tech', tags: ['a'] });
      expect(parsed[1]).toEqual({ id: 'n2', title: 'B', categoryPath: 'tech.notes', tags: ['b'] });
    });

    it('should default depth to 2 when not specified', async () => {
      const noteService = {
        findByCategoryPath: jest.fn().mockResolvedValue([]),
      } as unknown as jest.Mocked<NoteService>;

      const tool = createSearchNotesTreeTool(noteService);
      await tool.invoke({ categoryPath: 'tech' });

      expect(noteService.findByCategoryPath).toHaveBeenCalledWith('tech', 2);
    });

    it('should have name search_notes_tree and a description', () => {
      const noteService = {} as unknown as jest.Mocked<NoteService>;
      const tool = createSearchNotesTreeTool(noteService);
      expect(tool.name).toBe('search_notes_tree');
      expect(tool.description.length).toBeGreaterThan(10);
    });
  });

  describe('search_notes_semantic', () => {
    const makeNoteService = () =>
      ({
        keywordSearch: jest.fn().mockResolvedValue([]),
      }) as unknown as jest.Mocked<NoteService>;

    it('should call VectorStoreService.similaritySearch and return hits', async () => {
      const hits = [
        [{ content: 'note A', metadata: { id: 'n1' } }, 0.12],
        [{ content: 'note B', metadata: { id: 'n2' } }, 0.34],
      ];
      const vectorStoreService = {
        similaritySearch: jest.fn().mockResolvedValue(hits),
      } as unknown as jest.Mocked<VectorStoreService>;

      const tool = createSearchNotesSemanticTool(vectorStoreService, makeNoteService());
      const result = await tool.invoke({ query: 'search text', topK: 5 });

      expect(vectorStoreService.similaritySearch).toHaveBeenCalledWith('search text', 5);
      expect(JSON.parse(result as string)).toEqual(hits);
    });

    it('should default topK to 5 when not specified', async () => {
      const vectorStoreService = {
        similaritySearch: jest.fn().mockResolvedValue([]),
      } as unknown as jest.Mocked<VectorStoreService>;

      const tool = createSearchNotesSemanticTool(vectorStoreService, makeNoteService());
      await tool.invoke({ query: 'text' });

      expect(vectorStoreService.similaritySearch).toHaveBeenCalledWith('text', 5);
    });

    it('should fall back to keyword search when the vector store returns nothing', async () => {
      const vectorStoreService = {
        similaritySearch: jest.fn().mockResolvedValue([]),
      } as unknown as jest.Mocked<VectorStoreService>;
      const keywordHits = [
        {
          id: 'n9',
          title: 'Empresa',
          categoryPath: 'empresa',
          tags: [],
          snippet: 'La empresa…',
        },
      ];
      const noteService = {
        keywordSearch: jest.fn().mockResolvedValue(keywordHits),
      } as unknown as jest.Mocked<NoteService>;

      const tool = createSearchNotesSemanticTool(vectorStoreService, noteService);
      const result = await tool.invoke({ query: 'empresa', topK: 5 });

      expect(noteService.keywordSearch).toHaveBeenCalledWith('empresa', 5);
      const parsed = JSON.parse(result as string);
      expect(parsed).toHaveLength(1);
      expect(parsed[0]).toMatchObject({ id: 'n9', source: 'keyword' });
    });

    it('should have name search_notes_semantic and a description', () => {
      const vectorStoreService = {} as unknown as jest.Mocked<VectorStoreService>;
      const tool = createSearchNotesSemanticTool(vectorStoreService, makeNoteService());
      expect(tool.name).toBe('search_notes_semantic');
      expect(tool.description.length).toBeGreaterThan(10);
    });
  });

  describe('create_note', () => {
    it('should call NoteService.create and return the note id (no userId scoping)', async () => {
      const created = makeNote({ id: 'new-1' });
      const noteService = {
        create: jest.fn().mockResolvedValue(created),
      } as unknown as jest.Mocked<NoteService>;

      const tool = createCreateNoteTool(noteService);
      const result = await tool.invoke({
        title: 'My Note',
        contentMd: 'content',
        categoryPath: 'tech',
        tags: ['a', 'b'],
      });

      expect(noteService.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'My Note', contentMd: 'content' }),
      );
      expect(noteService.create).toHaveBeenCalledWith(
        expect.not.objectContaining({ userId: expect.any(Number) }),
      );
      const parsed = JSON.parse(result as string);
      expect(parsed).toEqual({ id: 'new-1', success: true });
    });

    it('should error if title is empty', async () => {
      const noteService = {
        create: jest.fn(),
      } as unknown as jest.Mocked<NoteService>;
      const tool = createCreateNoteTool(noteService);

      await expect(tool.invoke({ title: '', contentMd: 'x' })).rejects.toThrow();
      expect(noteService.create).not.toHaveBeenCalled();
    });

    it('should error if contentMd is empty', async () => {
      const noteService = {
        create: jest.fn(),
      } as unknown as jest.Mocked<NoteService>;
      const tool = createCreateNoteTool(noteService);

      await expect(tool.invoke({ title: 'X', contentMd: '' })).rejects.toThrow();
    });

    it('should have name create_note and a description', () => {
      const noteService = {} as unknown as jest.Mocked<NoteService>;
      const tool = createCreateNoteTool(noteService);
      expect(tool.name).toBe('create_note');
      expect(tool.description.length).toBeGreaterThan(10);
    });
  });

  describe('update_note', () => {
    it('should call NoteService.update and return success', async () => {
      const updated = makeNote({ id: 'n1', contentMd: 'new' });
      const noteService = {
        update: jest.fn().mockResolvedValue(updated),
      } as unknown as jest.Mocked<NoteService>;

      const tool = createUpdateNoteTool(noteService);
      const result = await tool.invoke({ id: 'n1', contentMd: 'new' });

      expect(noteService.update).toHaveBeenCalledWith('n1', { contentMd: 'new' });
      const parsed = JSON.parse(result as string);
      expect(parsed).toEqual({ id: 'n1', success: true });
    });

    it('should error if id is empty', async () => {
      const noteService = {} as unknown as jest.Mocked<NoteService>;
      const tool = createUpdateNoteTool(noteService);

      await expect(tool.invoke({ id: '' })).rejects.toThrow();
    });

    it('should have name update_note and a description', () => {
      const noteService = {} as unknown as jest.Mocked<NoteService>;
      const tool = createUpdateNoteTool(noteService);
      expect(tool.name).toBe('update_note');
      expect(tool.description.length).toBeGreaterThan(10);
    });
  });

  describe('delete_note', () => {
    it('should call NoteService.softDelete and return success (no userId)', async () => {
      const noteService = {
        softDelete: jest.fn().mockResolvedValue(undefined),
      } as unknown as jest.Mocked<NoteService>;

      const tool = createDeleteNoteTool(noteService);
      const result = await tool.invoke({ id: 'n1' });

      expect(noteService.softDelete).toHaveBeenCalledWith('n1');
      const parsed = JSON.parse(result as string);
      expect(parsed).toEqual({ id: 'n1', success: true });
    });

    it('should error if note does not exist', async () => {
      const notFound = new Error('Note not found');
      const noteService = {
        softDelete: jest.fn().mockRejectedValue(notFound),
      } as unknown as jest.Mocked<NoteService>;

      const tool = createDeleteNoteTool(noteService);

      await expect(tool.invoke({ id: 'missing' })).rejects.toThrow();
    });

    it('should error if id is empty', async () => {
      const noteService = {} as unknown as jest.Mocked<NoteService>;
      const tool = createDeleteNoteTool(noteService);

      await expect(tool.invoke({ id: '' })).rejects.toThrow();
    });

    it('should have name delete_note and a description', () => {
      const noteService = {} as unknown as jest.Mocked<NoteService>;
      const tool = createDeleteNoteTool(noteService);
      expect(tool.name).toBe('delete_note');
      expect(tool.description.length).toBeGreaterThan(10);
    });
  });
});