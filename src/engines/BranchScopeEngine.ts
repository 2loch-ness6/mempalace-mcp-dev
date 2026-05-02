import { MemPalaceSearchResult } from '../access/MemPalaceAccess.js';
import { BranchContext } from '../access/GitAccess.js';

// Filters MemPalace results to only those indexed from the current branch.
// If branch-scoping strategy changes, only this Engine changes.

export interface BranchScopedResult extends MemPalaceSearchResult {
  branchStamp: string;
  shaStamp: string;
}

export interface BranchScopeEngine {
  filterResults(
    results: MemPalaceSearchResult[],
    context: BranchContext,
  ): BranchScopedResult[];
  stampResult(result: MemPalaceSearchResult, context: BranchContext): BranchScopedResult;
}

export function createBranchScopeEngine(): BranchScopeEngine {
  function stampResult(
    result: MemPalaceSearchResult,
    context: BranchContext,
  ): BranchScopedResult {
    return {
      ...result,
      branchStamp: context.branch,
      shaStamp: context.shortSha,
    };
  }

  function filterResults(
    results: MemPalaceSearchResult[],
    context: BranchContext,
  ): BranchScopedResult[] {
    // Results tagged with a branch metadata field are filtered to current branch.
    // Results without branch metadata (legacy indexed) are passed through with a warning stamp.
    return results
      .filter((r) => {
        const sourceBranch = extractBranchFromSource(r.source);
        if (!sourceBranch) return true; // no branch tag — pass through
        return sourceBranch === context.branch;
      })
      .map((r) => stampResult(r, context));
  }

  function extractBranchFromSource(source: string): string | null {
    // Convention: source paths may be prefixed as "branch::<name>::<path>"
    // when mined via this server. Plain paths have no branch prefix.
    const match = source.match(/^branch::([^:]+)::/);
    return match?.[1] ?? null;
  }

  return { filterResults, stampResult };
}
