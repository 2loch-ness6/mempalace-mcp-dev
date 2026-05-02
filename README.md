# @mempalace/mcp-dev

An MCP (Model Context Protocol) server that gives AI coding assistants grounded, branch-scoped context about your codebase. It provides semantic code search via [MemPalace](https://github.com/2loch-ness6/mempalace), git change tracking, a persistent change ledger, TypeScript/Jest dev lifecycle tools, and a built-in **Project Tracks** (Conductor) methodology for structured feature work.

## Features

| Feature | Description |
|---|---|
| **Semantic code search** | Natural-language queries over your indexed codebase via MemPalace embeddings |
| **Branch context** | Current branch, SHA, recent commits — always oriented |
| **Change ledger** | Append-only JSONL log of every AI-assisted change with full provenance |
| **Dev lifecycle** | Run `tsc` typecheck and Jest tests from within the MCP client |
| **Git diff** | Full or file-scoped diff output |
| **Project Tracks** | Create and manage markdown-based feature tracks (plan/spec/index/metadata) |

---

## Prerequisites

- **Node.js** ≥ 18
- **Python** ≥ 3.9 with [MemPalace](https://github.com/2loch-ness6/mempalace) installed
- A git repository to point at

### Install MemPalace

```bash
pip install mempalace
# or from the fork with exclude-patterns support:
pip install git+https://github.com/2loch-ness6/mempalace@feat/exclude-patterns-config
```

---

## Quick Start

### 1. Install the MCP server

```bash
npm install -g @mempalace/mcp-dev
```

Or use without installing via `npx`:

```bash
npx @mempalace/mcp-dev
```

### 2. Configure environment variables

```bash
export MCP_REPO_DIR=/path/to/your/repo        # defaults to process.cwd()
export MCP_PALACE_DIR=~/.mempalace/active      # MemPalace data directory
export MCP_PALACE_WING=code                    # wing name (namespace) for your repo
export MEMPALACE_PYTHON=python3                # python binary with mempalace installed
```

### 3. Index your codebase

```bash
mempalace --palace ~/.mempalace/active mine /path/to/your/repo --wing code --mode projects
```

### 4. (Alternative) Use the setup script

A convenience script is provided at `scripts/setup-mempalace.sh` that automates the
MemPalace bootstrap for this MCP server. It clones Lochlyn's fork (with the
necessary exclude-patterns support), creates a Python venv, installs the fork
in editable mode, symlinks the CLI, and prepares the palace directory.

```bash
# From the repo root:
./scripts/setup-mempalace.sh

# Or to also do the initial mine of your codebase:
./scripts/setup-mempalace.sh --mine
```

The script is fully env-overridable (see top of file for options):

| Env var | Default | Description |
|---|---|---|
| `MEMPALACE_FORK_URL` | `https://github.com/2loch-ness6/mempalace` | Fork URL with multi-branch support |
| `MEMPALACE_FORK_BRANCH` | `feat/exclude-patterns-config` | Branch with exclude-patterns feature |
| `MEMPALACE_FORK_DIR` | `$HOME/.mempalace-fork` | Where to clone the fork |
| `MEMPALACE_VENV_DIR` | `$HOME/.mempalace` | Python venv location |
| `MCP_PALACE_DIR` | `<repo-root>/.palace/active` | Palace data directory |
| `MCP_PALACE_WING` | `code` | Palace wing (namespace) |
| `MCP_REPO_DIR` | `<repo-root>` | Source code to mine |

---

### 5. Add to your MCP client config

For Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "mempalace-mcp-dev": {
      "command": "npx",
      "args": ["@mempalace/mcp-dev"],
      "env": {
        "MCP_REPO_DIR": "/path/to/your/repo",
        "MCP_PALACE_DIR": "/home/you/.mempalace/active",
        "MCP_PALACE_WING": "code",
        "MEMPALACE_PYTHON": "python3"
      }
    }
  }
}
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `MCP_REPO_DIR` | `process.cwd()` | Absolute path to your git repository root |
| `MCP_PALACE_DIR` | `~/.mempalace/active` | MemPalace data directory |
| `MCP_PALACE_WING` | `code` | Wing (namespace) name within the palace |
| `MCP_LEDGER_PATH` | `<repo>/.mcp-dev/ledger.jsonl` | Path to the change ledger file |
| `MCP_TRACKS_DIR` | `<repo>/conductor/tracks` | Directory containing project track folders |
| `MEMPALACE_PYTHON` | `python3` | Python binary (must have `mempalace` installed) |

---

## MCP Tools Reference

### Code Search

| Tool | Description |
|---|---|
| `search_code` | Semantic search over indexed codebase. Accepts `query` (string) and optional `scope` (room name) and `limit` (int, default 10) |
| `mine_changed_files` | Re-index files changed since the last git commit. Call after editing to keep search current |

### Branch & Git

| Tool | Description |
|---|---|
| `get_branch_context` | Returns current branch, SHA, short SHA, and last 5 commit messages |
| `get_changed_files` | Files changed vs `HEAD~1` (or a specified base ref) with add/modify/delete status |
| `get_git_diff` | Full diff output. Optional `base` ref and `filePath` for scoping |

### Change Ledger

| Tool | Description |
|---|---|
| `record_change` | Append an entry to the ledger (files affected, description, reason, tags, optional track link) |
| `read_ledger` | Read recent ledger entries. Optional `limit` (default 20) and `branch` filter |

### Dev Lifecycle

| Tool | Description |
|---|---|
| `run_typecheck` | Run `tsc --noEmit` in a service directory. Returns structured errors with file/line/col/code |
| `run_tests` | Run Jest in a service directory. Returns pass/fail counts and structured failure details |

### Project Tracks (Conductor)

| Tool | Description |
|---|---|
| `list_tracks` | List all live tracks (directories containing `plan.md`) |
| `get_track_plan` | Read `plan.md` for a track |
| `update_track_plan` | Overwrite `plan.md` for a track |
| `get_track_spec` | Read `spec.md` for a track |
| `update_track_spec` | Overwrite `spec.md` for a track |
| `get_track_index` | Read `index.md` for a track |
| `update_track_index` | Overwrite `index.md` for a track |
| `create_track` | Scaffold a new track directory with all four files |

---

## Project Tracks Methodology (Conductor)

Project Tracks is a lightweight, file-based feature management system. Each **track** is a directory containing up to four files:

```
conductor/tracks/
└── my-feature-20260501/
    ├── plan.md       ← living task list; the status source of truth
    ├── spec.md       ← technical spec, design decisions, acceptance criteria
    ├── index.md      ← short summary and linked resources
    └── metadata.json ← machine-readable metadata (id, owner, status, dates)
```

**Rules:**
- A directory is a live track only if it contains `plan.md`.
- `plan.md` is always read/written live from disk (never via MemPalace — no staleness).
- Track slugs must match `[a-zA-Z0-9][a-zA-Z0-9_-]*` (max 100 chars).

**Bootstrapping tracks in a new project:**

```bash
# Create the tracks directory
mkdir -p conductor/tracks

# Use the MCP tool to scaffold a track
# (or copy from templates/track/ in this package)
```

Template files are included in `templates/track/` for manual scaffolding.

---

## MemPalace Configuration (`mempalace.yaml`)

Place a `mempalace.yaml` at the root of `MCP_REPO_DIR` to control how files are indexed. A generic example is provided in `mempalace.yaml.example`.

Key sections:
- `wing` — must match `MCP_PALACE_WING`
- `exclude_patterns` — gitignore-syntax patterns to skip during mining
- `rooms` — semantic routing rules (keyword → room name) for search scoping

---

## Development

```bash
git clone https://github.com/your-org/mempalace-mcp-dev
cd mempalace-mcp-dev
npm install
npm run build
npm test
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution guidelines.

---

## License

MIT — see [LICENSE](./LICENSE).
