import { createJsEvalTool } from './js-eval.tool';
import type { SandboxService } from '../infrastructure/agent/sandbox.service';

describe('execute_js tool (LangChain tool factory)', () => {
  const makeSandbox = () =>
    ({
      evalJs: jest.fn(),
    }) as unknown as jest.Mocked<SandboxService>;

  it('should delegate to sandbox.evalJs and return its string result', async () => {
    const sandbox = makeSandbox();
    sandbox.evalJs.mockResolvedValue('42');

    const tool = createJsEvalTool(sandbox);
    const result = await tool.invoke({ code: '6 * 7' });

    expect(sandbox.evalJs).toHaveBeenCalledWith('6 * 7');
    expect(result).toBe('42');
  });

  it('should return a JSON error object when evalJs rejects', async () => {
    const sandbox = makeSandbox();
    sandbox.evalJs.mockRejectedValue(
      new Error('SyntaxError: unexpected token'),
    );

    const tool = createJsEvalTool(sandbox);
    const result = await tool.invoke({ code: 'const const const' });

    expect(JSON.parse(result as string)).toEqual({
      error: 'SyntaxError: unexpected token',
    });
  });

  it('should stringify non-Error rejections', async () => {
    const sandbox = makeSandbox();
    sandbox.evalJs.mockRejectedValue('boom');

    const tool = createJsEvalTool(sandbox);
    const result = await tool.invoke({ code: 'throw "boom"' });

    expect(JSON.parse(result as string)).toEqual({ error: 'boom' });
  });

  it('should have name execute_js and a description', () => {
    const tool = createJsEvalTool(makeSandbox());
    expect(tool.name).toBe('execute_js');
    expect(tool.description.length).toBeGreaterThan(10);
  });
});
