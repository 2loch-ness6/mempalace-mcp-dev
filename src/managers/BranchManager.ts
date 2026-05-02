import { createGitAccess, GitAccess, BranchContext, ChangedFile } from '../access/GitAccess.js';

export interface BranchManagerResult {
  context: BranchContext;
  changedFiles: ChangedFile[];
}

export interface BranchManager {
  getContext(): Promise<BranchContext>;
  getChangedFiles(base?: string): Promise<BranchManagerResult>;
}

export function createBranchManager(repoDir: string): BranchManager {
  const git: GitAccess = createGitAccess();

  async function getContext(): Promise<BranchContext> {
    return git.getBranchContext(repoDir);
  }

  async function getChangedFiles(base?: string): Promise<BranchManagerResult> {
    const [context, changedFiles] = await Promise.all([
      git.getBranchContext(repoDir),
      git.getChangedFiles(repoDir, base),
    ]);
    return { context, changedFiles };
  }

  return { getContext, getChangedFiles };
}
