import { resolve, join, relative, isAbsolute } from 'path';
import { existsSync } from 'fs';
import { readFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { createProcessAccess } from '../access/ProcessAccess.js';
import { createGitAccess } from '../access/GitAccess.js';
import type { DiffResult } from '../access/GitAccess.js';

export type { DiffResult };

export interface TypecheckError {
  file: string;
  line: number;
  col: number;
  code: string;
  message: string;
}

export interface TypecheckResult {
  success: boolean;
  errorCount: number;
  errors: TypecheckError[];
  raw: string;
}

export interface TestFailure {
  suite: string;
  test: string;
  messages: string[];
}

export interface TestResult {
  success: boolean;
  passed: number;
  failed: number;
  skipped: number;
  failures: TestFailure[];
}

export interface DevLifecycleManager {
  runTypecheck(servicePath: string): Promise<TypecheckResult>;
  runTests(servicePath: string, pattern?: string): Promise<TestResult>;
  getDiff(base?: string, filePath?: string): Promise<DiffResult>;
}

// =============================================================================
// Helpers
// =============================================================================

function resolveSafe(repoDir: string, servicePath: string): string {
  const abs = isAbsolute(servicePath) ? servicePath : resolve(repoDir, servicePath);
  const rel = relative(repoDir, abs);
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(`servicePath must be inside the repo. Got: ${servicePath}`);
  }
  if (!existsSync(abs)) {
    throw new Error(`Directory not found: ${abs}`);
  }
  return abs;
}

const TSC_ERROR_RE = /^(.+?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+)$/gm;

function parseTscOutput(output: string, repoDir: string): TypecheckError[] {
  const errors: TypecheckError[] = [];
  let match: RegExpExecArray | null;
  TSC_ERROR_RE.lastIndex = 0;
  while ((match = TSC_ERROR_RE.exec(output)) !== null) {
    const rawFile = match[1] ?? '';
    const line = match[2] ?? '0';
    const col = match[3] ?? '0';
    const code = match[4] ?? '';
    const message = match[5] ?? '';
    const file = rawFile.startsWith(repoDir)
      ? rawFile.slice(repoDir.length + 1)
      : rawFile.trim();
    errors.push({
      file,
      line: parseInt(line, 10),
      col: parseInt(col, 10),
      code: code.trim(),
      message: message.trim(),
    });
  }
  return errors;
}

interface JestJsonOutput {
  numPassedTests: number;
  numFailedTests: number;
  numPendingTests: number;
  testResults: Array<{
    testFilePath: string;
    assertionResults: Array<{
      status: string;
      fullName: string;
      failureMessages: string[];
    }>;
  }>;
}

// =============================================================================
// Factory
// =============================================================================

export function createDevLifecycleManager(repoDir: string): DevLifecycleManager {
  const proc = createProcessAccess();
  const git = createGitAccess();

  async function runTypecheck(servicePath: string): Promise<TypecheckResult> {
    const absPath = resolveSafe(repoDir, servicePath);

    // Prefer local tsc, fall back to workspace root, then PATH
    const localTsc = join(absPath, 'node_modules', '.bin', 'tsc');
    const rootTsc = join(repoDir, 'node_modules', '.bin', 'tsc');
    const tscBin = existsSync(localTsc) ? localTsc : existsSync(rootTsc) ? rootTsc : 'tsc';

    const hasTsConfig = existsSync(join(absPath, 'tsconfig.json'));
    const args = ['--noEmit'];
    if (hasTsConfig) args.push('-p', 'tsconfig.json');

    const result = await proc.run(tscBin, args, { cwd: absPath, timeout: 90_000 });
    const combined = (result.stdout + result.stderr).trim();
    const errors = parseTscOutput(combined, repoDir);

    return {
      success: result.success && errors.length === 0,
      errorCount: errors.length,
      errors,
      raw: combined.slice(0, 5_000),
    };
  }

  async function runTests(servicePath: string, pattern?: string): Promise<TestResult> {
    const absPath = resolveSafe(repoDir, servicePath);
    const outputFile = join(tmpdir(), `mcp-dev-jest-${Date.now()}.json`);

    const npmArgs = [
      'test',
      '--',
      '--forceExit',
      '--json',
      `--outputFile=${outputFile}`,
    ];
    if (pattern) npmArgs.push(`--testNamePattern=${pattern}`);

    await proc.run('npm', npmArgs, {
      cwd: absPath,
      timeout: 120_000,
      env: { CI: 'true' },
    });

    let jsonStr: string;
    try {
      jsonStr = await readFile(outputFile, 'utf8');
    } catch {
      return {
        success: false,
        passed: 0,
        failed: 0,
        skipped: 0,
        failures: [
          {
            suite: 'runner',
            test: 'startup',
            messages: ['Jest did not produce output. Check npm test script exists.'],
          },
        ],
      };
    } finally {
      await unlink(outputFile).catch(() => {});
    }

    let json: JestJsonOutput;
    try {
      json = JSON.parse(jsonStr) as JestJsonOutput;
    } catch {
      return {
        success: false,
        passed: 0,
        failed: 0,
        skipped: 0,
        failures: [{ suite: 'runner', test: 'parse', messages: ['Failed to parse Jest JSON output'] }],
      };
    }

    const failures: TestFailure[] = [];
    for (const suite of json.testResults) {
      const suiteName = relative(repoDir, suite.testFilePath);
      for (const t of suite.assertionResults) {
        if (t.status === 'failed') {
          failures.push({
            suite: suiteName,
            test: t.fullName,
            messages: t.failureMessages.map((m) => m.slice(0, 1_500)),
          });
        }
      }
    }

    return {
      success: json.numFailedTests === 0,
      passed: json.numPassedTests,
      failed: json.numFailedTests,
      skipped: json.numPendingTests,
      failures,
    };
  }

  async function getDiff(base?: string, filePath?: string): Promise<DiffResult> {
    return git.getDiff(repoDir, base, filePath);
  }

  return { runTypecheck, runTests, getDiff };
}
