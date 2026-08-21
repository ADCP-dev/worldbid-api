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
    findByUserId: jest.fn(),
    findByCategoryPath: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    upsertLinks: jest.fn().mockResolvedValue(undefined),
    findBacklinks: jest.fn(),
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
    embeddingQueue = module.get(getQueueToken('ka-embedding')) as unknown as jest.Mocked<Queue>;
  });

  afterEach(() => jest.clearAllMocks());

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
      repository.create.mockResolvedValue(makeNote({ frontmatter: { okf_version: '1.0', type: 'note', generated: false } }));

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
        { noteId: 'note-1', contentMd: 'content' },
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

      expect(repository.upsertLinks).toHaveBeenCalledWith(
        'note-1',
        ['Other Note', 'Second Note'],
      );
    });
  });

  describe('update', () => {
    it('should update note and re-enqueue embedding if content changes', async () => {
      repository.findById.mockResolvedValue(makeNote({ contentMd: 'old content' }));
      repository.update.mockResolvedValue(makeNote({ contentMd: 'new content' }));

      await service.update('note-1', { contentMd: 'new content' } as any);

      expect(repository.update).toHaveBeenCalledWith('note-1', { contentMd: 'new content' });
      expect(embeddingQueue.add).toHaveBeenCalledWith(
        'embed',
        { noteId: 'note-1', contentMd: 'new content' },
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
  });

  describe('softDelete', () => {
    it('should soft delete (set deletedAt, NOT hard delete)', async () => {
      repository.findById.mockResolvedValue(makeNote());

      await service.softDelete('note-1');

      expect(repository.softDelete).toHaveBeenCalledWith('note-1');
    });

    it('should throw NotFoundException if note does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.softDelete('missing')).rejects.toThrow(NotFoundException);
      expect(repository.softDelete).not.toHaveBeenCalled();
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
  });

  describe('findByCategoryPath', () => {
    it('should perform tree search by category_path', async () => {
      repository.findByCategoryPath.mockResolvedValue([
        makeNote({ id: 'n1', categoryPath: 'tech' }),
        makeNote({ id: 'n2', categoryPath: 'tech.notes' }),
      ]);

      const result = await service.findByCategoryPath(1, 'tech', 2);

      expect(repository.findByCategoryPath).toHaveBeenCalledWith(1, 'tech', 2);
      expect(result).toHaveLength(2);
    });
  });

  describe('findByUserId', () => {
    it('should return only notes belonging to the user', async () => {
      repository.findByUserId.mockResolvedValue([makeNote({ userId: 5 })]);

      const result = await service.findByUserId(5);

      expect(repository.findByUserId).toHaveBeenCalledWith(5, undefined);
      expect(result.every((n) => n.userId === 5)).toBe(true);
    });

    it('should pass search filter to repository', async () => {
      repository.findByUserId.mockResolvedValue([]);

      await service.findByUserId(5, { search: 'keyword' });

      expect(repository.findByUserId).toHaveBeenCalledWith(5, { search: 'keyword' });
    });
  });
});