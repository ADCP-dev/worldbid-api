import { Test, TestingModule } from '@nestjs/testing';
import { GraphService } from './graph.service';
import { NoteRepository } from './infrastructure/note.repository';

describe('GraphService', () => {
  let service: GraphService;
  let repository: jest.Mocked<NoteRepository>;

  beforeEach(async () => {
    const mockRepo = {
      findNotesForGraph: jest.fn(),
      findLinksForNotes: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GraphService,
        { provide: NoteRepository, useValue: mockRepo },
      ],
    }).compile();

    service = module.get<GraphService>(GraphService);
    repository = module.get(NoteRepository) as unknown as jest.Mocked<NoteRepository>;
  });

  afterEach(() => jest.clearAllMocks());

  it('should compute degree = in + out edges per node', async () => {
    repository.findNotesForGraph.mockResolvedValue([
      { id: 'a', title: 'A', tags: [], category_path: null },
      { id: 'b', title: 'B', tags: [], category_path: null },
      { id: 'c', title: 'C', tags: [], category_path: null },
    ]);
    repository.findLinksForNotes.mockResolvedValue([
      { source_note_id: 'a', target_note_id: 'b' },
      { source_note_id: 'a', target_note_id: 'c' },
      { source_note_id: 'b', target_note_id: 'c' },
    ]);

    const result = await service.getGraph();

    const degreeOf = (id: string) =>
      result.nodes.find((n) => n.id === id)?.degree;
    expect(degreeOf('a')).toBe(2); // a→b, a→c
    expect(degreeOf('b')).toBe(2); // a→b (in), b→c (out)
    expect(degreeOf('c')).toBe(2); // a→c (in), b→c (in)
  });

  it('should mark isolated notes (no links) with degree 0', async () => {
    repository.findNotesForGraph.mockResolvedValue([
      { id: 'solo', title: 'Solo', tags: ['x'], category_path: 'tech' },
    ]);
    repository.findLinksForNotes.mockResolvedValue([]);

    const result = await service.getGraph();

    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].degree).toBe(0);
    expect(result.edges).toHaveLength(0);
  });

  it('should only return links between notes in the visible set (global, no user filter)', async () => {
    repository.findNotesForGraph.mockResolvedValue([
      { id: 'a', title: 'A', tags: [], category_path: null },
    ]);
    // Repo already filters by noteIds, so a link to a note outside
    // the set should not appear here.
    repository.findLinksForNotes.mockResolvedValue([]);

    const result = await service.getGraph();

    expect(repository.findLinksForNotes).toHaveBeenCalledWith(['a']);
    expect(result.edges).toHaveLength(0);
  });

  it('should pass categoryPath and tag filters to the repository (no userId)', async () => {
    repository.findNotesForGraph.mockResolvedValue([]);
    repository.findLinksForNotes.mockResolvedValue([]);

    await service.getGraph({ categoryPath: 'tech', tag: 'ai' });

    expect(repository.findNotesForGraph).toHaveBeenCalledWith({
      categoryPath: 'tech',
      tag: 'ai',
    });
  });

  it('should preserve tags and categoryPath on each node', async () => {
    repository.findNotesForGraph.mockResolvedValue([
      { id: 'n1', title: 'Note 1', tags: ['alpha', 'beta'], category_path: 'tech.notes' },
    ]);
    repository.findLinksForNotes.mockResolvedValue([]);

    const result = await service.getGraph();

    expect(result.nodes[0].tags).toEqual(['alpha', 'beta']);
    expect(result.nodes[0].categoryPath).toBe('tech.notes');
  });

  it('should return empty graph when there are no notes', async () => {
    repository.findNotesForGraph.mockResolvedValue([]);
    repository.findLinksForNotes.mockResolvedValue([]);

    const result = await service.getGraph();

    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
  });
});