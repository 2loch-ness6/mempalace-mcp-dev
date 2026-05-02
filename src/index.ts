#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { join, resolve } from 'path';
import { mkdirSync, existsSync } from 'fs';
import { homedir } from 'os';

import { createCodeSearchManager } from './managers/CodeSearchManager.js';
import { createLedgerManager } from './managers/LedgerManager.js';
import { createBranchManager } from './managers/BranchManager.js';
import { createConductorManager } from './managers/ConductorManager.js';
import { createDevLifecycleManager } from './managers/DevLifecycleManager.js';

import { registerCodeSearchTools } from './tools/code-search.tool.js';
import { registerLedgerTools } from './tools/ledger.tool.js';
import { registerBranchTools } from './tools/branch.tool.js';
import { registerConductorTools } from './tools/conductor.tool.js';
import { registerDevLifecycleTools } from './tools/dev-lifecycle.tool.js';

import { createLogger } from './utilities/LoggingUtility.js';

const log = createLogger('mempalace-mcp-dev');

// --- Configuration (env-overridable) ---
const REPO_DIR = resolve(process.env['MCP_REPO_DIR'] ?? process.cwd());
const PALACE_DIR = resolve(process.env['MCP_PALACE_DIR'] ?? join(homedir(), '.mempalace', 'active'));
const PALACE_WING = process.env['MCP_PALACE_WING'] ?? 'code';
const LEDGER_PATH = resolve(process.env['MCP_LEDGER_PATH'] ?? join(REPO_DIR, '.mcp-dev', 'ledger.jsonl'));
const TRACKS_DIR = resolve(process.env['MCP_TRACKS_DIR'] ?? join(REPO_DIR, 'conductor', 'tracks'));

// --- Ensure required dirs exist ---
const mcpDevDir = join(REPO_DIR, '.mcp-dev');
if (!existsSync(mcpDevDir)) mkdirSync(mcpDevDir, { recursive: true });
if (!existsSync(PALACE_DIR)) mkdirSync(PALACE_DIR, { recursive: true });

// --- Compose Managers ---
const codeSearchManager = createCodeSearchManager(PALACE_DIR, PALACE_WING, REPO_DIR);
const ledgerManager = createLedgerManager(LEDGER_PATH, REPO_DIR);
const branchManager = createBranchManager(REPO_DIR);
const conductorManager = createConductorManager(TRACKS_DIR);
const devLifecycleManager = createDevLifecycleManager(REPO_DIR);

// --- MCP Server ---
const server = new McpServer(
  { name: 'mempalace-mcp-dev', version: '1.0.0' },
);

// --- Register Tools (Clients in IDesign terms) ---
registerCodeSearchTools(server, codeSearchManager, REPO_DIR);
registerLedgerTools(server, ledgerManager);
registerBranchTools(server, branchManager);
registerConductorTools(server, conductorManager);
registerDevLifecycleTools(server, devLifecycleManager);

// --- Start ---
async function main(): Promise<void> {
  log.info('Starting mempalace-mcp-dev', {
    repoDir: REPO_DIR,
    palaceDir: PALACE_DIR,
    palaceWing: PALACE_WING,
    ledgerPath: LEDGER_PATH,
    tracksDir: TRACKS_DIR,
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  log.info('mempalace-mcp-dev running on stdio');
}

main().catch((err: unknown) => {
  log.error('Fatal error', { error: String(err) });
  process.exit(1);
});
