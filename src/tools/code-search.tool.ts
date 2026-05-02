import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CodeSearchManager } from '../managers/CodeSearchManager.js';

export const SearchCodeSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().min(1).max(50).optional().default(10),
  scope: z.string().optional(),
});

export const MineChangedFilesSchema = z.object({});

export function registerCodeSearchTools(server: McpServer, manager: CodeSearchManager, repoDir: string): void {
  server.tool('search_code', 'Semantic search over the current branch\'s code. Returns branch-stamped results from MemPalace. Never searches docs or config.', SearchCodeSchema.shape, async (args) => {
    const result = await manager.search({ query: args.query, limit: args.limit, scope: args.scope });
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            branch: result.branch,
            sha: result.sha,
            totalFound: result.totalFound,
            results: result.results.map((r) => ({
              source: r.source,
              score: r.score,
              room: r.room,
              branchStamp: r.branchStamp,
              content: r.content,
            })),
          }, null, 2),
        },
      ],
    };
  });

  server.tool('mine_changed_files', 'Re-index files changed since last commit into MemPalace. Call after making code changes to keep the search index current.', MineChangedFilesSchema.shape, async () => {
    const result = await manager.mineChangedFiles(repoDir);
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ mined: result.mined, skipped: result.skipped }),
        },
      ],
    };
  });
}
