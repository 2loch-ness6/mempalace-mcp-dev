import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface BranchContext {
  branch: string;
  sha: string;
  shortSha: string;
  recentCommits: string[];
}

export interface ChangedFile {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
}

export interface DiffResult {
  diff: string;
  files: string[];
  additions: number;
  deletions: number;
  truncated: boolean;
}

export interface GitAccess {
  getBranchContext(repoDir: string): Promise<BranchContext>;
  getGitRoot(repoDir: string): Promise<string>;
  getChangedFiles(repoDir: string, base?: string): Promise<ChangedFile[]>;
  getWorkingTreeFiles(repoDir: string): Promise<ChangedFile[]>;
  getFileChangedSince(repoDir: string, filePath: string, ref: string): Promise<boolean>;
  getDiff(repoDir: string, base?: string, filePath?: string): Promise<DiffResult>;
}

export function createGitAccess(): GitAccess {
  async function getBranchContext(repoDir: string): Promise<BranchContext> {
    const [branchResult, shaResult, logResult] = await Promise.all([
      execFileAsync('git', ['-C', repoDir, 'rev-parse', '--abbrev-ref', 'HEAD']),
      execFileAsync('git', ['-C', repoDir, 'rev-parse', 'HEAD']),
      execFileAsync('git', ['-C', repoDir, 'log', '--oneline', '-5']),
    ]);

    const sha = shaResult.stdout.trim();
    return {
      branch: branchResult.stdout.trim(),
      sha,
      shortSha: sha.slice(0, 8),
      recentCommits: logResult.stdout.trim().split('\n').filter(Boolean),
    };
  }

  async function getGitRoot(repoDir: string): Promise<string> {
    const { stdout } = await execFileAsync('git', ['-C', repoDir, 'rev-parse', '--show-toplevel']);
    return stdout.trim();
  }

  async function getChangedFiles(repoDir: string, base?: string): Promise<ChangedFile[]> {
    const ref = base ?? 'HEAD~1';
    const { stdout } = await execFileAsync('git', [
      '-C',
      repoDir,
      'diff',
      '--name-status',
      ref,
      'HEAD',
    ]);

    return stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [rawStatus, ...parts] = line.split('\t');
        const path = parts[parts.length - 1] ?? '';
        const statusChar = (rawStatus ?? '')[0] ?? 'M';
        const statusMap: Record<string, ChangedFile['status']> = {
          A: 'added',
          M: 'modified',
          D: 'deleted',
          R: 'renamed',
        };
        return {
          path,
          status: statusMap[statusChar] ?? 'modified',
        };
      });
  }

  async function getWorkingTreeFiles(repoDir: string): Promise<ChangedFile[]> {
    // git status --porcelain covers staged, unstaged, and untracked files
    const { stdout } = await execFileAsync('git', ['-C', repoDir, 'status', '--porcelain']);
    const statusMap: Record<string, ChangedFile['status']> = {
      A: 'added',
      M: 'modified',
      D: 'deleted',
      R: 'renamed',
      '?': 'added',
    };
    return stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        // porcelain format: XY path  (or XY oldpath -> newpath for renames)
        const xy = line.slice(0, 2);
        const rest = line.slice(3).trim();
        // For renames: "old -> new" — take the new path
        const path = rest.includes(' -> ') ? (rest.split(' -> ')[1] ?? rest) : rest;
        // X = staged status, Y = unstaged status; prefer staged char if present
        const statusChar = (xy[0] !== ' ' && xy[0] !== '?' ? xy[0] : xy[1]) ?? 'M';
        return {
          path,
          status: statusMap[statusChar] ?? 'modified',
        };
      })
      .filter((f) => f.path.length > 0);
  }

  async function getFileChangedSince(
    repoDir: string,
    filePath: string,
    ref: string,
  ): Promise<boolean> {
    const { stdout } = await execFileAsync('git', [
      '-C',
      repoDir,
      'diff',
      '--name-only',
      ref,
      'HEAD',
      '--',
      filePath,
    ]);
    return stdout.trim().length > 0;
  }

  async function getDiff(
    repoDir: string,
    base?: string,
    filePath?: string,
  ): Promise<DiffResult> {
    const MAX_DIFF = 80_000;
    const ref = base ?? 'HEAD~1';

    // Stat summary: additions/deletions + file list
    const statArgs = ['-C', repoDir, 'diff', '--stat', ref, 'HEAD'];
    if (filePath) statArgs.push('--', filePath);

    // Full diff
    const diffArgs = ['-C', repoDir, 'diff', ref, 'HEAD'];
    if (filePath) diffArgs.push('--', filePath);

    const [statResult, diffResult] = await Promise.all([
      execFileAsync('git', statArgs),
      execFileAsync('git', diffArgs),
    ]);

    const raw = diffResult.stdout;
    const truncated = raw.length > MAX_DIFF;
    const diff = truncated ? raw.slice(0, MAX_DIFF) + '\n\n[...truncated]' : raw;

    // Parse additions/deletions from stat
    const addMatch = statResult.stdout.match(/(\d+) insertion/);
    const delMatch = statResult.stdout.match(/(\d+) deletion/);

    // File list from stat lines
    const files = statResult.stdout
      .split('\n')
      .filter((l) => l.includes('|'))
      .map((l) => (l.split('|')[0] ?? '').trim());

    return {
      diff,
      files,
      additions: addMatch?.[1] != null ? parseInt(addMatch[1], 10) : 0,
      deletions: delMatch?.[1] != null ? parseInt(delMatch[1], 10) : 0,
      truncated,
    };
  }

  return { getBranchContext, getGitRoot, getChangedFiles, getWorkingTreeFiles, getFileChangedSince, getDiff };
}
