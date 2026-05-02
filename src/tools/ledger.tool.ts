import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { LedgerManager } from '../managers/LedgerManager.js';

export const LogChangeSchema = z.object({
  sessionId: z.string().min(1),
  model: z.string().min(1),
  filesAffected: z.array(z.string()).min(1),
  description: z.string().min(1),
  reason: z.string().min(1),
  tags: z.array(z.string()).optional(),
  conductorTrack: z.string().optional(),
  conductorTask: z.string().optional(),
});

export const GetSessionChangesSchema = z.object({
  sessionId: z.string().min(1),
});

export const GetFileLedgerSchema = z.object({
  filePath: z.string().min(1),
});

export const GetAllChangesSchema = z.object({
  since: z.string().optional(),
});

export function registerLedgerTools(server: McpServer, manager: LedgerManager): void {
  server.tool('log_change', 'Log a code change to the persistent change ledger. Models MUST call this after modifying files. Enables cross-session coherence.', LogChangeSchema.shape, async (args) => {
    const entry = await manager.logChange(args);
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(entry, null, 2) }],
    };
  });

  server.tool('get_session_changes', 'Retrieve all changes logged in the current session. Use at session start to understand what was done previously.', GetSessionChangesSchema.shape, async (args) => {
    const result = await manager.getSessionChanges(args.sessionId);
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
    };
  });

  server.tool('get_file_ledger', 'Get all logged changes that touched a specific file path. Use to understand the change history of a file before modifying it.', GetFileLedgerSchema.shape, async (args) => {
    const result = await manager.getFileLedger(args.filePath);
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
    };
  });

  server.tool('get_all_changes', 'Get all changes in the ledger, optionally filtered by ISO timestamp.', GetAllChangesSchema.shape, async (args) => {
    const result = await manager.getAllChanges(args.since);
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
    };
  });
}
