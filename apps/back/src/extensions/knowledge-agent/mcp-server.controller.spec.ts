import { Test, TestingModule } from '@nestjs/testing';
import { McpServerController } from './mcp-server.controller';
import { McpServerRepository } from './infrastructure/mcp-server.repository';
import type { McpServer } from './domain/mcp-server';

const makeServer = (overrides: Partial<McpServer> = {}): McpServer =>
  ({
    id: 'srv-1',
    agentConfigId: 'cfg-1',
    name: 'GitHub MCP',
    transport: 'http',
    url: 'https://mcp.github.com/sse',
    apiKeyRef: 'GITHUB_TOKEN',
    enabled: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  }) as McpServer;

describe('McpServerController', () => {
  let controller: McpServerController;
  let repository: jest.Mocked<McpServerRepository>;

  beforeEach(async () => {
    const mockRepo = {
      create: jest.fn(),
      find: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [McpServerController],
      providers: [{ provide: McpServerRepository, useValue: mockRepo }],
    }).compile();

    controller = module.get<McpServerController>(McpServerController);
    repository = module.get(McpServerRepository) as unknown as jest.Mocked<McpServerRepository>;
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create an MCP server (any authenticated user)', async () => {
      const server = makeServer();
      repository.create.mockResolvedValue(server);

      const result = await controller.create({
        name: 'GitHub MCP',
        transport: 'http',
        url: 'https://mcp.github.com/sse',
        apiKeyRef: 'GITHUB_TOKEN',
        enabled: true,
      });

      expect(repository.create).toHaveBeenCalledWith({
        name: 'GitHub MCP',
        transport: 'http',
        url: 'https://mcp.github.com/sse',
        apiKeyRef: 'GITHUB_TOKEN',
        enabled: true,
      });
      expect(result).toBe(server);
    });
  });

  describe('findAll', () => {
    it('should list all MCP servers (any authenticated user)', async () => {
      const servers = [makeServer(), makeServer({ id: 'srv-2' })];
      repository.find.mockResolvedValue(servers);

      const result = await controller.findAll();

      expect(repository.find).toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });

    it('should accept an optional agentConfigId filter query param', async () => {
      repository.find.mockResolvedValue([makeServer()]);

      await controller.findAll('cfg-1');

      // The controller currently ignores the query param (delegates to find()),
      // but it must not throw when it is present.
      expect(repository.find).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should return an MCP server by id', async () => {
      repository.findById.mockResolvedValue(makeServer());

      const result = await controller.findById('srv-1');

      expect(repository.findById).toHaveBeenCalledWith('srv-1');
      expect(result?.id).toBe('srv-1');
    });

    it('should return null when the server does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      const result = await controller.findById('missing');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update an MCP server', async () => {
      const updated = makeServer({ name: 'Renamed' });
      repository.update.mockResolvedValue(updated);

      const result = await controller.update('srv-1', { name: 'Renamed' } as any);

      expect(repository.update).toHaveBeenCalledWith('srv-1', { name: 'Renamed' });
      expect(result.name).toBe('Renamed');
    });
  });

  describe('remove', () => {
    it('should remove an MCP server', async () => {
      repository.remove.mockResolvedValue(undefined);

      await controller.remove('srv-1');

      expect(repository.remove).toHaveBeenCalledWith('srv-1');
    });
  });

  describe('RBAC metadata', () => {
    /**
     * MCP servers are manageable by any authenticated user (no @Roles).
     * The guard chain is `@JwtAuth()` at class level — no RolesGuard, no
     * role metadata. Assert the absence of `roles` metadata so this stays
     * intentional and is not accidentally tightened later.
     */
    it('should NOT declare roles on create (any authenticated user)', () => {
      const meta = Reflect.getMetadata('roles', controller.create);
      expect(meta).toBeUndefined();
    });

    it('should NOT declare roles on update (any authenticated user)', () => {
      const meta = Reflect.getMetadata('roles', controller.update);
      expect(meta).toBeUndefined();
    });

    it('should NOT declare roles on remove (any authenticated user)', () => {
      const meta = Reflect.getMetadata('roles', controller.remove);
      expect(meta).toBeUndefined();
    });

    it('should NOT declare roles on findAll', () => {
      const meta = Reflect.getMetadata('roles', controller.findAll);
      expect(meta).toBeUndefined();
    });
  });
});