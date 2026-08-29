import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { ToolRegistryService } from './tool-registry.service';
import type { StructuredTool } from '@langchain/core/tools';

/**
 * Tests stub `loadToolsFile` and `resolveExtensionsDir` directly so no real
 * filesystem access is needed. `statSync` is also stubbed via a private hook.
 */
describe('ToolRegistryService', () => {
  let service: ToolRegistryService;

  const makeTool = (name: string): StructuredTool =>
    ({ name }) as unknown as StructuredTool;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ToolRegistryService],
    }).compile();
    service = module.get<ToolRegistryService>(ToolRegistryService);
    service['logger'] = new Logger() as unknown as Logger;
    // Stub the extensions dir so collect() iterates a known set of names.
    service['resolveExtensionsDir'] = () => '/fake/extensions';
  });

  afterEach(() => jest.clearAllMocks());

  it('should discover tools from extensions that have agent.tools.ts', async () => {
    service['listExtensionDirs'] = () => ['knowledge-agent', 'cms'];
    service['statMtimeMs'] = () => 1000;
    service['loadToolsFile'] = jest
      .fn()
      .mockResolvedValueOnce([makeTool('search_notes'), makeTool('execute')])
      .mockResolvedValueOnce(null); // cms has no tools

    const tools = await service.collect();

    expect(tools).toHaveLength(2);
    expect(tools.map((t) => (t as unknown as { name: string }).name)).toEqual([
      'search_notes',
      'execute',
    ]);
  });

  it('should exclude extensions without agent.tools.ts', async () => {
    service['listExtensionDirs'] = () => ['no-tools-ext'];
    service['statMtimeMs'] = () => 1000;
    service['loadToolsFile'] = jest.fn().mockResolvedValue(null);

    const tools = await service.collect();

    expect(tools).toHaveLength(0);
  });

  it('should merge tools from multiple extensions into one array', async () => {
    service['listExtensionDirs'] = () => ['ext-a', 'ext-b'];
    service['statMtimeMs'] = () => 1000;
    service['loadToolsFile'] = jest
      .fn()
      .mockResolvedValueOnce([makeTool('tool_a1'), makeTool('tool_a2')])
      .mockResolvedValueOnce([makeTool('tool_b1')]);

    const tools = await service.collect();

    expect(tools).toHaveLength(3);
  });

  it('should skip non-directory entries', async () => {
    // listExtensionDirs already returns only directories; this verifies that
    // an empty list yields no tools and no throw.
    service['listExtensionDirs'] = () => [];
    service['statMtimeMs'] = () => 1000;
    service['loadToolsFile'] = jest.fn();

    const tools = await service.collect();

    expect(tools).toHaveLength(0);
    expect(service['loadToolsFile']).not.toHaveBeenCalled();
  });

  it('should cache tools by file mtime and skip re-scan when unchanged', async () => {
    service['listExtensionDirs'] = () => ['knowledge-agent'];
    service['statMtimeMs'] = () => 5000;
    const loader = jest.fn().mockResolvedValue([makeTool('cached_tool')]);
    service['loadToolsFile'] = loader;

    await service.collect();
    await service.collect();

    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('should re-scan when file mtime changes (cache invalidation)', async () => {
    service['listExtensionDirs'] = () => ['knowledge-agent'];
    let mtime = 1000;
    service['statMtimeMs'] = () => mtime;
    const loader = jest
      .fn()
      .mockResolvedValueOnce([makeTool('v1')])
      .mockResolvedValueOnce([makeTool('v2')]);
    service['loadToolsFile'] = loader;

    const first = await service.collect();
    mtime = 2000;
    const second = await service.collect();

    expect(first.map((t) => (t as unknown as { name: string }).name)).toEqual([
      'v1',
    ]);
    expect(second.map((t) => (t as unknown as { name: string }).name)).toEqual([
      'v2',
    ]);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('should gracefully skip an extension whose agent.tools.ts throws on import', async () => {
    service['listExtensionDirs'] = () => ['broken-ext', 'good-ext'];
    service['statMtimeMs'] = () => 1000;
    service['loadToolsFile'] = jest
      .fn()
      .mockRejectedValueOnce(new Error('import failed'))
      .mockResolvedValueOnce([makeTool('good_tool')]);

    const tools = await service.collect();

    expect(tools.map((t) => (t as unknown as { name: string }).name)).toEqual([
      'good_tool',
    ]);
  });

  it('should discover tools from a compiled agent.tools.js (prod dist runtime)', async () => {
    // Simulates prod: only agent.tools.js exists on disk. statMtimeMs must
    // accept it — extensionless `statMtimeMs(file, file)` stub ignores the
    // candidates and returns a fixed mtime.
    service['listExtensionDirs'] = () => ['cms'];
    const statCalls: string[][] = [];
    service['statMtimeMs'] = (...candidates: string[]) => {
      statCalls.push(candidates);
      return 1234;
    };
    service['loadToolsFile'] = jest
      .fn()
      .mockResolvedValue([makeTool('cms_tool')]);

    const tools = await service.collect();

    expect(tools.map((t) => (t as unknown as { name: string }).name)).toEqual([
      'cms_tool',
    ]);
    // Both candidates (.ts then .js) were offered so a .js-only runtime hits.
    expect(statCalls[0]).toEqual([
      '/fake/extensions/cms/agent.tools.ts',
      '/fake/extensions/cms/agent.tools.js',
    ]);
  });

  it('should skip an extension when neither agent.tools.ts nor .js exists', async () => {
    // statMtimeMs throws only when both candidates are missing (real impl
    // propagates the failure; the stub mimics it via candidates check).
    service['listExtensionDirs'] = () => ['empty-ext'];
    service['statMtimeMs'] = (...candidates: string[]) => {
      if (candidates.length === 2) {
        throw new Error('No tool file found');
      }
      return 1000;
    };
    service['loadToolsFile'] = jest.fn();

    const tools = await service.collect();

    expect(tools).toHaveLength(0);
    expect(service['loadToolsFile']).not.toHaveBeenCalled();
  });
});
