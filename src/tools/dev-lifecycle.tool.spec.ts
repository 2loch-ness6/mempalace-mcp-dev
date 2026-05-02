/**
 * Unit tests for registerDevLifecycleTools.
 *
 * Uses jest.unstable_mockModule (required for ESM) to mock the manager.
 * The McpServer stub captures tool registrations for assertion.
 */

import { jest } from '@jest/globals';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// ── module mocks (before dynamic imports) ────────────────────────────────────
jest.unstable_mockModule('../managers/DevLifecycleManager.js', () => ({
  createDevLifecycleManager: jest.fn(),
}));

// ── dynamic imports ───────────────────────────────────────────────────────────
const { createDevLifecycleManager } = await import('../managers/DevLifecycleManager.js');
const { registerDevLifecycleTools } = await import('./dev-lifecycle.tool.js');

const mockCreateMgr = createDevLifecycleManager as jest.MockedFunction<typeof createDevLifecycleManager>;

// ── helpers ───────────────────────────────────────────────────────────────────
function makeServer() {
  const tools: Record<string, (args: unknown) => Promise<unknown>> = {};
  return {
    tool: jest.fn((name: string, _desc: string, _schema: unknown, handler: (args: unknown) => Promise<unknown>) => {
      tools[name] = handler;
    }),
    _tools: tools,
  };
}

function makeMgr() {
  return {
    runTypecheck: jest.fn(),
    runTests: jest.fn(),
    getDiff: jest.fn(),
  };
}

// ── tests ─────────────────────────────────────────────────────────────────────
describe('registerDevLifecycleTools', () => {
  let server: ReturnType<typeof makeServer>;
  let mgr: ReturnType<typeof makeMgr>;

  beforeEach(() => {
    jest.clearAllMocks();
    server = makeServer();
    mgr = makeMgr();
    mockCreateMgr.mockReturnValue(mgr as ReturnType<typeof createDevLifecycleManager>);
    registerDevLifecycleTools(server as unknown as McpServer, mgr as ReturnType<typeof createDevLifecycleManager>);
  });

  it('registers exactly 3 tools', () => {
    expect(server.tool).toHaveBeenCalledTimes(3);
  });

  it('registers run_typecheck, run_tests, and get_git_diff', () => {
    const names = (server.tool as jest.Mock).mock.calls.map((c) => (c as unknown[])[0]);
    expect(names).toContain('run_typecheck');
    expect(names).toContain('run_tests');
    expect(names).toContain('get_git_diff');
  });

  describe('run_typecheck handler', () => {
    it('calls mgr.runTypecheck and returns JSON content', async () => {
      const mockResult = { success: true, errorCount: 0, errors: [], raw: '' };
      mgr.runTypecheck.mockResolvedValue(mockResult);

      const handler = server._tools['run_typecheck']!;
      const response = await handler({ servicePath: 'src' }) as { content: Array<{ type: string; text: string }> };

      expect(mgr.runTypecheck).toHaveBeenCalledWith('src');
      expect(response.content[0]).toMatchObject({ type: 'text' });
      expect(JSON.parse(response.content[0]!.text)).toEqual(mockResult);
    });

    it('propagates errors from mgr.runTypecheck', async () => {
      mgr.runTypecheck.mockRejectedValue(new Error('Directory not found: /nope'));
      const handler = server._tools['run_typecheck']!;
      await expect(handler({ servicePath: 'nope' })).rejects.toThrow('Directory not found');
    });
  });

  describe('run_tests handler', () => {
    it('calls mgr.runTests with servicePath and optional pattern', async () => {
      const mockResult = { success: true, passed: 3, failed: 0, skipped: 0, failures: [] };
      mgr.runTests.mockResolvedValue(mockResult);

      const handler = server._tools['run_tests']!;
      const response = await handler({ servicePath: 'src', pattern: 'my test' }) as { content: Array<{ type: string; text: string }> };

      expect(mgr.runTests).toHaveBeenCalledWith('src', 'my test');
      expect(JSON.parse(response.content[0]!.text)).toEqual(mockResult);
    });

    it('passes undefined pattern when not provided', async () => {
      mgr.runTests.mockResolvedValue({ success: true, passed: 1, failed: 0, skipped: 0, failures: [] });
      const handler = server._tools['run_tests']!;
      await handler({ servicePath: 'src' });
      expect(mgr.runTests).toHaveBeenCalledWith('src', undefined);
    });
  });

  describe('get_git_diff handler', () => {
    it('calls mgr.getDiff with base and file', async () => {
      const mockResult = { diff: 'diff', files: [], additions: 1, deletions: 0, truncated: false };
      mgr.getDiff.mockResolvedValue(mockResult);

      const handler = server._tools['get_git_diff']!;
      const response = await handler({ base: 'HEAD~2', file: 'src/foo.ts' }) as { content: Array<{ type: string; text: string }> };

      expect(mgr.getDiff).toHaveBeenCalledWith('HEAD~2', 'src/foo.ts');
      expect(JSON.parse(response.content[0]!.text)).toEqual(mockResult);
    });

    it('passes undefined for omitted base and file', async () => {
      mgr.getDiff.mockResolvedValue({ diff: '', files: [], additions: 0, deletions: 0, truncated: false });
      const handler = server._tools['get_git_diff']!;
      await handler({});
      expect(mgr.getDiff).toHaveBeenCalledWith(undefined, undefined);
    });
  });
});
