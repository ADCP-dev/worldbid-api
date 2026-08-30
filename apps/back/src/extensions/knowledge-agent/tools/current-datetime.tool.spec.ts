import { createCurrentDatetimeTool } from './current-datetime.tool';

describe('get_current_datetime tool (LangChain tool factory)', () => {
  const invokeTool = async () => {
    const tool = createCurrentDatetimeTool();
    return (await tool.invoke({})) as string;
  };

  it('should return an object containing iso, utc, date, time, weekday, timezone and epochMs', async () => {
    const result = JSON.parse(await invokeTool()) as Record<string, unknown>;

    expect(result.iso).toEqual(expect.any(String));
    expect(result.utc).toEqual(expect.any(String));
    expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.time).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    expect(result.weekday).toEqual(
      expect.stringMatching(
        /^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)$/,
      ),
    );
    expect(result.timezone).toEqual(expect.any(String));
    expect(result.timezone.length).toBeGreaterThan(0);
    expect(result.epochMs).toEqual(expect.any(Number));
  });

  it('should return an epochMs close to Date.now() (within 5 seconds)', async () => {
    const result = JSON.parse(await invokeTool()) as { epochMs: number };

    expect(Math.abs(result.epochMs - Date.now())).toBeLessThanOrEqual(5000);
  });

  it('should return an ISO string that parses as a valid Date', async () => {
    const result = JSON.parse(await invokeTool()) as {
      iso: string;
      epochMs: number;
    };
    const parsed = new Date(result.iso);

    expect(parsed.toString()).not.toBe('Invalid Date');
    // Same Date snapshot: the ISO ms must equal the reported epoch.
    expect(parsed.getTime()).toBe(result.epochMs);
  });

  it('should have name get_current_datetime and a description', () => {
    const tool = createCurrentDatetimeTool();
    expect(tool.name).toBe('get_current_datetime');
    expect(tool.description.length).toBeGreaterThan(10);
  });
});
