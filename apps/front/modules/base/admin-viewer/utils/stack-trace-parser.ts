/**
 * parseStackTrace — pure function parsing Node stack traces into frames.
 *
 * Handles both formats:
 *   `at FunctionName (file:line:col)`
 *   `at file:line:col` (anonymous)
 *
 * Frames from node_modules or internal/ are marked non-app and shown
 * collapsed by the UI. Returns [] for unparseable input (never throws).
 */

export interface StackFrame {
  functionName: string;
  file: string;
  line: number;
  column: number;
  isAppCode: boolean;
  isInternal: boolean;
}

const STACK_LINE_RE = /^\s*at\s+(?:(\S+)\s+\()?(.+):(\d+):(\d+)\)?\s*$/;

export function parseStackTrace(stack: string): StackFrame[] {
  if (!stack || typeof stack !== 'string') return [];
  return stack
    .split('\n')
    .map((line) => {
      const m = line.match(STACK_LINE_RE);
      if (!m) return null;
      const [, fn, file, ln, col] = m;
      const isInternal = file.includes('internal/');
      const isAppCode = !file.includes('node_modules') && !isInternal;
      return {
        functionName: fn ?? '<anonymous>',
        file,
        line: parseInt(ln, 10),
        column: parseInt(col, 10),
        isAppCode,
        isInternal,
      } satisfies StackFrame;
    })
    .filter((f): f is StackFrame => f !== null);
}