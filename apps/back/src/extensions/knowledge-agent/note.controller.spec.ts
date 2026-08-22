import { Test, TestingModule } from '@nestjs/testing';
import { NoteController } from './note.controller';
import { NoteService } from './note.service';
import type { Note } from './domain/note';

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

describe('NoteController', () => {
  let controller: NoteController;
  let noteService: jest.Mocked<NoteService>;

  beforeEach(async () => {
    const mockService = {
      create: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      findByCategoryPath: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      findBacklinks: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NoteController],
      providers: [{ provide: NoteService, useValue: mockService }],
    }).compile();

    controller = module.get<NoteController>(NoteController);
    noteService = module.get(NoteService) as unknown as jest.Mocked<NoteService>;
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a note and store userId as creator provenance', async () => {
      const note = makeNote();
      noteService.create.mockResolvedValue(note);

      const result = await controller.create(
        { title: 'X', contentMd: 'Y' } as any,
        1,
      );

      expect(noteService.create).toHaveBeenCalledWith({ title: 'X', contentMd: 'Y', userId: 1 });
      expect(result).toBe(note);
    });
  });

  describe('findAll', () => {
    it('should list all notes (global, no user scoping)', async () => {
      noteService.findAll.mockResolvedValue([makeNote()]);

      const result = await controller.findAll({} as any);

      expect(noteService.findAll).toHaveBeenCalledWith({ search: undefined });
      expect(result).toHaveLength(1);
    });

    it('should delegate to findByCategoryPath when categoryPath is present', async () => {
      noteService.findByCategoryPath.mockResolvedValue([makeNote()]);

      await controller.findAll({ categoryPath: 'tech', depth: 2 } as any);

      expect(noteService.findByCategoryPath).toHaveBeenCalledWith('tech', 2);
    });
  });

  describe('findById', () => {
    it('should return the note (global access, no ownership check)', async () => {
      noteService.findById.mockResolvedValue(makeNote({ userId: 1 }));

      const result = await controller.findById('note-1');

      expect(noteService.findById).toHaveBeenCalledWith('note-1');
      expect(result?.id).toBe('note-1');
    });

    it('should return notes created by ANY user (global knowledge base)', async () => {
      noteService.findById.mockResolvedValue(makeNote({ userId: 99 }));

      const result = await controller.findById('note-1');

      expect(result).not.toBeNull();
      expect(result?.userId).toBe(99);
    });

    it('should return null when the note does not exist', async () => {
      noteService.findById.mockResolvedValue(null);

      const result = await controller.findById('missing');

      expect(result).toBeNull();
    });
  });

  describe('findBacklinks', () => {
    it('should return backlinks for any note (global access)', async () => {
      noteService.findBacklinks.mockResolvedValue([makeNote({ id: 'note-2' })]);

      const result = await controller.findBacklinks('note-1');

      expect(noteService.findBacklinks).toHaveBeenCalledWith('note-1');
      expect(result).toHaveLength(1);
    });

    it('should return backlinks even if the note was created by another user', async () => {
      noteService.findBacklinks.mockResolvedValue([makeNote({ id: 'note-2' })]);

      const result = await controller.findBacklinks('note-1');

      expect(noteService.findBacklinks).toHaveBeenCalledWith('note-1');
      expect(result).toHaveLength(1);
    });
  });

  describe('update', () => {
    it('should update the note (no ownership check — global access)', async () => {
      const updated = makeNote({ title: 'Renamed' });
      noteService.update.mockResolvedValue(updated);

      const result = await controller.update('note-1', { title: 'Renamed' } as any);

      expect(noteService.update).toHaveBeenCalledWith('note-1', { title: 'Renamed' });
      expect(result.title).toBe('Renamed');
    });
  });

  describe('remove', () => {
    it('should soft delete the note (no ownership check — global access)', async () => {
      noteService.softDelete.mockResolvedValue(undefined);

      await controller.remove('note-1');

      expect(noteService.softDelete).toHaveBeenCalledWith('note-1');
    });
  });
});