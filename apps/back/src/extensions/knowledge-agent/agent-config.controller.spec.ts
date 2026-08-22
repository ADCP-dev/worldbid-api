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
      findByUserId: jest.fn(),
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
    it('should create a config scoped to the authenticated user', async () => {
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
    it('should list only configs belonging to the user', async () => {
      const configs = [makeConfig({ userId: 1 })];
      repository.findByUserId.mockResolvedValue(configs);

      const result = await controller.findAll(1);

      expect(repository.findByUserId).toHaveBeenCalledWith(1);
      expect(result.every((c) => c.userId === 1)).toBe(true);
    });
  });

  describe('findById', () => {
    it('should return the config when it belongs to the user', async () => {
      repository.findById.mockResolvedValue(makeConfig({ userId: 1 }));

      const result = await controller.findById('cfg-1', 1);

      expect(repository.findById).toHaveBeenCalledWith('cfg-1');
      expect(result?.id).toBe('cfg-1');
    });

    it('should return null when the config belongs to another user (no leak)', async () => {
      repository.findById.mockResolvedValue(makeConfig({ userId: 99 }));

      const result = await controller.findById('cfg-1', 1);

      expect(result).toBeNull();
    });

    it('should return null when the config does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      const result = await controller.findById('missing', 1);

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update the config when it belongs to the user', async () => {
      repository.findById.mockResolvedValue(makeConfig({ userId: 1 }));
      const updated = makeConfig({ name: 'Renamed' });
      repository.update.mockResolvedValue(updated);

      const result = await controller.update('cfg-1', { name: 'Renamed' } as any, 1);

      expect(repository.update).toHaveBeenCalledWith('cfg-1', { name: 'Renamed' });
      expect(result?.name).toBe('Renamed');
    });

    it('should return null (no mutation) when the config belongs to another user', async () => {
      repository.findById.mockResolvedValue(makeConfig({ userId: 99 }));

      const result = await controller.update('cfg-1', { name: 'X' } as any, 1);

      expect(repository.update).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should return null (no mutation) when the config does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      const result = await controller.update('missing', { name: 'X' } as any, 1);

      expect(repository.update).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe('remove', () => {
    it('should remove the config when it belongs to the user', async () => {
      repository.findById.mockResolvedValue(makeConfig({ userId: 1 }));
      repository.remove.mockResolvedValue(undefined);

      await controller.remove('cfg-1', 1);

      expect(repository.remove).toHaveBeenCalledWith('cfg-1');
    });

    it('should NOT remove (silent) when the config belongs to another user', async () => {
      repository.findById.mockResolvedValue(makeConfig({ userId: 99 }));

      await controller.remove('cfg-1', 1);

      expect(repository.remove).not.toHaveBeenCalled();
    });

    it('should NOT remove (silent) when the config does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await controller.remove('missing', 1);

      expect(repository.remove).not.toHaveBeenCalled();
    });
  });
});