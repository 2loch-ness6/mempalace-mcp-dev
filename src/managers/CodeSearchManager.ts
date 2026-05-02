import { createMemPalaceAccess, MemPalaceAccess } from '../access/MemPalaceAccess.js';
import { createGitAccess, GitAccess } from '../access/GitAccess.js';
import { createFileFilterEngine, FileFilterEngine } from '../engines/FileFilterEngine.js';
import { createBranchScopeEngine, BranchScopeEngine, BranchScopedResult } from '../engines/BranchScopeEngine.js';

export interface CodeSearchQuery {
  query: string;
  limit?: number;
  scope?: string; // optional sub-path scope
}

export interface CodeSearchResult {
  results: BranchScopedResult[];
  branch: string;
  sha: string;
  totalFound: number;
}

export interface CodeSearchManager {
  search(query: CodeSearchQuery): Promise<CodeSearchResult>;
  mineChangedFiles(repoDir: string): Promise<{ mined: string[]; skipped: string[] }>;
  mineAll(repoDir: string): Promise<void>;
}

export function createCodeSearchManager(
  palaceDir: string,
  palaceWing: string,
  repoDir: string,
): CodeSearchManager {
  const memPalace: MemPalaceAccess = createMemPalaceAccess(palaceDir);
  const git: GitAccess = createGitAccess();
  const fileFilter: FileFilterEngine = createFileFilterEngine();
  const branchScope: BranchScopeEngine = createBranchScopeEngine();

  async function search(query: CodeSearchQuery): Promise<CodeSearchResult> {
    const [rawResults, context] = await Promise.all([
      memPalace.search(query.query, palaceWing, query.limit ?? 10),
      git.getBranchContext(repoDir),
    ]);

    const scoped = branchScope.filterResults(rawResults, context);

    return {
      results: scoped,
      branch: context.branch,
      sha: context.shortSha,
      totalFound: scoped.length,
    };
  }

  async function mineChangedFiles(
    repoDir: string,
  ): Promise<{ mined: string[]; skipped: string[] }> {
    // Combine committed changes (HEAD~1..HEAD) and uncommitted working-tree changes,
    // deduplicating by path so each file is only mined once.
    const [committedFiles, workingTreeFiles, gitRoot] = await Promise.all([
      git.getChangedFiles(repoDir),
      git.getWorkingTreeFiles(repoDir),
      git.getGitRoot(repoDir),
    ]);
    const seen = new Set<string>();
    const merged = [...committedFiles, ...workingTreeFiles].filter(({ path }) => {
      if (seen.has(path)) return false;
      seen.add(path);
      return true;
    });
    // git returns paths relative to the git toplevel (where .git lives), which may differ
    // from repoDir — use gitRoot to construct correct absolute paths.
    const allPaths = merged.map((f) => `${gitRoot}/${f.path}`);
    const mineable = fileFilter.filterPaths(allPaths);
    const skipped = allPaths.filter((p) => !mineable.includes(p));

    if (mineable.length > 0) {
      // Mine each changed file individually so we get targeted re-indexing
      for (const path of mineable) {
        await memPalace.mineFile(path, palaceWing);
      }
    }

    return { mined: mineable, skipped };
  }

  async function mineAll(repoDir: string): Promise<void> {
    await memPalace.mine(repoDir, palaceWing);
  }

  return { search, mineChangedFiles, mineAll };
}
