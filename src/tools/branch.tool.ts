import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BranchManager } from '../managers/BranchManager.js';

export const GetBranchContextSchema = z.object({});

export const GetChangedFilesSchema = z.object({
  base: z.string().optional(),
});

export function registerBranchTools(server: McpServer, manager: BranchManager): void {
  server.tool('get_branch_context', 'Get the current git branch, HEAD SHA, and recent commits. Always call this first to anchor your context to the correct branch.', GetBranchContextSchema.shape, async () => {
    const context = await manager.getContext();
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(context, null, 2) }],
    };
  });

  server.tool('get_changed_files', 'List files changed since a base ref (default: HEAD~1). Useful to understand scope of recent changes.', GetChangedFilesSchema.shape, async (args) => {
    const result = await manager.getChangedFiles(args.base);
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
    };
  });
}
