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
    ({ name }) as unknown as StructuredTool;

  beforeEach(async () => {
    getTools = jest.fn();
    createClient = jest.fn().mockImplementation(() => ({
      getTools,
      close: jest.fn().mockResolvedValue(undefined),
    }));

    const repoMock = {
      findEnabledByIds: jest.fn(),
      findAllEnabled: jest.fn().mockResolvedValue([]),
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
    mcpServerRepo = module.get(
      McpServerRepository,
    ) as jest.Mocked<McpServerRepository>;
    service['logger'] = new Logger() as unknown as Logger;
    service['createMcpClient'] = createClient;
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.MCP_TEST_KEY;
  });

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

  it('should load ALL enabled servers when mcpServerIds is empty (integration menu)', async () => {
    mcpServerRepo.findAllEnabled.mockResolvedValue([
      makeServer({ id: 'tav-1', name: 'tavily' }),
    ]);
    getTools.mockResolvedValue([makeTool('tavily_search')]);

    const tools = await service.load([]);

    expect(mcpServerRepo.findAllEnabled).toHaveBeenCalled();
    expect(mcpServerRepo.findEnabledByIds).not.toHaveBeenCalled();
    expect(tools.map((t) => (t as unknown as { name: string }).name)).toContain(
      'tavily_search',
    );
    expect(createClient).toHaveBeenCalledWith(
      expect.objectContaining({
        tavily: expect.objectContaining({ transport: 'http' }),
      }),
    );
  });

  it('should timeout (20s cap) if a server is down (graceful degradation)', async () => {
    jest.useFakeTimers();
    mcpServerRepo.findEnabledByIds.mockResolvedValue([
      makeServer({ name: 'down-srv' }),
    ]);
    getTools.mockImplementation(() => new Promise(() => {})); // never resolves

    const promise = service.load(['srv-1']);
    // Flush the async chain (repo → allSettled → acquireClient) so the
    // per-server timeout timer exists on the fake clock before advancing.
    for (let i = 0; i < 25; i++) await Promise.resolve();
    jest.advanceTimersByTime(20_500);
    const tools = await promise;
    jest.useRealTimers();

    expect(tools).toEqual([]);
  });

  it('should isolate failures: a dead server must not poison healthy ones', async () => {
    mcpServerRepo.findEnabledByIds.mockResolvedValue([
      makeServer({ id: 's-dead', name: 'dead' }),
      makeServer({ id: 's-alive', name: 'alive' }),
    ]);
    getTools
      .mockRejectedValueOnce(new Error('connection refused'))
      .mockResolvedValueOnce([makeTool('healthy_tool')]);

    const tools = await service.load(['s-dead', 's-alive']);

    expect(createClient).toHaveBeenCalledTimes(2);
    const names = tools.map((t) => (t as unknown as { name: string }).name);
    expect(names).toEqual(['healthy_tool']);
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

  it('should merge tools from multiple servers', async () => {
    mcpServerRepo.findEnabledByIds.mockResolvedValue([
      makeServer({ id: 's1', name: 'a' }),
      makeServer({ id: 's2', name: 'b' }),
    ]);
    getTools
      .mockResolvedValueOnce([makeTool('tool_a')])
      .mockResolvedValueOnce([makeTool('tool_b')]);

    const tools = await service.load(['s1', 's2']);

    const names = tools.map((t) => (t as unknown as { name: string }).name);
    expect(names).toEqual(expect.arrayContaining(['tool_a', 'tool_b']));
  });

  it('should reuse a cached client when the connection signature is unchanged', async () => {
    mcpServerRepo.findEnabledByIds.mockResolvedValue([
      makeServer({ id: 'srv-1' }),
    ]);
    getTools.mockResolvedValue([makeTool('get_weather')]);

    await service.load(['srv-1']);
    await service.load(['srv-1']);

    expect(createClient).toHaveBeenCalledTimes(1);
  });

  it('should reconnect (and close the stale client) when url changes', async () => {
    mcpServerRepo.findEnabledByIds
      .mockResolvedValueOnce([makeServer({ id: 'srv-1', url: 'http://old/' })])
      .mockResolvedValueOnce([makeServer({ id: 'srv-1', url: 'http://new/' })]);
    getTools.mockResolvedValue([makeTool('get_weather')]);

    await service.load(['srv-1']);
    await service.load(['srv-1']);

    expect(createClient).toHaveBeenCalledTimes(2);
  });

  it('should skip stdio servers that have no command configured', async () => {
    mcpServerRepo.findEnabledByIds.mockResolvedValue([
      makeServer({ name: 'broken-stdio', transport: 'stdio', url: '' }),
    ]);
    getTools.mockResolvedValue([]);

    // With the broken server filtered out, no client is ever created —
    // load() degrades to [] per server.
    const tools = await service.load(['srv-1']);

    expect(tools).toEqual([]);
    expect(createClient).not.toHaveBeenCalled();
  });

  it('should inject Authorization bearer from the env var named by apiKeyRef', async () => {
    process.env.MCP_TEST_KEY = 'secret-sauce';
    mcpServerRepo.findEnabledByIds.mockResolvedValue([
      makeServer({ apiKeyRef: 'MCP_TEST_KEY' }),
    ]);
    getTools.mockResolvedValue([makeTool('get_weather')]);

    await service.load(['srv-1']);

    expect(createClient).toHaveBeenCalledWith(
      expect.objectContaining({
        weather: expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer secret-sauce',
          }),
        }),
      }),
    );
  });

  it('should NOT override an explicit Authorization header with apiKeyRef', async () => {
    process.env.MCP_TEST_KEY = 'env-secret';
    mcpServerRepo.findEnabledByIds.mockResolvedValue([
      makeServer({
        apiKeyRef: 'MCP_TEST_KEY',
        headers: { Authorization: 'Bearer explicit-header' },
      }),
    ]);
    getTools.mockResolvedValue([makeTool('get_weather')]);

    await service.load(['srv-1']);

    expect(createClient).toHaveBeenCalledWith(
      expect.objectContaining({
        weather: expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer explicit-header',
          }),
        }),
      }),
    );
  });

  it('should warn and skip injection when the apiKeyRef env var is missing', async () => {
    delete process.env.MCP_UNSET_KEY;
    mcpServerRepo.findEnabledByIds.mockResolvedValue([
      makeServer({ apiKeyRef: 'MCP_UNSET_KEY' }),
    ]);
    getTools.mockResolvedValue([makeTool('get_weather')]);

    await service.load(['srv-1']);

    const call = createClient.mock.calls[0][0] as {
      weather?: { headers?: Record<string, string> };
    };
    expect(call.weather?.headers).toBeUndefined();
  });

  it('should produce a different snapshot key when an MCP row changes', async () => {
    mcpServerRepo.findEnabledByIds.mockResolvedValue([
      makeServer({ url: 'http://old/' }),
    ]);
    const before = await service.getSnapshotKey(['srv-1']);

    mcpServerRepo.findEnabledByIds.mockResolvedValue([
      makeServer({ url: 'http://new/' }),
    ]);
    const after = await service.getSnapshotKey(['srv-1']);

    expect(before).not.toBe(after);
  });

  it('should produce a stable snapshot key for identical rows', async () => {
    mcpServerRepo.findEnabledByIds.mockResolvedValue([
      makeServer({ name: 'a' }),
      makeServer({ name: 'b' }),
    ]);
    const a = await service.getSnapshotKey(['srv-1']);
    const b = await service.getSnapshotKey(['srv-1']);

    expect(a).toBe(b);
  });

  it('should keep the snapshot key stable regardless of server order', async () => {
    mcpServerRepo.findEnabledByIds
      .mockResolvedValueOnce([
        makeServer({ id: 's1', name: 'a' }),
        makeServer({ id: 's2', name: 'b' }),
      ])
      .mockResolvedValueOnce([
        makeServer({ id: 's2', name: 'b' }),
        makeServer({ id: 's1', name: 'a' }),
      ]);

    const a = await service.getSnapshotKey(['s1', 's2']);
    const b = await service.getSnapshotKey(['s1', 's2']);

    expect(a).toBe(b);
  });
});
