import { Test, TestingModule } from '@nestjs/testing';
import { AgentConfigController } from './agent-config.controller';
import { AgentConfigRepository } from './infrastructure/agent-config.repository';
import type { AgentConfig } from './domain/agent-config';

const makeConfig = (overrides: Partial<AgentConfig> = {}): AgentConfig =>
  ({
    id: 'cfg-1',
    name: 'Default',
    systemPrompt: 'You are a helpful agent.',
    model: 'z-ai/glm-5.2',
    provider: 'openrouter',
    permissions: { allow: [], deny: [] },
    mcpServerIds: [],
    userId: 1,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  }) as AgentConfig;

describe('AgentConfigController', () => {
  let controller: AgentConfigController;
  let repository: jest.Mocked<AgentConfigRepository>;

  beforeEach(async () => {
    const mockRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AgentConfigController],
      providers: [
        { provide: AgentConfigRepository, useValue: mockRepo },
      ],
    }).compile();

    controller = module.get<AgentConfigController>(AgentConfigController);
    repository = module.get(AgentConfigRepository) as unknown as jest.Mocked<AgentConfigRepository>;
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create a config and store userId as creator provenance', async () => {
      const cfg = makeConfig();
      repository.create.mockResolvedValue(cfg);

      const result = await controller.create(
        {
          name: 'Default',
          systemPrompt: 'You are a helpful agent.',
          model: 'z-ai/glm-5.2',
          provider: 'openrouter',
        } as any,
        1,
      );

      expect(repository.create).toHaveBeenCalledWith({
        name: 'Default',
        systemPrompt: 'You are a helpful agent.',
        model: 'z-ai/glm-5.2',
        provider: 'openrouter',
        userId: 1,
      });
      expect(result).toBe(cfg);
    });
  });

  describe('findAll', () => {
    it('should list all configs (global, no user scoping)', async () => {
      const configs = [makeConfig({ userId: 1 }), makeConfig({ id: 'cfg-2', userId: 99 })];
      repository.findAll.mockResolvedValue(configs);

      const result = await controller.findAll();

      expect(repository.findAll).toHaveBeenCalledWith();
      expect(result).toHaveLength(2);
    });
  });

  describe('findById', () => {
    it('should return the config (global access, no ownership check)', async () => {
      repository.findById.mockResolvedValue(makeConfig({ userId: 1 }));

      const result = await controller.findById('cfg-1');

      expect(repository.findById).toHaveBeenCalledWith('cfg-1');
      expect(result?.id).toBe('cfg-1');
    });

    it('should return configs created by ANY user (global, no leak protection needed)', async () => {
      repository.findById.mockResolvedValue(makeConfig({ userId: 99 }));

      const result = await controller.findById('cfg-1');

      expect(result).not.toBeNull();
      expect(result?.userId).toBe(99);
    });

    it('should return null when the config does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      const result = await controller.findById('missing');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update the config (no ownership check — global access)', async () => {
      repository.findById.mockResolvedValue(makeConfig({ userId: 1 }));
      const updated = makeConfig({ name: 'Renamed' });
      repository.update.mockResolvedValue(updated);

      const result = await controller.update('cfg-1', { name: 'Renamed' } as any);

      expect(repository.update).toHaveBeenCalledWith('cfg-1', { name: 'Renamed' });
      expect(result?.name).toBe('Renamed');
    });

    it('should allow ANY user to update ANY config (global access)', async () => {
      // Config created by user 99 — user 1 may still update it.
      repository.findById.mockResolvedValue(makeConfig({ userId: 99 }));
      repository.update.mockResolvedValue(makeConfig({ userId: 99, name: 'X' }));

      const result = await controller.update('cfg-1', { name: 'X' } as any);

      expect(repository.update).toHaveBeenCalledWith('cfg-1', { name: 'X' });
      expect(result?.name).toBe('X');
    });

    it('should return null when the config does not exist', async () => {
      repository.update.mockResolvedValue(null);

      const result = await controller.update('missing', { name: 'X' } as any);

      expect(result).toBeNull();
    });
  });

  describe('remove', () => {
    it('should remove the config (no ownership check — global access)', async () => {
      repository.remove.mockResolvedValue(undefined);

      await controller.remove('cfg-1');

      expect(repository.remove).toHaveBeenCalledWith('cfg-1');
    });

    it('should allow ANY user to remove ANY config (global access)', async () => {
      repository.remove.mockResolvedValue(undefined);

      await controller.remove('cfg-1');

      expect(repository.remove).toHaveBeenCalledWith('cfg-1');
    });
  });
});