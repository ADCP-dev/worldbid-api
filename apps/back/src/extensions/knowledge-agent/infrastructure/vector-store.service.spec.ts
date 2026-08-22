import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { VectorStoreService } from './vector-store.service';
import { EmbeddingsService } from './embeddings/embeddings.service';

describe('VectorStoreService', () => {
  let service: VectorStoreService;
  let embeddingsService: jest.Mocked<EmbeddingsService>;
  let config: jest.Mocked<ConfigService>;
  let mockStore: {
    initialize: jest.Mock;
    similaritySearchWithScore: jest.Mock;
  };

  beforeEach(async () => {
    mockStore = {
      initialize: jest.fn(),
      similaritySearchWithScore: jest.fn(),
    };

    const configMock = {
      get: jest.fn((key: string) => {
        const map: Record<string, unknown> = {
          'ka.embeddingDimension': 1536,
          database: { host: 'localhost', port: 5432, user: 'ka', password: 'ka', database: 'ka' },
        };
        return map[key];
      }),
    };

    const embeddingsMock = {
      getEmbeddings: jest.fn().mockReturnValue({ embedQuery: jest.fn() }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VectorStoreService,
        { provide: EmbeddingsService, useValue: embeddingsMock },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    service = module.get<VectorStoreService>(VectorStoreService);
    embeddingsService = module.get(EmbeddingsService) as jest.Mocked<EmbeddingsService>;
    config = module.get(ConfigService) as jest.Mocked<ConfigService>;
    // Stub the PGVectorStore initializer so tests never touch a real DB.
    service['createStoreImpl'] = jest.fn().mockResolvedValue(mockStore) as never;
  });

  afterEach(() => jest.clearAllMocks());

  it('should initialize PGVectorStore with embeddings + postgres config', async () => {
    await service.initialize();

    expect(embeddingsService.getEmbeddings).toHaveBeenCalled();
    expect(config.get).toHaveBeenCalledWith('database');
    expect(service['createStoreImpl']).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        tableName: 'ext_ka_notes',
        columns: {
          idColumnName: 'id',
          vectorColumnName: 'embedding',
          contentColumnName: 'content_md',
          metadataColumnName: 'metadata',
        },
      }),
    );
  });

  it('should perform similarity search with score and return hits', async () => {
    const hits = [
      [{ content: 'note A', metadata: { id: 'n1' } }, 0.12],
      [{ content: 'note B', metadata: { id: 'n2' } }, 0.34],
    ];
    mockStore.similaritySearchWithScore.mockResolvedValue(hits);
    await service.initialize();

    const result = await service.similaritySearch('query text', 5);

    expect(mockStore.similaritySearchWithScore).toHaveBeenCalledWith('query text', 5);
    expect(result).toEqual(hits);
  });

  it('should default topK to 5 when not specified', async () => {
    mockStore.similaritySearchWithScore.mockResolvedValue([]);
    await service.initialize();

    await service.similaritySearch('query');

    expect(mockStore.similaritySearchWithScore).toHaveBeenCalledWith('query', 5);
  });

  it('should return empty array if store not initialized', async () => {
    const result = await service.similaritySearch('query', 3);

    expect(result).toEqual([]);
  });

  it('should be idempotent — initialize called twice does not recreate store', async () => {
    await service.initialize();
    await service.initialize();

    expect(service['createStoreImpl']).toHaveBeenCalledTimes(1);
  });
});