import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { McpLoaderService } from './mcp-loader.service';
import { McpServerRepository } from '../mcp-server.repository';
import type { McpServer } from '../../domain/mcp-server';
import type { StructuredTool } from '@langchain/core/tools';

describe('McpLoaderService', () => {
  let service: McpLoaderService;
  let mcpServerRepo: jest.Mocked<McpServerRepository>;
  let createClient: jest.Mock;
  let getTools: jest.Mock;

  const makeServer = (overrides: Partial<McpServer> = {}): McpServer =>
    ({
      id: 'srv-1',
      agentConfigId: null,
      name: 'weather',
      transport: 'http',
      url: 'http://localhost:8000/mcp',
      apiKeyRef: null,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as McpServer;

  const makeTool = (name: string): StructuredTool =>
    ({ name } as unknown as StructuredTool);

  beforeEach(async () => {
    getTools = jest.fn();
    createClient = jest.fn().mockReturnValue({ getTools });

    const repoMock = {
      findEnabledByIds: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        McpLoaderService,
        { provide: McpServerRepository, useValue: repoMock },
        {
          provide: ConfigService,
          useValue: {
            get: (k: string) =>
              k === 'ka.localMcpUrl'
                ? 'http://localhost:3000/api/v1/_mcp/tools'
                : null,
          },
        },
      ],
    }).compile();
    service = module.get<McpLoaderService>(McpLoaderService);
    mcpServerRepo = module.get(McpServerRepository) as jest.Mocked<McpServerRepository>;
    service['logger'] = new Logger() as unknown as Logger;
    service['createMcpClient'] = createClient;
  });

  afterEach(() => jest.clearAllMocks());

  it('should load tools from enabled MCP servers from DB', async () => {
    mcpServerRepo.findEnabledByIds.mockResolvedValue([
      makeServer({ id: 'srv-1', name: 'weather' }),
    ]);
    getTools.mockResolvedValue([makeTool('get_weather')]);

    const tools = await service.load(['srv-1']);

    expect(mcpServerRepo.findEnabledByIds).toHaveBeenCalledWith(['srv-1']);
    expect(tools).toHaveLength(1);
    expect((tools[0] as unknown as { name: string }).name).toBe('get_weather');
  });

  it('should include the local McpModule as an internal MCP server', async () => {
    mcpServerRepo.findEnabledByIds.mockResolvedValue([]);
    getTools.mockResolvedValue([makeTool('local_introspect')]);

    const tools = await service.load([]);

    expect(
      tools.map((t) => (t as unknown as { name: string }).name),
    ).toContain('local_introspect');
    expect(createClient).toHaveBeenCalledWith(
      expect.objectContaining({
        __local_introspection__: expect.objectContaining({ transport: 'http' }),
      }),
    );
  });

  it('should timeout after 3s if a server is down (graceful degradation)', async () => {
    mcpServerRepo.findEnabledByIds.mockResolvedValue([
      makeServer({ name: 'down-srv' }),
    ]);
    getTools.mockImplementation(() => new Promise(() => {})); // never resolves

    const start = Date.now();
    const tools = await service.load(['srv-1']);
    const elapsed = Date.now() - start;

    expect(tools).toEqual([]);
    expect(elapsed).toBeLessThan(5000);
  });

  it('should return empty array (not throw) if all servers are down', async () => {
    mcpServerRepo.findEnabledByIds.mockResolvedValue([
      makeServer({ name: 'srv-a' }),
      makeServer({ name: 'srv-b' }),
    ]);
    getTools.mockRejectedValue(new Error('connection refused'));

    const tools = await service.load(['srv-a', 'srv-b']);

    expect(tools).toEqual([]);
  });

  it('should merge tools from multiple servers + local', async () => {
    mcpServerRepo.findEnabledByIds.mockResolvedValue([
      makeServer({ id: 's1', name: 'a' }),
      makeServer({ id: 's2', name: 'b' }),
    ]);
    getTools.mockResolvedValue([
      makeTool('tool_a'),
      makeTool('tool_b'),
      makeTool('local_tool'),
    ]);

    const tools = await service.load(['s1', 's2']);

    const names = tools.map((t) => (t as unknown as { name: string }).name);
    expect(names).toEqual(
      expect.arrayContaining(['tool_a', 'tool_b', 'local_tool']),
    );
  });

  it('should skip stdio servers that have no command configured', async () => {
    mcpServerRepo.findEnabledByIds.mockResolvedValue([
      makeServer({ name: 'broken-stdio', transport: 'stdio', url: '' }),
    ]);
    // Only local remains; the broken-stdio server must NOT be in the config.
    getTools.mockResolvedValue([]);

    const tools = await service.load(['srv-1']);

    expect(tools).toEqual([]);
    const cfg = createClient.mock.calls[0][0];
    expect(cfg['broken-stdio']).toBeUndefined();
  });
});