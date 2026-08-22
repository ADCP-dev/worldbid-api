import { Test, TestingModule } from '@nestjs/testing';
import { GraphController } from './graph.controller';
import { GraphService } from './graph.service';
import { GraphData } from './domain/graph';

describe('GraphController', () => {
  let controller: GraphController;
  let graphService: jest.Mocked<GraphService>;

  const makeGraph = (): GraphData => ({
    nodes: [
      { id: 'n1', label: 'Note 1', tags: ['a'], categoryPath: 'tech', degree: 2 },
      { id: 'n2', label: 'Note 2', tags: ['b'], categoryPath: 'tech.notes', degree: 1 },
      { id: 'n3', label: 'Note 3', tags: [], categoryPath: null, degree: 0 },
    ],
    edges: [
      { source: 'n1', target: 'n2' },
      { source: 'n1', target: 'n1' }, // self-link ignored by repo join
    ],
  });

  beforeEach(async () => {
    const mockService = {
      getGraph: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GraphController],
      providers: [{ provide: GraphService, useValue: mockService }],
    }).compile();

    controller = module.get<GraphController>(GraphController);
    graphService = module.get(GraphService) as unknown as jest.Mocked<GraphService>;
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return graph (nodes + edges) scoped to the user id', async () => {
    graphService.getGraph.mockResolvedValue(makeGraph());

    const result = await controller.getGraph(42, {} as any);

    expect(graphService.getGraph).toHaveBeenCalledWith(42, {
      categoryPath: undefined,
      tag: undefined,
    });
    expect(result).toBeDefined();
    expect(result.nodes).toHaveLength(3);
    expect(result.edges).toHaveLength(2);
  });

  it('should pass categoryPath and tag filters to the service', async () => {
    graphService.getGraph.mockResolvedValue({ nodes: [], edges: [] });

    await controller.getGraph(7, { categoryPath: 'tech', tag: 'ai' } as any);

    expect(graphService.getGraph).toHaveBeenCalledWith(7, {
      categoryPath: 'tech',
      tag: 'ai',
    });
  });

  it('should forward the user id from the @UserId() decorator (no cross-user leak)', async () => {
    graphService.getGraph.mockResolvedValue({ nodes: [], edges: [] });

    await controller.getGraph(99, {} as any);

    expect(graphService.getGraph).toHaveBeenCalledTimes(1);
    expect(graphService.getGraph.mock.calls[0][0]).toBe(99);
  });

  it('should include degree on every node', async () => {
    graphService.getGraph.mockResolvedValue(makeGraph());

    const result = await controller.getGraph(1, {} as any);

    for (const node of result.nodes) {
      expect(node).toHaveProperty('degree');
      expect(typeof node.degree).toBe('number');
    }
  });

  it('should return empty graph when user has no notes', async () => {
    graphService.getGraph.mockResolvedValue({ nodes: [], edges: [] });

    const result = await controller.getGraph(0, {} as any);

    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
  });
});