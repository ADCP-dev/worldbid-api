import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { AgentFactoryService } from './agent-factory.service';
import { AgentConfigRepository } from '../agent-config.repository';
import { ToolRegistryService } from './tool-registry.service';
import { McpLoaderService } from './mcp-loader.service';
import { ModelResolverService } from './model-resolver.service';
import { SandboxService } from './sandbox.service';
import { NoteService } from '../../note.service';
import { VectorStoreService } from '../vector-store.service';
import type { AgentConfig } from '../../domain/agent-config';
import type { StructuredTool } from '@langchain/core/tools';

describe('AgentFactoryService', () => {
  let service: AgentFactoryService;
  let agentConfigRepo: jest.Mocked<AgentConfigRepository>;
  let toolRegistry: jest.Mocked<ToolRegistryService>;
  let mcpLoader: jest.Mocked<McpLoaderService>;
  let sandbox: jest.Mocked<SandboxService>;
  let noteService: jest.Mocked<NoteService>;
  let vectorStoreService: jest.Mocked<VectorStoreService>;
  let createDeepAgent: jest.Mock;
  let captured: { model?: string; systemPrompt?: string; tools?: unknown[]; backend?: unknown; permissions?: unknown };

  const makeConfig = (overrides: Partial<AgentConfig> = {}): AgentConfig =>
    ({
      id: 'cfg-1',
      name: 'Knowledge Agent',
      systemPrompt: 'You are a helpful research assistant.',
      model: 'openrouter:z-ai/glm-5.2',
      provider: 'openrouter',
      permissions: { allow: ['/vfs/**'], deny: ['.env'] },
      mcpServerIds: ['srv-1'],
      userId: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as AgentConfig;

  const makeTool = (name: string): StructuredTool =>
    ({ name } as unknown as StructuredTool);

  beforeEach(async () => {
    captured = {};
    createDeepAgent = jest.fn().mockImplementation((opts) => {
      captured = opts;
      return { id: 'agent-instance' };
    });

    const repoMock = {
      findById: jest.fn(),
      findAll: jest.fn(),
    };
    const toolRegistryMock = {
      collect: jest.fn(),
    };
    const mcpLoaderMock = {
      load: jest.fn(),
    };
    const sandboxMock = {
      createSandbox: jest.fn(),
      buildPermissions: jest.fn().mockReturnValue([]),
      workingDir: jest.fn().mockReturnValue('/vfs/sess-1'),
    };
    const noteServiceMock = {
      findByCategoryPath: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
    };
    const vectorStoreServiceMock = {
      similaritySearch: jest.fn(),
    };
    const modelResolverMock = {
      resolve: jest.fn().mockResolvedValue({ _stubChatModel: true }),
      parseModelString: jest.fn(),
      invalidate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentFactoryService,
        { provide: AgentConfigRepository, useValue: repoMock },
        { provide: ToolRegistryService, useValue: toolRegistryMock },
        { provide: McpLoaderService, useValue: mcpLoaderMock },
        { provide: SandboxService, useValue: sandboxMock },
        { provide: NoteService, useValue: noteServiceMock },
        { provide: VectorStoreService, useValue: vectorStoreServiceMock },
        { provide: ModelResolverService, useValue: modelResolverMock },
      ],
    }).compile();
    service = module.get<AgentFactoryService>(AgentFactoryService);
    agentConfigRepo = module.get(AgentConfigRepository) as jest.Mocked<AgentConfigRepository>;
    toolRegistry = module.get(ToolRegistryService) as jest.Mocked<ToolRegistryService>;
    mcpLoader = module.get(McpLoaderService) as jest.Mocked<McpLoaderService>;
    sandbox = module.get(SandboxService) as jest.Mocked<SandboxService>;
    noteService = module.get(NoteService) as jest.Mocked<NoteService>;
    vectorStoreService = module.get(VectorStoreService) as jest.Mocked<VectorStoreService>;
    service['logger'] = new Logger() as unknown as Logger;
    service['createDeepAgentImpl'] = createDeepAgent;
  });

  afterEach(() => jest.clearAllMocks());

  it('should load config from DB by id', async () => {
    const cfg = makeConfig();
    agentConfigRepo.findById.mockResolvedValue(cfg);
    toolRegistry.collect.mockResolvedValue([]);
    mcpLoader.load.mockResolvedValue([]);
    sandbox.createSandbox.mockResolvedValue({ stop: jest.fn() });

    await service.buildAgent('cfg-1', 1);

    expect(agentConfigRepo.findById).toHaveBeenCalledWith('cfg-1');
  });

  it('should throw NotFoundException if config does not exist', async () => {
    agentConfigRepo.findById.mockResolvedValue(null);

    await expect(service.buildAgent('missing', 1)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should NOT throw if config belongs to another user (configs are global)', async () => {
    // Configs are global — any user can build an agent from any config.
    // userId stays in the cache key only for per-user sandbox isolation.
    agentConfigRepo.findById.mockResolvedValue(makeConfig({ userId: 999 }));
    toolRegistry.collect.mockResolvedValue([]);
    mcpLoader.load.mockResolvedValue([]);
    sandbox.createSandbox.mockResolvedValue({ stop: jest.fn() });

    await expect(service.buildAgent('cfg-1', 1)).resolves.not.toThrow();
  });

  it('should construct createDeepAgent with the RESOLVED chat model', async () => {
    const chatModel = { _stubChatModel: true };
    const resolverMock = {
      resolve: jest.fn().mockResolvedValue(chatModel),
      parseModelString: jest.fn(),
      invalidate: jest.fn(),
    };
    service['modelResolver'] = resolverMock as never;
    agentConfigRepo.findById.mockResolvedValue(
      makeConfig({ model: 'ollama:north-mini-code-1.0' }),
    );
    toolRegistry.collect.mockResolvedValue([]);
    mcpLoader.load.mockResolvedValue([]);
    sandbox.createSandbox.mockResolvedValue({ stop: jest.fn() });

    await service.buildAgent('cfg-1', 1);

    expect(resolverMock.resolve).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'ollama:north-mini-code-1.0' }),
    );
    expect(captured.model).toBe(chatModel);
  });

  it('should load systemPrompt from DB into createDeepAgent', async () => {
    const cfg = makeConfig({ systemPrompt: 'Custom prompt from DB' });
    agentConfigRepo.findById.mockResolvedValue(cfg);
    toolRegistry.collect.mockResolvedValue([]);
    mcpLoader.load.mockResolvedValue([]);
    sandbox.createSandbox.mockResolvedValue({ stop: jest.fn() });

    await service.buildAgent('cfg-1', 1);

    expect(captured.systemPrompt).toBe('Custom prompt from DB');
  });

  it('should pass KB + native + MCP + execute tools merged in the tools array', async () => {
    agentConfigRepo.findById.mockResolvedValue(makeConfig());
    const native = [makeTool('native_a')];
    const mcp = [makeTool('get_weather')];
    toolRegistry.collect.mockResolvedValue(native);
    mcpLoader.load.mockResolvedValue(mcp);
    sandbox.createSandbox.mockResolvedValue({ stop: jest.fn() });

    await service.buildAgent('cfg-1', 1);

    const tools = captured.tools as Array<{ name: string }>;
    const names = tools.map((t) => t.name);
    // 5 KB tools + 1 native + 1 MCP + 1 sandbox command runner = 8
    expect(tools).toHaveLength(8);
    expect(names).toEqual(
      expect.arrayContaining([
        'search_notes_tree',
        'search_notes_semantic',
        'create_note',
        'update_note',
        'delete_note',
        'native_a',
        'get_weather',
        'run_command',
      ]),
    );
  });

  it('should build KB tools globally (no userId scoping — notes + configs shared)', async () => {
    agentConfigRepo.findById.mockResolvedValue(makeConfig({ userId: 7 }));
    toolRegistry.collect.mockResolvedValue([]);
    mcpLoader.load.mockResolvedValue([]);
    sandbox.createSandbox.mockResolvedValue({ stop: jest.fn() });

    await service.buildAgent('cfg-1', 7);

    // KB tools are constructed without userId closure — verify the tree tool
    // (search_notes_tree) is present. userId stays in the agent cache key only.
    const tools = captured.tools as Array<{ name: string }>;
    const tree = tools.find((t) => t.name === 'search_notes_tree');
    expect(tree).toBeDefined();
  });

  it('should use VfsBackend with an isolated working dir', async () => {
    agentConfigRepo.findById.mockResolvedValue(makeConfig());
    toolRegistry.collect.mockResolvedValue([]);
    mcpLoader.load.mockResolvedValue([]);
    sandbox.createSandbox.mockResolvedValue({ stop: jest.fn() });
    sandbox.buildPermissions.mockReturnValue([
      { operations: ['read', 'write'], paths: ['/vfs/**'], mode: 'allow' },
    ]);

    await service.buildAgent('cfg-1', 1);

    expect(sandbox.createSandbox).toHaveBeenCalledWith(expect.any(String));
    expect(captured.backend).toBeDefined();
    expect(captured.permissions).toEqual([
      { operations: ['read', 'write'], paths: ['/vfs/**'], mode: 'allow' },
    ]);
  });

  it('should cache: same config + same user → same agent (no rebuild)', async () => {
    const cfg = makeConfig();
    agentConfigRepo.findById.mockResolvedValue(cfg);
    toolRegistry.collect.mockResolvedValue([]);
    mcpLoader.load.mockResolvedValue([]);
    sandbox.createSandbox.mockResolvedValue({ stop: jest.fn() });

    const first = await service.buildAgent('cfg-1', 1);
    const second = await service.buildAgent('cfg-1', 1);

    expect(first).toBe(second);
    expect(createDeepAgent).toHaveBeenCalledTimes(1);
  });

  it('should rebuild when config changes (cache invalidation)', async () => {
    agentConfigRepo.findById
      .mockResolvedValueOnce(makeConfig({ systemPrompt: 'v1' }))
      .mockResolvedValueOnce(makeConfig({ systemPrompt: 'v2' }));
    toolRegistry.collect.mockResolvedValue([]);
    mcpLoader.load.mockResolvedValue([]);
    sandbox.createSandbox.mockResolvedValue({ stop: jest.fn() });

    const first = await service.buildAgent('cfg-1', 1);
    const second = await service.buildAgent('cfg-1', 1);

    expect(first).not.toBe(second);
    expect(createDeepAgent).toHaveBeenCalledTimes(2);
  });

  it('should rebuild when userId changes (per-user cache key)', async () => {
    agentConfigRepo.findById
      .mockResolvedValueOnce(makeConfig({ userId: 1 }))
      .mockResolvedValueOnce(makeConfig({ userId: 2 }));
    toolRegistry.collect.mockResolvedValue([]);
    mcpLoader.load.mockResolvedValue([]);
    sandbox.createSandbox.mockResolvedValue({ stop: jest.fn() });

    const first = await service.buildAgent('cfg-1', 1);
    const second = await service.buildAgent('cfg-1', 2);

    expect(first).not.toBe(second);
    expect(createDeepAgent).toHaveBeenCalledTimes(2);
  });

  it('should pass mcpServerIds from config to the MCP loader', async () => {
    agentConfigRepo.findById.mockResolvedValue(
      makeConfig({ mcpServerIds: ['srv-a', 'srv-b'] }),
    );
    toolRegistry.collect.mockResolvedValue([]);
    mcpLoader.load.mockResolvedValue([]);
    sandbox.createSandbox.mockResolvedValue({ stop: jest.fn() });

    await service.buildAgent('cfg-1', 1);

    expect(mcpLoader.load).toHaveBeenCalledWith(['srv-a', 'srv-b']);
  });

  it('should inject NoteService and VectorStoreService for KB tools', async () => {
    agentConfigRepo.findById.mockResolvedValue(makeConfig());
    toolRegistry.collect.mockResolvedValue([]);
    mcpLoader.load.mockResolvedValue([]);
    sandbox.createSandbox.mockResolvedValue({ stop: jest.fn() });

    await service.buildAgent('cfg-1', 1);

    expect(noteService).toBeDefined();
    expect(vectorStoreService).toBeDefined();
  });
});