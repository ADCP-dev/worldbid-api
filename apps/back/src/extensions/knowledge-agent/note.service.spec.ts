import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { NotFoundException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { NoteService } from './note.service';
import { NoteRepository } from './infrastructure/note.repository';
import { Note } from './domain/note';

describe('NoteService', () => {
  let service: NoteService;
  let repository: jest.Mocked<NoteRepository>;
  let embeddingQueue: jest.Mocked<Queue>;

  const mockRepository = {
    create: jest.fn(),
    findById: jest.fn(),
    findAll: jest.fn(),
    findByCategoryPath: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    upsertLinks: jest.fn().mockResolvedValue(undefined),
    replaceLinks: jest.fn().mockResolvedValue(undefined),
    findBacklinks: jest.fn(),
    findNotesContainingWikilinks: jest.fn().mockResolvedValue([]),
  };

  const mockQueue = {
    add: jest.fn().mockResolvedValue({ id: 'job-1' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NoteService,
        { provide: NoteRepository, useValue: mockRepository },
        { provide: getQueueToken('ka-embedding'), useValue: mockQueue },
      ],
    }).compile();

    service = module.get<NoteService>(NoteService);
    repository = module.get(NoteRepository);
    embeddingQueue = module.get(
      getQueueToken('ka-embedding'),
    ) as unknown as jest.Mocked<Queue>;
  });

  // Drain pending microtasks from fire-and-forget work (forward-reference
  // resolution) so background writes never bleed into the next test.
  afterEach(async () => {
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    jest.clearAllMocks();
  });

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

  describe('create', () => {
    it('should create a note with default OKF frontmatter when missing', async () => {
      const dto = { title: 'My Note', contentMd: 'content', userId: 1 } as any;
      repository.create.mockResolvedValue(
        makeNote({
          frontmatter: { okf_version: '1.0', type: 'note', generated: false },
        }),
      );

      await service.create(dto);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          frontmatter: { okf_version: '1.0', type: 'note', generated: false },
        }),
      );
    });

    it('should enqueue embedding job async (save returns immediately)', async () => {
      const dto = { title: 'My Note', contentMd: 'content', userId: 1 } as any;
      repository.create.mockResolvedValue(makeNote());

      const result = await service.create(dto);

      expect(result).toBeDefined();
      expect(embeddingQueue.add).toHaveBeenCalledWith(
        'embed',
        { noteId: 'note-1', contentMd: '<p>content</p>\n' },
        expect.any(Object),
      );
    });

    it('should extract [[links]] and upsert note links', async () => {
      const dto = {
        title: 'My Note',
        contentMd: 'See [[Other Note]] and [[Second Note]]',
        userId: 1,
      } as any;
      repository.create.mockResolvedValue(makeNote());

      await service.create(dto);

      expect(repository.replaceLinks).toHaveBeenCalledWith('note-1', [
        'Other Note',
        'Second Note',
      ]);
    });

    it('should store created_by userId as provenance (metadata only)', async () => {
      const dto = { title: 'My Note', contentMd: 'content', userId: 7 } as any;
      repository.create.mockResolvedValue(makeNote({ userId: 7 }));

      await service.create(dto);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 7 }),
      );
    });

    it('should create a note without userId (global, null provenance)', async () => {
      const dto = { title: 'My Note', contentMd: 'content' } as any;
      repository.create.mockResolvedValue(makeNote({ userId: null }));

      await service.create(dto);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: null }),
      );
    });

    it('should decode HTML entities in extracted link titles', async () => {
      // Stored HTML contains entity-escaped text (markdown-it escapes & in
      // wikilink text); extraction must decode back to the real title.
      const dto = {
        title: 'My Note',
        contentMd: 'See [[A &amp; B]] and [[Caf&#233; Notes]]',
        userId: 1,
      } as any;
      repository.create.mockResolvedValue(makeNote());

      await service.create(dto);

      expect(repository.replaceLinks).toHaveBeenCalledWith('note-1', [
        'A & B',
        'Café Notes',
      ]);
    });

    it('should decode numeric HTML entities (decimal and hex) in extracted titles', async () => {
      const dto = {
        title: 'My Note',
        contentMd: 'See [[Node &#38; JS]] and [[Tip &#x1F600; Guide]]',
        userId: 1,
      } as any;
      repository.create.mockResolvedValue(makeNote());

      await service.create(dto);

      expect(repository.replaceLinks).toHaveBeenCalledWith('note-1', [
        'Node & JS',
        'Tip 😀 Guide',
      ]);
    });
  });

  describe('update', () => {
    it('should update note and re-enqueue embedding if content changes', async () => {
      repository.findById.mockResolvedValue(
        makeNote({ contentMd: 'old content' }),
      );
      repository.update.mockResolvedValue(
        makeNote({ contentMd: 'new content' }),
      );

      await service.update('note-1', { contentMd: 'new content' } as any);

      expect(repository.update).toHaveBeenCalledWith('note-1', {
        contentMd: '<p>new content</p>\n',
      });
      expect(embeddingQueue.add).toHaveBeenCalledWith(
        'embed',
        { noteId: 'note-1', contentMd: '<p>new content</p>\n' },
        expect.any(Object),
      );
    });

    it('should NOT re-enqueue embedding if content is unchanged', async () => {
      repository.findById.mockResolvedValue(makeNote());
      repository.update.mockResolvedValue(makeNote());

      await service.update('note-1', { title: 'New Title' } as any);

      expect(repository.update).toHaveBeenCalled();
      expect(embeddingQueue.add).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when note does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.update('note-1', { title: 'X' } as any),
      ).rejects.toThrow(NotFoundException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('should allow ANY authenticated user to update ANY note (global access)', async () => {
      // Note created by user 99 — user 1 may still update it.
      repository.findById.mockResolvedValue(makeNote({ userId: 99 }));
      repository.update.mockResolvedValue(makeNote({ userId: 99, title: 'X' }));

      await service.update('note-1', { title: 'X' } as any);

      expect(repository.update).toHaveBeenCalledWith('note-1', { title: 'X' });
    });
  });

  describe('softDelete', () => {
    it('should soft delete (set deletedAt, NOT hard delete)', async () => {
      repository.findById.mockResolvedValue(makeNote());

      await service.softDelete('note-1');

      expect(repository.softDelete).toHaveBeenCalledWith('note-1');
    });

    it('should throw NotFoundException if note does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.softDelete('missing')).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.softDelete).not.toHaveBeenCalled();
    });

    it('should allow ANY user to delete ANY note (global access)', async () => {
      // Note created by user 99 — user 1 may still delete it.
      repository.findById.mockResolvedValue(makeNote({ userId: 99 }));

      await service.softDelete('note-1');

      expect(repository.softDelete).toHaveBeenCalledWith('note-1');
    });
  });

  describe('findById', () => {
    it('should return note by id (excluding soft-deleted)', async () => {
      repository.findById.mockResolvedValue(makeNote());

      const result = await service.findById('note-1');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('note-1');
    });

    it('should return null for soft-deleted notes', async () => {
      repository.findById.mockResolvedValue(null);

      const result = await service.findById('deleted-note');

      expect(result).toBeNull();
    });

    it('should return any note regardless of creator (global access)', async () => {
      repository.findById.mockResolvedValue(makeNote({ userId: 999 }));

      const result = await service.findById('note-1');

      expect(result).not.toBeNull();
      expect(result?.userId).toBe(999);
    });
  });

  describe('findByCategoryPath', () => {
    it('should perform tree search by category_path (no user scoping)', async () => {
      repository.findByCategoryPath.mockResolvedValue([
        makeNote({ id: 'n1', categoryPath: 'tech' }),
        makeNote({ id: 'n2', categoryPath: 'tech.notes' }),
      ]);

      const result = await service.findByCategoryPath('tech', 2);

      expect(repository.findByCategoryPath).toHaveBeenCalledWith('tech', 2);
      expect(result).toHaveLength(2);
    });
  });

  describe('findAll', () => {
    it('should return all notes (global, no user scoping)', async () => {
      repository.findAll.mockResolvedValue([
        makeNote({ id: 'n1', userId: 1 }),
        makeNote({ id: 'n2', userId: 99 }),
      ]);

      const result = await service.findAll();

      expect(repository.findAll).toHaveBeenCalledWith(undefined);
      expect(result).toHaveLength(2);
    });

    it('should pass search filter to repository', async () => {
      repository.findAll.mockResolvedValue([]);

      await service.findAll({ search: 'keyword' });

      expect(repository.findAll).toHaveBeenCalledWith({ search: 'keyword' });
    });
  });

  describe('forward-reference resolution on create (D1)', () => {
    it('should re-resolve links in older notes whose wikilinks match the new title', async () => {
      const dto = { title: 'New Note', contentMd: 'content', userId: 1 } as any;
      repository.create.mockResolvedValue(
        makeNote({ id: 'new-note', title: 'New Note' }),
      );
      repository.findNotesContainingWikilinks.mockResolvedValue([
        makeNote({
          id: 'older-1',
          title: 'Older',
          contentMd: '<p>See [[New Note]] later</p>',
        }),
        makeNote({
          id: 'unrelated',
          title: 'Unrelated',
          contentMd: '<p>See [[Something Else]]</p>',
        }),
      ]);

      await service.create(dto);

      expect(repository.findNotesContainingWikilinks).toHaveBeenCalled();
      // Matching candidate re-resolved with its FULL extracted title set.
      expect(repository.replaceLinks).toHaveBeenCalledWith('older-1', [
        'New Note',
      ]);
      expect(repository.replaceLinks).not.toHaveBeenCalledWith(
        'unrelated',
        expect.anything(),
      );
    });

    it('should match candidate titles case-insensitively with collapsed whitespace', async () => {
      const dto = {
        title: '  Node.js   Guide ',
        contentMd: 'content',
        userId: 1,
      } as any;
      repository.create.mockResolvedValue(makeNote({ title: 'Node.js Guide' }));
      repository.findNotesContainingWikilinks.mockResolvedValue([
        makeNote({
          id: 'cand-1',
          title: 'Other',
          contentMd: '<p>see [[node.JS guide]]</p>',
        }),
      ]);

      await service.create(dto);

      expect(repository.replaceLinks).toHaveBeenCalledWith('cand-1', [
        'node.JS guide',
      ]);
    });

    it('should skip the newly created note itself in the candidate scan', async () => {
      const dto = {
        title: 'Self Ref',
        contentMd: 'Points at [[Other Note]] and [[Self Note]]',
        userId: 1,
      } as any;
      repository.create.mockResolvedValue(
        makeNote({ id: 'note-1', title: 'Self Title' }),
      );
      repository.findNotesContainingWikilinks.mockResolvedValue([
        makeNote({
          id: 'note-1',
          title: 'Self Note',
          contentMd: '[[Self Title]]',
        }),
      ]);

      await service.create(dto);

      // Own links were already written by create(); the hook must not
      // re-resolve the just-created note (self links are never kept).
      expect(repository.replaceLinks).toHaveBeenCalledTimes(1);
      expect(repository.replaceLinks).toHaveBeenCalledWith('note-1', [
        'Other Note',
        'Self Note',
      ]);
    });

    it('should not break create when the resolution pass fails', async () => {
      const dto = { title: 'My Note', contentMd: 'content', userId: 1 } as any;
      repository.create.mockResolvedValue(makeNote());
      repository.findNotesContainingWikilinks.mockRejectedValue(
        new Error('db down'),
      );

      const result = await service.create(dto);

      expect(result).toBeDefined();
      expect(result.id).toBe('note-1');
    });
  });

  describe('forward-reference resolution on title rename (D1)', () => {
    it('should re-resolve links matching the old or the new title on rename', async () => {
      repository.findById.mockResolvedValue(makeNote({ title: 'Old Title' }));
      repository.update.mockResolvedValue(
        makeNote({ title: 'Brand New Title' }),
      );
      repository.findNotesContainingWikilinks.mockResolvedValue([
        makeNote({
          id: 'cand',
          title: 'Other',
          contentMd: '<p>ref [[Old Title]]</p>',
        }),
      ]);

      await service.update('note-1', { title: 'Brand New Title' } as any);

      expect(repository.replaceLinks).toHaveBeenCalledWith('cand', [
        'Old Title',
      ]);
    });

    it('should NOT trigger resolution when the title is unchanged', async () => {
      repository.findById.mockResolvedValue(makeNote({ title: 'Same' }));
      repository.update.mockResolvedValue(makeNote({ title: 'Same' }));

      await service.update('note-1', { contentMd: 'new content' } as any);

      expect(repository.findNotesContainingWikilinks).not.toHaveBeenCalled();
    });
  });

  describe('reindexLinks', () => {
    it('should re-extract and replace links for every note and return the count', async () => {
      repository.findAll.mockResolvedValue([
        makeNote({ id: 'n1', contentMd: '<p>See [[Alpha]] and [[Beta]]</p>' }),
        makeNote({ id: 'n2', contentMd: '<p>No links here</p>' }),
      ]);

      const result = await service.reindexLinks();

      expect(repository.findAll).toHaveBeenCalled();
      expect(repository.replaceLinks).toHaveBeenCalledTimes(2);
      expect(repository.replaceLinks).toHaveBeenCalledWith('n1', [
        'Alpha',
        'Beta',
      ]);
      // Notes without wikilinks get their (possibly stale) edges wiped.
      expect(repository.replaceLinks).toHaveBeenCalledWith('n2', []);
      expect(result).toBe(2);
    });

    it('should keep processing remaining notes when one note fails', async () => {
      repository.findAll.mockResolvedValue([
        makeNote({ id: 'n1' }),
        makeNote({ id: 'n2' }),
      ]);
      repository.replaceLinks.mockRejectedValueOnce(
        new Error('db write failed'),
      );

      const count = await service.reindexLinks();

      expect(repository.replaceLinks).toHaveBeenCalledTimes(2);
      expect(count).toBe(2);
    });
  });
});
