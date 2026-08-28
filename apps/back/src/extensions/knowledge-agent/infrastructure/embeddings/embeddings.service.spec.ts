import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmbeddingsService } from './embeddings.service';

describe('EmbeddingsService', () => {
  let service: EmbeddingsService;
  let config: jest.Mocked<ConfigService>;
  let mockEmbeddings: {
    embedQuery: jest.Mock;
    embedDocuments: jest.Mock;
  };

  beforeEach(async () => {
    mockEmbeddings = {
      embedQuery: jest.fn(),
      embedDocuments: jest.fn(),
    };

    const configMock = {
      get: jest.fn((key: string) => {
        const map: Record<string, unknown> = {
          'ka.embeddingModel': 'nomic-embed-text',
          'ka.ollamaBaseUrl': 'http://127.0.0.1:11434',
        };
        return map[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmbeddingsService,
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    service = module.get<EmbeddingsService>(EmbeddingsService);
    config = module.get(ConfigService) as jest.Mocked<ConfigService>;
    // Stub the OllamaEmbeddings constructor so tests never touch the network.
    service['createEmbeddingsImpl'] = jest
      .fn()
      .mockReturnValue(mockEmbeddings) as never;
    service['init']();
  });

  afterEach(() => jest.clearAllMocks());

  it('should construct OllamaEmbeddings with legacy env defaults (no KA_EMBEDDING_BASE_URL)', () => {
    // No KA_EMBEDDING_BASE_URL → legacy local-Ollama path with defaults.
    expect(service['createEmbeddingsImpl']).toHaveBeenCalledWith({
      model: 'nomic-embed-text',
      baseUrl: 'http://localhost:11434',
    });
  });

  it('should embed a single text via embedQuery', async () => {
    const expected = [0.1, 0.2, 0.3];
    mockEmbeddings.embedQuery.mockResolvedValue(expected);

    const result = await service.embed('hello world');

    expect(mockEmbeddings.embedQuery).toHaveBeenCalledWith('hello world');
    expect(result).toEqual(expected);
  });

  it('should embed a batch of texts via embedDocuments', async () => {
    const expected = [
      [0.1, 0.2],
      [0.3, 0.4],
    ];
    mockEmbeddings.embedDocuments.mockResolvedValue(expected);

    const result = await service.embedBatch(['one', 'two']);

    expect(mockEmbeddings.embedDocuments).toHaveBeenCalledWith(['one', 'two']);
    expect(result).toEqual(expected);
  });

  it('should expose the underlying embeddings instance for PGVectorStore', () => {
    const instance = service.getEmbeddings();
    expect(instance).toBe(mockEmbeddings);
  });

  it('should fall back to env defaults when config keys are missing', async () => {
    const emptyConfigMock = { get: jest.fn().mockReturnValue(undefined) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmbeddingsService,
        { provide: ConfigService, useValue: emptyConfigMock },
      ],
    }).compile();
    const svc = module.get<EmbeddingsService>(EmbeddingsService);
    svc['createEmbeddingsImpl'] = jest
      .fn()
      .mockReturnValue(mockEmbeddings) as never;
    svc['init']();

    expect(svc['createEmbeddingsImpl']).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'nomic-embed-text',
        baseUrl: 'http://localhost:11434',
      }),
    );
  });
});