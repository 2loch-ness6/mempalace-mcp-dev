import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface ProcessResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  success: boolean;
}

export interface ProcessAccess {
  run(
    cmd: string,
    args: string[],
    options: { cwd: string; timeout?: number; env?: Record<string, string> },
  ): Promise<ProcessResult>;
}

export function createProcessAccess(): ProcessAccess {
  async function run(
    cmd: string,
    args: string[],
    options: { cwd: string; timeout?: number; env?: Record<string, string> },
  ): Promise<ProcessResult> {
    const timeout = options.timeout ?? 120_000;
    try {
      const { stdout, stderr } = await execFileAsync(cmd, args, {
        cwd: options.cwd,
        timeout,
        env: { ...process.env, ...(options.env ?? {}) },
        maxBuffer: 10 * 1024 * 1024, // 10MB
      });
      return { stdout, stderr, exitCode: 0, success: true };
    } catch (err: unknown) {
      const e = err as { stdout?: string; stderr?: string; code?: number };
      return {
        stdout: e.stdout ?? '',
        stderr: e.stderr ?? '',
        exitCode: typeof e.code === 'number' ? e.code : 1,
        success: false,
      };
    }
  }

  return { run };
}
