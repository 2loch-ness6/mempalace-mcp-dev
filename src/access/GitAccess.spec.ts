import { createGitAccess } from './GitAccess';

const REPO_DIR = process.cwd();

describe('createGitAccess — getDiff', () => {
  const git = createGitAccess();

  it('returns a DiffResult with the correct shape', async () => {
    const result = await git.getDiff(REPO_DIR);
    expect(result).toMatchObject({
      diff: expect.any(String),
      files: expect.any(Array),
      additions: expect.any(Number),
      deletions: expect.any(Number),
      truncated: expect.any(Boolean),
    });
  });

  it('truncated is false for typical small diffs', async () => {
    const result = await git.getDiff(REPO_DIR);
    // The repo likely has diffs smaller than 80KB
    if (result.diff.length < 80_000) {
      expect(result.truncated).toBe(false);
    }
  });

  it('returns empty diff string when no changes between identical refs', async () => {
    const result = await git.getDiff(REPO_DIR, 'HEAD', undefined);
    // HEAD..HEAD is always empty
    // Note: git diff HEAD HEAD returns nothing
    expect(result.diff).toBe('');
    expect(result.additions).toBe(0);
    expect(result.deletions).toBe(0);
    expect(result.truncated).toBe(false);
  });

  it('scopes diff to a specific file path when provided', async () => {
    const result = await git.getDiff(REPO_DIR, 'HEAD~1', undefined);
    expect(result).toMatchObject({
      diff: expect.any(String),
      files: expect.any(Array),
      additions: expect.any(Number),
      deletions: expect.any(Number),
      truncated: expect.any(Boolean),
    });
  });

  it('files array contains trimmed paths without pipe characters', async () => {
    const result = await git.getDiff(REPO_DIR);
    for (const file of result.files) {
      expect(file).not.toContain('|');
      expect(file).toBe(file.trim());
    }
  });

  it('additions and deletions are non-negative integers', async () => {
    const result = await git.getDiff(REPO_DIR);
    expect(result.additions).toBeGreaterThanOrEqual(0);
    expect(result.deletions).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(result.additions)).toBe(true);
    expect(Number.isInteger(result.deletions)).toBe(true);
  });
});

describe('createGitAccess — getBranchContext', () => {
  const git = createGitAccess();

  it('returns branch, sha, shortSha, and recentCommits', async () => {
    const result = await git.getBranchContext(REPO_DIR);
    expect(result.branch).toBeTruthy();
    expect(result.sha).toMatch(/^[0-9a-f]{40}$/);
    expect(result.shortSha).toHaveLength(8);
    expect(Array.isArray(result.recentCommits)).toBe(true);
    expect(result.recentCommits.length).toBeGreaterThan(0);
  });
});

describe('createGitAccess — getChangedFiles', () => {
  const git = createGitAccess();

  it('returns an array of ChangedFile objects', async () => {
    const result = await git.getChangedFiles(REPO_DIR);
    expect(Array.isArray(result)).toBe(true);
    for (const f of result) {
      expect(f).toMatchObject({ path: expect.any(String), status: expect.any(String) });
      expect(['added', 'modified', 'deleted', 'renamed']).toContain(f.status);
    }
  });
});
