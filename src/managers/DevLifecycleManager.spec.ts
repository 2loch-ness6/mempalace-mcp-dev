/**
 * Unit tests for DevLifecycleManager.
 *
 * Strategy: mock ProcessAccess, GitAccess, and fs/promises at the module level
 * using jest.unstable_mockModule (required for ESM). All tests are pure unit
 * tests with no filesystem or subprocess side-effects.
 */

import { jest } from '@jest/globals';
import * as path from 'path';

// ── module mocks (must precede all dynamic imports) ──────────────────────────
jest.unstable_mockModule('../access/ProcessAccess.js', () => ({
  createProcessAccess: jest.fn(),
}));
jest.unstable_mockModule('../access/GitAccess.js', () => ({
  createGitAccess: jest.fn(),
}));
jest.unstable_mockModule('fs/promises', () => ({
  readFile: jest.fn(),
  unlink: jest.fn().mockResolvedValue(undefined),
}));

// ── dynamic imports (after mocks are registered) ─────────────────────────────
const { createProcessAccess } = await import('../access/ProcessAccess.js');
const { createGitAccess } = await import('../access/GitAccess.js');
const { createDevLifecycleManager } = await import('./DevLifecycleManager.js');
const { readFile, unlink } = await import('fs/promises');

const mockCreateProcessAccess = createProcessAccess as jest.MockedFunction<typeof createProcessAccess>;
const mockCreateGitAccess = createGitAccess as jest.MockedFunction<typeof createGitAccess>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockReadFile = readFile as unknown as jest.Mock;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _mockUnlink = unlink as unknown as jest.Mock;

// ── helpers ───────────────────────────────────────────────────────────────────
const REPO_DIR = process.cwd();
const SERVICE_PATH = 'src';

function makeProc(
  overrides: Partial<{ stdout: string; stderr: string; exitCode: number; success: boolean }> = {},
) {
  return {
    run: jest.fn().mockResolvedValue({
      stdout: '',
      stderr: '',
      exitCode: 0,
      success: true,
      ...overrides,
    }),
  };
}

function makeGit(diffResult = {}) {
  return {
    getBranchContext: jest.fn(),
    getGitRoot: jest.fn().mockResolvedValue(path.dirname(process.cwd())),
    getChangedFiles: jest.fn(),
    getWorkingTreeFiles: jest.fn().mockResolvedValue([]),
    getFileChangedSince: jest.fn(),
    getDiff: jest.fn().mockResolvedValue({
      diff: 'fake diff',
      files: ['src/foo.ts'],
      additions: 10,
      deletions: 2,
      truncated: false,
      ...diffResult,
    }),
  };
}

// ── runTypecheck ──────────────────────────────────────────────────────────────
describe('DevLifecycleManager — runTypecheck', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns success=true with no errors on clean tsc output', async () => {
    const proc = makeProc({ stdout: '', stderr: '', success: true });
    mockCreateProcessAccess.mockReturnValue(proc as ReturnType<typeof createProcessAccess>);
    mockCreateGitAccess.mockReturnValue(makeGit() as ReturnType<typeof createGitAccess>);

    const mgr = createDevLifecycleManager(REPO_DIR);
    const result = await mgr.runTypecheck(SERVICE_PATH);

    expect(result.success).toBe(true);
    expect(result.errorCount).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it('parses tsc errors into structured TypecheckError objects', async () => {
    const tscOutput = [
      `${REPO_DIR}/src/foo.ts(10,5): error TS2345: Argument of type 'string' is not assignable.`,
      `${REPO_DIR}/src/bar.ts(22,12): error TS2339: Property 'x' does not exist.`,
    ].join('\n');

    const proc = makeProc({ stdout: tscOutput, stderr: '', success: false });
    mockCreateProcessAccess.mockReturnValue(proc as ReturnType<typeof createProcessAccess>);
    mockCreateGitAccess.mockReturnValue(makeGit() as ReturnType<typeof createGitAccess>);

    const mgr = createDevLifecycleManager(REPO_DIR);
    const result = await mgr.runTypecheck(SERVICE_PATH);

    expect(result.success).toBe(false);
    expect(result.errorCount).toBe(2);
    expect(result.errors[0]).toMatchObject({ file: 'src/foo.ts', line: 10, col: 5, code: 'TS2345' });
    expect(result.errors[1]).toMatchObject({ file: 'src/bar.ts', line: 22, col: 12, code: 'TS2339' });
  });

  it('strips repoDir prefix from error file paths', async () => {
    const tscOutput = `${REPO_DIR}/some/deep/file.ts(1,1): error TS1234: Something.`;
    const proc = makeProc({ stdout: tscOutput, stderr: '', success: false });
    mockCreateProcessAccess.mockReturnValue(proc as ReturnType<typeof createProcessAccess>);
    mockCreateGitAccess.mockReturnValue(makeGit() as ReturnType<typeof createGitAccess>);

    const mgr = createDevLifecycleManager(REPO_DIR);
    const result = await mgr.runTypecheck(SERVICE_PATH);

    expect(result.errors[0]!.file).toBe('some/deep/file.ts');
  });

  it('caps raw output at 5000 chars', async () => {
    const bigOutput = 'x'.repeat(10_000);
    const proc = makeProc({ stdout: bigOutput, stderr: '', success: true });
    mockCreateProcessAccess.mockReturnValue(proc as ReturnType<typeof createProcessAccess>);
    mockCreateGitAccess.mockReturnValue(makeGit() as ReturnType<typeof createGitAccess>);

    const mgr = createDevLifecycleManager(REPO_DIR);
    const result = await mgr.runTypecheck(SERVICE_PATH);

    expect(result.raw.length).toBeLessThanOrEqual(5_000);
  });

  it('throws when servicePath escapes the repo', async () => {
    mockCreateProcessAccess.mockReturnValue(makeProc() as ReturnType<typeof createProcessAccess>);
    mockCreateGitAccess.mockReturnValue(makeGit() as ReturnType<typeof createGitAccess>);

    const mgr = createDevLifecycleManager(REPO_DIR);
    await expect(mgr.runTypecheck('../../etc')).rejects.toThrow('servicePath must be inside the repo');
  });

  it('throws when servicePath directory does not exist', async () => {
    mockCreateProcessAccess.mockReturnValue(makeProc() as ReturnType<typeof createProcessAccess>);
    mockCreateGitAccess.mockReturnValue(makeGit() as ReturnType<typeof createGitAccess>);

    const mgr = createDevLifecycleManager(REPO_DIR);
    await expect(mgr.runTypecheck('does/not/exist')).rejects.toThrow('Directory not found');
  });
});

// ── runTests ──────────────────────────────────────────────────────────────────
describe('DevLifecycleManager — runTests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _mockUnlink.mockResolvedValue(undefined);
  });

  it('returns success=true when all tests pass', async () => {
    mockReadFile.mockResolvedValueOnce(
      JSON.stringify({ numPassedTests: 5, numFailedTests: 0, numPendingTests: 1, testResults: [] }),
    );
    const proc = makeProc({ success: true });
    mockCreateProcessAccess.mockReturnValue(proc as ReturnType<typeof createProcessAccess>);
    mockCreateGitAccess.mockReturnValue(makeGit() as ReturnType<typeof createGitAccess>);

    const mgr = createDevLifecycleManager(REPO_DIR);
    const result = await mgr.runTests(SERVICE_PATH);

    expect(result.success).toBe(true);
    expect(result.passed).toBe(5);
    expect(result.failed).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.failures).toHaveLength(0);
  });

  it('extracts structured failures from jest JSON output', async () => {
    mockReadFile.mockResolvedValueOnce(JSON.stringify({
      numPassedTests: 2,
      numFailedTests: 1,
      numPendingTests: 0,
      testResults: [{
        testFilePath: `${REPO_DIR}/src/foo.spec.ts`,
        assertionResults: [
          { status: 'passed', fullName: 'passes', failureMessages: [] },
          { status: 'failed', fullName: 'should do X', failureMessages: ['Expected 1 to be 2.'] },
        ],
      }],
    }));
    const proc = makeProc({ success: false });
    mockCreateProcessAccess.mockReturnValue(proc as ReturnType<typeof createProcessAccess>);
    mockCreateGitAccess.mockReturnValue(makeGit() as ReturnType<typeof createGitAccess>);

    const mgr = createDevLifecycleManager(REPO_DIR);
    const result = await mgr.runTests(SERVICE_PATH);

    expect(result.success).toBe(false);
    expect(result.failed).toBe(1);
    expect(result.failures[0]).toMatchObject({ test: 'should do X', messages: ['Expected 1 to be 2.'] });
  });

  it('returns failure result when outputFile cannot be read', async () => {
    mockReadFile.mockRejectedValueOnce(new Error('ENOENT'));
    const proc = makeProc({ success: false });
    mockCreateProcessAccess.mockReturnValue(proc as ReturnType<typeof createProcessAccess>);
    mockCreateGitAccess.mockReturnValue(makeGit() as ReturnType<typeof createGitAccess>);

    const mgr = createDevLifecycleManager(REPO_DIR);
    const result = await mgr.runTests(SERVICE_PATH);

    expect(result.success).toBe(false);
    expect(result.failures[0]!.messages[0]).toContain('Jest did not produce output');
  });

  it('returns failure result when outputFile JSON is malformed', async () => {
    mockReadFile.mockResolvedValueOnce('not-json{{{');
    const proc = makeProc({ success: false });
    mockCreateProcessAccess.mockReturnValue(proc as ReturnType<typeof createProcessAccess>);
    mockCreateGitAccess.mockReturnValue(makeGit() as ReturnType<typeof createGitAccess>);

    const mgr = createDevLifecycleManager(REPO_DIR);
    const result = await mgr.runTests(SERVICE_PATH);

    expect(result.success).toBe(false);
    expect(result.failures[0]!.messages[0]).toContain('Failed to parse Jest JSON output');
  });

  it('passes testNamePattern to npm args when provided', async () => {
    mockReadFile.mockResolvedValueOnce(
      JSON.stringify({ numPassedTests: 1, numFailedTests: 0, numPendingTests: 0, testResults: [] }),
    );
    const proc = makeProc();
    mockCreateProcessAccess.mockReturnValue(proc as ReturnType<typeof createProcessAccess>);
    mockCreateGitAccess.mockReturnValue(makeGit() as ReturnType<typeof createGitAccess>);

    const mgr = createDevLifecycleManager(REPO_DIR);
    await mgr.runTests(SERVICE_PATH, 'my pattern');

    const callArgs = (proc.run as jest.Mock).mock.calls[0] as [string, string[], unknown];
    expect(callArgs[1]).toContain('--testNamePattern=my pattern');
  });

  it('truncates individual failure messages to 1500 chars', async () => {
    const longMsg = 'A'.repeat(3_000);
    mockReadFile.mockResolvedValueOnce(JSON.stringify({
      numPassedTests: 0,
      numFailedTests: 1,
      numPendingTests: 0,
      testResults: [{
        testFilePath: `${REPO_DIR}/src/foo.spec.ts`,
        assertionResults: [{ status: 'failed', fullName: 'big fail', failureMessages: [longMsg] }],
      }],
    }));
    const proc = makeProc({ success: false });
    mockCreateProcessAccess.mockReturnValue(proc as ReturnType<typeof createProcessAccess>);
    mockCreateGitAccess.mockReturnValue(makeGit() as ReturnType<typeof createGitAccess>);

    const mgr = createDevLifecycleManager(REPO_DIR);
    const result = await mgr.runTests(SERVICE_PATH);

    expect(result.failures[0]!.messages[0]!.length).toBeLessThanOrEqual(1_500);
  });
});

// ── getDiff ───────────────────────────────────────────────────────────────────
describe('DevLifecycleManager — getDiff', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates to git.getDiff with the correct repoDir', async () => {
    const mockDiff = { diff: 'diff --git', files: ['a.ts'], additions: 3, deletions: 1, truncated: false };
    const git = makeGit(mockDiff);
    mockCreateProcessAccess.mockReturnValue(makeProc() as ReturnType<typeof createProcessAccess>);
    mockCreateGitAccess.mockReturnValue(git as ReturnType<typeof createGitAccess>);

    const mgr = createDevLifecycleManager(REPO_DIR);
    const result = await mgr.getDiff('HEAD~1', 'src/foo.ts');

    expect(git.getDiff).toHaveBeenCalledWith(REPO_DIR, 'HEAD~1', 'src/foo.ts');
    expect(result).toEqual(mockDiff);
  });

  it('passes undefined base and filePath when not provided', async () => {
    const git = makeGit();
    mockCreateProcessAccess.mockReturnValue(makeProc() as ReturnType<typeof createProcessAccess>);
    mockCreateGitAccess.mockReturnValue(git as ReturnType<typeof createGitAccess>);

    const mgr = createDevLifecycleManager(REPO_DIR);
    await mgr.getDiff();

    expect(git.getDiff).toHaveBeenCalledWith(REPO_DIR, undefined, undefined);
  });
});
