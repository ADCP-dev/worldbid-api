import { Test, TestingModule } from '@nestjs/testing';
import { ModelProviderController } from './model-provider.controller';
import { ModelProviderRepository } from './infrastructure/model-provider.repository';
import type { ModelProvider } from './domain/model-provider';

const makeProvider = (overrides: Partial<ModelProvider> = {}): ModelProvider =>
  ({
    id: 'prov-1',
    name: 'Ollama Cloud',
    provider: 'ollama',
    apiKeyRef: 'OLLAMA_API_KEY',
    baseUrl: 'https://cloud.ollama.ai',
    enabled: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  }) as ModelProvider;

describe('ModelProviderController', () => {
  let controller: ModelProviderController;
  let repository: jest.Mocked<ModelProviderRepository>;

  beforeEach(async () => {
    const mockRepo = {
      create: jest.fn(),
      find: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ModelProviderController],
      providers: [
        { provide: ModelProviderRepository, useValue: mockRepo },
      ],
    }).compile();

    controller = module.get<ModelProviderController>(ModelProviderController);
    repository = module.get(ModelProviderRepository) as unknown as jest.Mocked<ModelProviderRepository>;
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a provider (RBAC admin enforced via @Roles decorator)', async () => {
      const provider = makeProvider();
      repository.create.mockResolvedValue(provider);

      const result = await controller.create({
        name: 'Ollama Cloud',
        provider: 'ollama',
        apiKeyRef: 'OLLAMA_API_KEY',
        baseUrl: 'https://cloud.ollama.ai',
        enabled: true,
      });

      expect(repository.create).toHaveBeenCalledWith({
        name: 'Ollama Cloud',
        provider: 'ollama',
        apiKeyRef: 'OLLAMA_API_KEY',
        baseUrl: 'https://cloud.ollama.ai',
        enabled: true,
      });
      expect(result).toBe(provider);
    });
  });

  describe('findAll', () => {
    it('should list all providers (any authenticated user)', async () => {
      const providers = [makeProvider(), makeProvider({ id: 'prov-2' })];
      repository.find.mockResolvedValue(providers);

      const result = await controller.findAll();

      expect(repository.find).toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });
  });

  describe('findById', () => {
    it('should return a provider by id', async () => {
      repository.findById.mockResolvedValue(makeProvider());

      const result = await controller.findById('prov-1');

      expect(repository.findById).toHaveBeenCalledWith('prov-1');
      expect(result?.id).toBe('prov-1');
    });

    it('should return null when provider does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      const result = await controller.findById('missing');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update a provider (RBAC admin enforced via @Roles decorator)', async () => {
      const updated = makeProvider({ name: 'Renamed' });
      repository.update.mockResolvedValue(updated);

      const result = await controller.update('prov-1', { name: 'Renamed' } as any);

      expect(repository.update).toHaveBeenCalledWith('prov-1', { name: 'Renamed' });
      expect(result.name).toBe('Renamed');
    });
  });

  describe('remove', () => {
    it('should remove a provider (RBAC admin enforced via @Roles decorator)', async () => {
      repository.remove.mockResolvedValue(undefined);

      await controller.remove('prov-1');

      expect(repository.remove).toHaveBeenCalledWith('prov-1');
    });
  });

  describe('RBAC metadata', () => {
    /**
     * Guards are not evaluated in unit tests, but we can assert the
     * `@Roles(RoleEnum.admin)` metadata is present on mutation methods so
     * the RolesGuard (when active in integration) rejects non-admin users.
     */
    it('should declare admin-only roles on create', () => {
      const meta = Reflect.getMetadata('roles', controller.create);
      // Roles decorator stores RoleEnum.admin (numeric 1)
      expect(Array.isArray(meta)).toBe(true);
      expect(meta).toContain(1); // RoleEnum.admin === 1
    });

    it('should declare admin-only roles on update', () => {
      const meta = Reflect.getMetadata('roles', controller.update);
      expect(Array.isArray(meta)).toBe(true);
      expect(meta).toContain(1);
    });

    it('should declare admin-only roles on remove', () => {
      const meta = Reflect.getMetadata('roles', controller.remove);
      expect(Array.isArray(meta)).toBe(true);
      expect(meta).toContain(1);
    });

    it('should NOT declare roles on findAll (any authenticated user)', () => {
      const meta = Reflect.getMetadata('roles', controller.findAll);
      expect(meta).toBeUndefined();
    });

    it('should NOT declare roles on findById (any authenticated user)', () => {
      const meta = Reflect.getMetadata('roles', controller.findById);
      expect(meta).toBeUndefined();
    });
  });
});