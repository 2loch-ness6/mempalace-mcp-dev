import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { DevLifecycleManager } from '../managers/DevLifecycleManager.js';

export const RunTypecheckSchema = z.object({
  servicePath: z
    .string()
    .describe(
      'Relative path from repo root to the service to typecheck. E.g. "ops/control-panel/server", "SeID/seid-core", "packages/overlay-contracts".',
    ),
});

export const RunTestsSchema = z.object({
  servicePath: z
    .string()
    .describe(
      'Relative path from repo root to the service to test. E.g. "ops/control-panel/server".',
    ),
  pattern: z
    .string()
    .optional()
    .describe('Optional Jest test name pattern to run a subset of tests.'),
});

export const GetGitDiffSchema = z.object({
  base: z
    .string()
    .optional()
    .describe(
      'Base git ref to diff against. Defaults to HEAD~1 (last commit). Use "HEAD" for uncommitted changes.',
    ),
  file: z
    .string()
    .optional()
    .describe('Optional file path to scope the diff to a single file.'),
});

export function registerDevLifecycleTools(
  server: McpServer,
  manager: DevLifecycleManager,
): void {
  server.tool(
    'run_typecheck',
    'Run TypeScript type-checking (tsc --noEmit) for a service. Returns structured errors with file, line, column, and message. Call after writing code to verify correctness before committing.',
    RunTypecheckSchema.shape,
    async (args) => {
      const result = await manager.runTypecheck(args.servicePath);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.tool(
    'run_tests',
    'Run Jest tests for a service. Returns pass/fail counts and structured failure details with test names and error messages. Optionally scope to a test name pattern.',
    RunTestsSchema.shape,
    async (args) => {
      const result = await manager.runTests(args.servicePath, args.pattern);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.tool(
    'get_git_diff',
    'Get the full unified diff between two refs (default: HEAD~1..HEAD). Returns diff text, file list, and addition/deletion counts. Use to review changes before logging them to the ledger.',
    GetGitDiffSchema.shape,
    async (args) => {
      const result = await manager.getDiff(args.base, args.file);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}
