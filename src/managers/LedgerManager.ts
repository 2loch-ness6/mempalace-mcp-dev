import { randomUUID } from 'crypto';
import { createFileSystemAccess, FileSystemAccess, LedgerEntry } from '../access/FileSystemAccess.js';
import { createGitAccess, GitAccess } from '../access/GitAccess.js';

export interface LogChangeInput {
  sessionId: string;
  model: string;
  filesAffected: string[];
  description: string;
  reason: string;
  tags?: string[];
  conductorTrack?: string;
  conductorTask?: string;
}

export interface LedgerQueryResult {
  entries: LedgerEntry[];
  branch: string;
  sha: string;
}

export interface LedgerManager {
  logChange(input: LogChangeInput): Promise<LedgerEntry>;
  getSessionChanges(sessionId: string): Promise<LedgerQueryResult>;
  getFileLedger(filePath: string): Promise<LedgerQueryResult>;
  getAllChanges(since?: string): Promise<LedgerQueryResult>;
}

export function createLedgerManager(ledgerPath: string, repoDir: string): LedgerManager {
  const fs: FileSystemAccess = createFileSystemAccess();
  const git: GitAccess = createGitAccess();

  async function logChange(input: LogChangeInput): Promise<LedgerEntry> {
    const context = await git.getBranchContext(repoDir);
    const entry: LedgerEntry = {
      id: `chg_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
      timestamp: new Date().toISOString(),
      branch: context.branch,
      sha: context.sha,
      sessionId: input.sessionId,
      model: input.model,
      filesAffected: input.filesAffected,
      description: input.description,
      reason: input.reason,
      tags: input.tags ?? [],
      conductorTrack: input.conductorTrack,
      conductorTask: input.conductorTask,
    };

    await fs.appendLedgerEntry(ledgerPath, entry);
    return entry;
  }

  async function getSessionChanges(sessionId: string): Promise<LedgerQueryResult> {
    const [entries, context] = await Promise.all([
      fs.readLedger(ledgerPath),
      git.getBranchContext(repoDir),
    ]);

    return {
      entries: entries.filter((e) => e.sessionId === sessionId),
      branch: context.branch,
      sha: context.shortSha,
    };
  }

  async function getFileLedger(filePath: string): Promise<LedgerQueryResult> {
    const [entries, context] = await Promise.all([
      fs.readLedger(ledgerPath),
      git.getBranchContext(repoDir),
    ]);

    const normalized = filePath.replace(/\\/g, '/');
    return {
      entries: entries.filter((e) =>
        e.filesAffected.some((f) => f.replace(/\\/g, '/').includes(normalized)),
      ),
      branch: context.branch,
      sha: context.shortSha,
    };
  }

  async function getAllChanges(since?: string): Promise<LedgerQueryResult> {
    const [entries, context] = await Promise.all([
      fs.readLedger(ledgerPath),
      git.getBranchContext(repoDir),
    ]);

    const filtered = since
      ? entries.filter((e) => e.timestamp >= since)
      : entries;

    return {
      entries: filtered,
      branch: context.branch,
      sha: context.shortSha,
    };
  }

  return { logChange, getSessionChanges, getFileLedger, getAllChanges };
}
