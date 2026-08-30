import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { AgentFactoryService } from './agent-factory.service';
import { AgentConfigRepository } from '../agent-config.repository';
import { ToolRegistryService } from './tool-registry.service';
import { McpLoaderService } from './mcp-loader.service';
import { ModelResolverService } from './model-resolver.service';
import { SqlQueryService } from '../../tools/sql-query.tool';
import { SandboxService } from './sandbox.service';
import { NoteService } from '../../note.service';
import { VectorStoreService } from '../vector-store.service';
import { UsersService } from '@users/users.service';
import { RoleEnum } from '@iam/roles/roles.enum';
import type { User } from '@users/domain/user';
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
  let usersService: jest.Mocked<UsersService>;
  let sqlQuery: { run: jest.Mock; createTool: jest.Mock };
  let createDeepAgent: jest.Mock;
  let captured: {
    model?: string;
    systemPrompt?: string;
    tools?: unknown[];
    backend?: unknown;
    permissions?: unknown;
  };

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
    ({ name }) as unknown as StructuredTool;

  /** Partial domain user — only the role drives the sql_query_readonly gate. */
  const makeUser = (roleId: RoleEnum): User =>
    ({ id: 1, role: { id: roleId } }) as unknown as User;

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
      getSnapshotKey: jest.fn().mockResolvedValue('sig-v1'),
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
    const sqlToolStub = {
      name: 'sql_query_readonly',
    };
    sqlQuery = {
      run: jest.fn(),
      createTool: jest.fn().mockReturnValue(sqlToolStub),
    };
    const usersServiceMock = {
      // Default: requesting user is admin → sql_query_readonly included.
      findById: jest.fn().mockResolvedValue(makeUser(RoleEnum.admin)),
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
        { provide: SqlQueryService, useValue: sqlQuery },
        { provide: UsersService, useValue: usersServiceMock },
      ],
    }).compile();
    service = module.get<AgentFactoryService>(AgentFactoryService);
    agentConfigRepo = module.get(
      AgentConfigRepository,
    ) as jest.Mocked<AgentConfigRepository>;
    toolRegistry = module.get(
      ToolRegistryService,
    ) as jest.Mocked<ToolRegistryService>;
    mcpLoader = module.get(McpLoaderService) as jest.Mocked<McpLoaderService>;
    sandbox = module.get(SandboxService) as jest.Mocked<SandboxService>;
    noteService = module.get(NoteService) as jest.Mocked<NoteService>;
    vectorStoreService = module.get(
      VectorStoreService,
    ) as jest.Mocked<VectorStoreService>;
    usersService = module.get(UsersService) as jest.Mocked<UsersService>;
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

  it('should pass KB + native + MCP + execute tools merged in the tools array (admin user)', async () => {
    agentConfigRepo.findById.mockResolvedValue(makeConfig());
    const native = [makeTool('native_a')];
    const mcp = [makeTool('get_weather')];
    toolRegistry.collect.mockResolvedValue(native);
    mcpLoader.load.mockResolvedValue(mcp);
    sandbox.createSandbox.mockResolvedValue({ stop: jest.fn() });

    await service.buildAgent('cfg-1', 1);

    const tools = captured.tools as Array<{ name: string }>;
    const names = tools.map((t) => t.name);
    // 7 KB tools (list_categories, list_notes, search_notes_semantic,
    // get_note, create, update, delete) + 1 native + 1 MCP + 1 sql_readonly
    // (ADMIN ONLY — default mock user is admin) + 1 execute_js (isolated
    // QuickJS eval) + 1 get_current_datetime (server clock) = 12. No
    // run_command: deepagents wires the filesystem natively from the
    // VfsBackend and VfsBackend has no execute() method.
    expect(tools).toHaveLength(12);
    expect(names).toEqual(
      expect.arrayContaining([
        'list_categories',
        'list_notes',
        'search_notes_semantic',
        'get_note',
        'create_note',
        'update_note',
        'delete_note',
        'native_a',
        'get_weather',
        'sql_query_readonly',
        'execute_js',
        'get_current_datetime',
      ]),
    );
    expect(names).not.toContain('run_command');
  });

  it('should NOT include sql_query_readonly for non-admin users (SQL tool is admin-only)', async () => {
    agentConfigRepo.findById.mockResolvedValue(makeConfig());
    toolRegistry.collect.mockResolvedValue([]);
    mcpLoader.load.mockResolvedValue([]);
    sandbox.createSandbox.mockResolvedValue({ stop: jest.fn() });
    usersService.findById.mockResolvedValue(makeUser(RoleEnum.customer));

    await service.buildAgent('cfg-1', 1);

    const tools = captured.tools as Array<{ name: string }>;
    const names = tools.map((t) => t.name);
    // sql_query_readonly withheld: its SELECTs are NOT user-scoped, so a
    // non-admin agent could read other users' rows (cross-user exposure).
    // 7 KB tools + execute_js + get_current_datetime = 9 (no native/mcp stubs
    // registered in this scenario).
    expect(tools).toHaveLength(9);
    expect(names).not.toContain('sql_query_readonly');
    expect(sqlQuery.createTool).not.toHaveBeenCalled();
    // The non-SQL utility tools are still available to non-admins.
    expect(names).toEqual(
      expect.arrayContaining(['execute_js', 'get_current_datetime']),
    );
  });

  it('should fail closed when the user cannot be found (no sql tool)', async () => {
    agentConfigRepo.findById.mockResolvedValue(makeConfig());
    toolRegistry.collect.mockResolvedValue([]);
    mcpLoader.load.mockResolvedValue([]);
    sandbox.createSandbox.mockResolvedValue({ stop: jest.fn() });
    usersService.findById.mockResolvedValue(null);

    await service.buildAgent('cfg-1', 1);

    const tools = captured.tools as Array<{ name: string }>;
    expect(tools.map((t) => t.name)).not.toContain('sql_query_readonly');
    expect(tools).toHaveLength(9);
  });

  it('should fail closed when the role lookup errors (no sql tool)', async () => {
    agentConfigRepo.findById.mockResolvedValue(makeConfig());
    toolRegistry.collect.mockResolvedValue([]);
    mcpLoader.load.mockResolvedValue([]);
    sandbox.createSandbox.mockResolvedValue({ stop: jest.fn() });
    usersService.findById.mockRejectedValue(new Error('db down'));

    await expect(service.buildAgent('cfg-1', 1)).resolves.toBeDefined();

    const tools = captured.tools as Array<{ name: string }>;
    expect(tools.map((t) => t.name)).not.toContain('sql_query_readonly');
    expect(tools).toHaveLength(9);
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
    const tree = tools.find((t) => t.name === 'list_notes');
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
    expect(mcpLoader.getSnapshotKey).toHaveBeenCalledWith(['srv-a', 'srv-b']);
  });

  it('should keep the cached agent when the MCP signature is unchanged', async () => {
    agentConfigRepo.findById.mockResolvedValue(makeConfig());
    toolRegistry.collect.mockResolvedValue([]);
    mcpLoader.load.mockResolvedValue([]);
    mcpLoader.getSnapshotKey.mockResolvedValue('sig-v1');
    sandbox.createSandbox.mockResolvedValue({ stop: jest.fn() });

    const first = await service.buildAgent('cfg-1', 1);
    const second = await service.buildAgent('cfg-1', 1);

    expect(first).toBe(second);
    expect(createDeepAgent).toHaveBeenCalledTimes(1);
  });

  it('should rebuild when the MCP server row changes (snapshot key in hash)', async () => {
    agentConfigRepo.findById.mockResolvedValue(makeConfig());
    toolRegistry.collect.mockResolvedValue([]);
    mcpLoader.load.mockResolvedValue([]);
    mcpLoader.getSnapshotKey
      .mockResolvedValueOnce('sig-v1')
      .mockResolvedValueOnce('sig-v2'); // e.g. url/headers/enabled edited
    sandbox.createSandbox.mockResolvedValue({ stop: jest.fn() });

    const first = await service.buildAgent('cfg-1', 1);
    const second = await service.buildAgent('cfg-1', 1);

    expect(first).not.toBe(second);
    expect(createDeepAgent).toHaveBeenCalledTimes(2);
  });

  it('should rebuild when the user role changes admin → non-admin (isAdmin in hash)', async () => {
    agentConfigRepo.findById.mockResolvedValue(makeConfig());
    toolRegistry.collect.mockResolvedValue([]);
    mcpLoader.load.mockResolvedValue([]);
    sandbox.createSandbox.mockResolvedValue({ stop: jest.fn() });
    usersService.findById
      .mockResolvedValueOnce(makeUser(RoleEnum.admin))
      .mockResolvedValueOnce(makeUser(RoleEnum.customer));

    const first = await service.buildAgent('cfg-1', 1);
    const second = await service.buildAgent('cfg-1', 1);

    // Same config + same user, but the role verdict changed → the cached
    // agent must be invalidated and rebuilt WITHOUT the sql tool.
    expect(first).not.toBe(second);
    expect(createDeepAgent).toHaveBeenCalledTimes(2);
    const firstTools = (
      createDeepAgent.mock.calls[0][0].tools as Array<{ name: string }>
    ).map((t) => t.name);
    const secondTools = (
      createDeepAgent.mock.calls[1][0].tools as Array<{ name: string }>
    ).map((t) => t.name);
    expect(firstTools).toContain('sql_query_readonly');
    expect(secondTools).not.toContain('sql_query_readonly');
  });

  it('should keep the cached agent when the role verdict is unchanged (still admin)', async () => {
    agentConfigRepo.findById.mockResolvedValue(makeConfig());
    toolRegistry.collect.mockResolvedValue([]);
    mcpLoader.load.mockResolvedValue([]);
    sandbox.createSandbox.mockResolvedValue({ stop: jest.fn() });
    usersService.findById.mockResolvedValue(makeUser(RoleEnum.admin));

    const first = await service.buildAgent('cfg-1', 1);
    const second = await service.buildAgent('cfg-1', 1);

    expect(first).toBe(second);
    expect(createDeepAgent).toHaveBeenCalledTimes(1);
  });

  it('should still build when the snapshot key fails (degraded cache key)', async () => {
    agentConfigRepo.findById.mockResolvedValue(makeConfig());
    toolRegistry.collect.mockResolvedValue([]);
    mcpLoader.load.mockResolvedValue([]);
    mcpLoader.getSnapshotKey.mockRejectedValue(new Error('db down'));
    sandbox.createSandbox.mockResolvedValue({ stop: jest.fn() });

    await expect(service.buildAgent('cfg-1', 1)).resolves.toBeDefined();
    expect(createDeepAgent).toHaveBeenCalledTimes(1);
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
