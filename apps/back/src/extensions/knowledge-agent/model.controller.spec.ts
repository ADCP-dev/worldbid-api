import { Test, TestingModule } from '@nestjs/testing';
import { ModelController } from './model.controller';
import { ModelRepository } from './infrastructure/model.repository';
import type { Model } from './domain/model';

const makeModel = (overrides: Partial<Model> = {}): Model =>
  ({
    id: 'model-1',
    providerId: 'prov-1',
    modelId: 'z-ai/glm-5.2',
    displayName: 'GLM 5.2',
    contextWindow: 128000,
    active: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  }) as Model;

describe('ModelController', () => {
  let controller: ModelController;
  let repository: jest.Mocked<ModelRepository>;

  beforeEach(async () => {
    const mockRepo = {
      create: jest.fn(),
      find: jest.fn(),
      findByProviderId: jest.fn(),
      findActive: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      deactivateByProvider: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ModelController],
      providers: [{ provide: ModelRepository, useValue: mockRepo }],
    }).compile();

    controller = module.get<ModelController>(ModelController);
    repository = module.get(ModelRepository) as unknown as jest.Mocked<ModelRepository>;
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a model (RBAC admin enforced via @Roles decorator)', async () => {
      const model = makeModel();
      repository.create.mockResolvedValue(model);

      const result = await controller.create({
        providerId: 'prov-1',
        modelId: 'z-ai/glm-5.2',
        displayName: 'GLM 5.2',
        contextWindow: 128000,
        active: true,
      });

      expect(repository.create).toHaveBeenCalledWith({
        providerId: 'prov-1',
        modelId: 'z-ai/glm-5.2',
        displayName: 'GLM 5.2',
        contextWindow: 128000,
        active: true,
      });
      expect(result).toBe(model);
    });

    it('should deactivate other models of the same provider when active=true', async () => {
      const model = makeModel();
      repository.create.mockResolvedValue(model);

      await controller.create({
        providerId: 'prov-1',
        modelId: 'z-ai/glm-5.2',
        displayName: 'GLM 5.2',
        contextWindow: 128000,
        active: true,
      });

      expect(repository.deactivateByProvider).toHaveBeenCalledWith('prov-1');
    });

    it('should NOT deactivate other models when active=false', async () => {
      const model = makeModel({ active: false });
      repository.create.mockResolvedValue(model);

      await controller.create({
        providerId: 'prov-1',
        modelId: 'z-ai/glm-5.2',
        displayName: 'GLM 5.2',
        contextWindow: 128000,
        active: false,
      });

      expect(repository.deactivateByProvider).not.toHaveBeenCalled();
    });

    it('should NOT deactivate other models when active is omitted', async () => {
      const model = makeModel();
      repository.create.mockResolvedValue(model);

      await controller.create({
        providerId: 'prov-1',
        modelId: 'z-ai/glm-5.2',
        displayName: 'GLM 5.2',
        contextWindow: 128000,
      });

      // active defaults to true in the repo, but the controller should only
      // trigger deactivation when the DTO explicitly says active=true.
      expect(repository.deactivateByProvider).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should list all models when no providerId filter (any authenticated user)', async () => {
      const models = [makeModel(), makeModel({ id: 'model-2' })];
      repository.find.mockResolvedValue(models);

      const result = await controller.findAll();

      expect(repository.find).toHaveBeenCalled();
      expect(repository.findByProviderId).not.toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });

    it('should filter by providerId when provided', async () => {
      const models = [makeModel()];
      repository.findByProviderId.mockResolvedValue(models);

      const result = await controller.findAll('prov-1');

      expect(repository.findByProviderId).toHaveBeenCalledWith('prov-1');
      expect(repository.find).not.toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });
  });

  describe('findActive', () => {
    it('should list only active models (any authenticated user)', async () => {
      const models = [makeModel({ active: true })];
      repository.findActive.mockResolvedValue(models);

      const result = await controller.findActive();

      expect(repository.findActive).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].active).toBe(true);
    });
  });

  describe('findById', () => {
    it('should return a model by id', async () => {
      repository.findById.mockResolvedValue(makeModel());

      const result = await controller.findById('model-1');

      expect(repository.findById).toHaveBeenCalledWith('model-1');
      expect(result?.id).toBe('model-1');
    });

    it('should return null when model does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      const result = await controller.findById('missing');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update a model (RBAC admin enforced via @Roles decorator)', async () => {
      const updated = makeModel({ displayName: 'Renamed' });
      repository.update.mockResolvedValue(updated);

      const result = await controller.update('model-1', { displayName: 'Renamed' } as any);

      expect(repository.update).toHaveBeenCalledWith('model-1', { displayName: 'Renamed' });
      expect(result.displayName).toBe('Renamed');
    });

    it('should deactivate other models of the same provider when active=true', async () => {
      const model = makeModel({ id: 'model-1', providerId: 'prov-1' });
      repository.findById.mockResolvedValue(model);
      const updated = makeModel({ id: 'model-1', active: true });
      repository.update.mockResolvedValue(updated);

      await controller.update('model-1', { active: true });

      expect(repository.findById).toHaveBeenCalledWith('model-1');
      expect(repository.deactivateByProvider).toHaveBeenCalledWith('prov-1', 'model-1');
    });

    it('should NOT deactivate other models when active is not set to true', async () => {
      const updated = makeModel({ displayName: 'Renamed' });
      repository.update.mockResolvedValue(updated);

      await controller.update('model-1', { displayName: 'Renamed' } as any);

      expect(repository.deactivateByProvider).not.toHaveBeenCalled();
    });

    it('should still update when active=true even if the model has no siblings', async () => {
      const model = makeModel({ id: 'model-1', providerId: 'prov-1' });
      repository.findById.mockResolvedValue(model);
      const updated = makeModel({ id: 'model-1', active: true });
      repository.update.mockResolvedValue(updated);

      const result = await controller.update('model-1', { active: true });

      expect(repository.deactivateByProvider).toHaveBeenCalledWith('prov-1', 'model-1');
      expect(result.active).toBe(true);
    });
  });

  describe('remove', () => {
    it('should remove a model (RBAC admin enforced via @Roles decorator)', async () => {
      repository.remove.mockResolvedValue(undefined);

      await controller.remove('model-1');

      expect(repository.remove).toHaveBeenCalledWith('model-1');
    });
  });

  describe('RBAC metadata', () => {
    it('should declare admin-only roles on create', () => {
      const meta = Reflect.getMetadata('roles', controller.create);
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

    it('should NOT declare roles on findActive (any authenticated user)', () => {
      const meta = Reflect.getMetadata('roles', controller.findActive);
      expect(meta).toBeUndefined();
    });

    it('should NOT declare roles on findById (any authenticated user)', () => {
      const meta = Reflect.getMetadata('roles', controller.findById);
      expect(meta).toBeUndefined();
    });
  });
});