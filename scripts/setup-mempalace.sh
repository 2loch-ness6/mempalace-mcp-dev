#!/usr/bin/env bash
# setup-mempalace.sh — Bootstrap MemPalace for statick-mcp-dev on a new dev machine.
#
# Usage:
#   ./setup-mempalace.sh           # setup only
#   ./setup-mempalace.sh --mine    # setup + full initial index of the codebase
#
# All paths are env-overridable. Defaults match the statick-mcp-dev MCP server
# config in packages/mcp-dev/src/index.ts and src/access/MemPalaceAccess.ts.
#
# Env vars:
#   MEMPALACE_FORK_URL     Fork to clone (default: https://github.com/2loch-ness6/mempalace)
#   MEMPALACE_FORK_BRANCH  Branch with exclude-patterns feature (default: feat/exclude-patterns-config)
#   MEMPALACE_FORK_DIR     Where to clone the fork (default: $HOME/.mempalace-fork)
#   MEMPALACE_VENV_DIR     Python venv location (default: $HOME/.mempalace)
#   MEMPALACE_PYTHON       python3 binary to create the venv (default: auto-detected)
#   STATICK_PALACE_DIR     Palace data directory (default: <git-root>/.palace/active)
#   STATICK_PALACE_WING    Wing name to use when mining (default: statick_code)
#   STATICK_REPO_DIR       Monorepo source to mine (default: <git-root>/Statick-Industries)

set -euo pipefail

# ── Colour helpers ────────────────────────────────────────────────────────────
BOLD=$'\e[1m'; GREEN=$'\e[32m'; YELLOW=$'\e[33m'; RED=$'\e[31m'; RESET=$'\e[0m'
info()    { echo "${BOLD}${GREEN}[setup-mempalace]${RESET} $*"; }
warn()    { echo "${BOLD}${YELLOW}[setup-mempalace] WARN:${RESET} $*"; }
err()     { echo "${BOLD}${RED}[setup-mempalace] ERROR:${RESET} $*" >&2; }
section() { echo ""; echo "${BOLD}── $* ──────────────────────────────────────${RESET}"; }

# ── Locate repo root (this script lives there) ────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GIT_ROOT="$SCRIPT_DIR"

# ── Defaults (all overridable via env) ───────────────────────────────────────
FORK_URL="${MEMPALACE_FORK_URL:-https://github.com/2loch-ness6/mempalace}"
FORK_BRANCH="${MEMPALACE_FORK_BRANCH:-feat/exclude-patterns-config}"
FORK_DIR="${MEMPALACE_FORK_DIR:-$HOME/.mempalace-fork}"
VENV_DIR="${MEMPALACE_VENV_DIR:-$HOME/.mempalace}"
PALACE_DIR="${STATICK_PALACE_DIR:-$GIT_ROOT/.palace/active}"
PALACE_WING="${STATICK_PALACE_WING:-statick_code}"
REPO_DIR="${STATICK_REPO_DIR:-$GIT_ROOT/Statick-Industries}"

# ── Parse args ────────────────────────────────────────────────────────────────
DO_MINE=false
for arg in "$@"; do
  case "$arg" in
    --mine) DO_MINE=true ;;
    --help|-h)
      sed -n '2,20p' "${BASH_SOURCE[0]}" | sed 's/^# \?//'
      exit 0
      ;;
    *) err "Unknown argument: $arg"; exit 1 ;;
  esac
done

# ── Resolve python3 binary ───────────────────────────────────────────────────
if [ -n "${MEMPALACE_PYTHON:-}" ]; then
  PYTHON_BIN="$MEMPALACE_PYTHON"
elif command -v python3.11 &>/dev/null; then
  PYTHON_BIN="$(command -v python3.11)"
elif command -v python3 &>/dev/null; then
  PYTHON_BIN="$(command -v python3)"
else
  err "python3 not found. Install Python 3.9+ first."
  exit 1
fi

PYTHON_VERSION="$("$PYTHON_BIN" --version 2>&1)"
info "Using Python: $PYTHON_BIN ($PYTHON_VERSION)"

# ── Validate repo dir ─────────────────────────────────────────────────────────
if [ ! -d "$REPO_DIR" ]; then
  err "Repo dir not found: $REPO_DIR"
  err "Set STATICK_REPO_DIR or run this script from the git root."
  exit 1
fi
MEMPALACE_YAML="$REPO_DIR/mempalace.yaml"
if [ ! -f "$MEMPALACE_YAML" ]; then
  warn "mempalace.yaml not found at $MEMPALACE_YAML — mining may use defaults."
fi

# =============================================================================
section "1/5  Clone / update mempalace fork"
# =============================================================================

if [ -d "$FORK_DIR/.git" ]; then
  EXISTING_REMOTE="$(git -C "$FORK_DIR" remote get-url origin 2>/dev/null || true)"
  if [ "$EXISTING_REMOTE" != "$FORK_URL" ]; then
    warn "Existing clone at $FORK_DIR has different remote: $EXISTING_REMOTE"
    warn "Remove it manually or set MEMPALACE_FORK_DIR to a different path."
    exit 1
  fi
  info "Fork already cloned at $FORK_DIR — fetching latest..."
  git -C "$FORK_DIR" fetch --quiet origin
  git -C "$FORK_DIR" checkout --quiet "$FORK_BRANCH"
  git -C "$FORK_DIR" pull --quiet --ff-only origin "$FORK_BRANCH"
  info "Fork up-to-date at $(git -C "$FORK_DIR" rev-parse --short HEAD)"
else
  info "Cloning $FORK_URL  (branch: $FORK_BRANCH)  →  $FORK_DIR"
  git clone --quiet --branch "$FORK_BRANCH" --single-branch "$FORK_URL" "$FORK_DIR"
  info "Cloned at $(git -C "$FORK_DIR" rev-parse --short HEAD)"
fi

# =============================================================================
section "2/5  Create Python venv"
# =============================================================================

if [ -f "$VENV_DIR/bin/python3" ]; then
  info "Venv exists at $VENV_DIR — skipping creation"
else
  info "Creating venv at $VENV_DIR ..."
  "$PYTHON_BIN" -m venv "$VENV_DIR"
  info "Venv created"
fi

VENV_PYTHON="$VENV_DIR/bin/python3"
VENV_PIP="$VENV_DIR/bin/pip"

# =============================================================================
section "3/5  Install mempalace fork (editable)"
# =============================================================================

info "Upgrading pip..."
"$VENV_PIP" install --quiet --upgrade pip

info "Installing fork from $FORK_DIR (editable)..."
"$VENV_PIP" install --quiet -e "$FORK_DIR"

INSTALLED_VERSION="$("$VENV_PYTHON" -c "import importlib.metadata; print(importlib.metadata.version('mempalace'))")"
info "Installed mempalace $INSTALLED_VERSION"

# =============================================================================
section "4/5  Symlink mempalace CLI to ~/.local/bin"
# =============================================================================

LINK_DIR="$HOME/.local/bin"
LINK="$LINK_DIR/mempalace"
VENV_MP_BIN="$VENV_DIR/bin/mempalace"

mkdir -p "$LINK_DIR"

if [ ! -f "$VENV_MP_BIN" ]; then
  err "mempalace binary not found at $VENV_MP_BIN — installation may have failed."
  exit 1
fi

if [ -L "$LINK" ] || [ -f "$LINK" ]; then
  CURRENT_TARGET="$(readlink "$LINK" 2>/dev/null || true)"
  if [ "$CURRENT_TARGET" = "$VENV_MP_BIN" ]; then
    info "Symlink already correct: $LINK → $VENV_MP_BIN"
  else
    warn "Replacing existing link/file at $LINK (was: $CURRENT_TARGET)"
    rm -f "$LINK"
    ln -s "$VENV_MP_BIN" "$LINK"
    info "Symlinked: $LINK → $VENV_MP_BIN"
  fi
else
  ln -s "$VENV_MP_BIN" "$LINK"
  info "Symlinked: $LINK → $VENV_MP_BIN"
fi

# Warn if ~/.local/bin isn't on PATH
if ! echo "$PATH" | tr ':' '\n' | grep -qx "$LINK_DIR"; then
  warn "$LINK_DIR is not in your PATH."
  warn "Add the following to your shell rc file:"
  warn "  export PATH=\"\$HOME/.local/bin:\$PATH\""
fi

# =============================================================================
section "5/5  Create palace directory"
# =============================================================================

mkdir -p "$PALACE_DIR"
info "Palace directory ready: $PALACE_DIR"

# =============================================================================
section "Verification"
# =============================================================================

# Quick smoke-test: can the venv python import mempalace?
"$VENV_PYTHON" -c "import mempalace; import mempalace.miner" \
  && info "mempalace import OK" \
  || { err "mempalace import failed — check installation above."; exit 1; }

# =============================================================================
section "Summary"
# =============================================================================

echo ""
echo "  ${BOLD}Fork dir:${RESET}      $FORK_DIR  ($(git -C "$FORK_DIR" rev-parse --short HEAD) on $FORK_BRANCH)"
echo "  ${BOLD}Venv:${RESET}          $VENV_DIR"
echo "  ${BOLD}Python:${RESET}        $VENV_PYTHON"
echo "  ${BOLD}CLI:${RESET}           $LINK"
echo "  ${BOLD}Palace dir:${RESET}    $PALACE_DIR"
echo "  ${BOLD}Wing:${RESET}          $PALACE_WING"
echo "  ${BOLD}Repo dir:${RESET}      $REPO_DIR"
echo ""

# ── MCP server env vars to document ──────────────────────────────────────────
echo "  ${BOLD}Set these env vars for statick-mcp-dev (if not using defaults):${RESET}"
echo "    STATICK_PALACE_DIR=$PALACE_DIR"
echo "    STATICK_PALACE_WING=$PALACE_WING"
echo "    MEMPALACE_PYTHON=$VENV_PYTHON"
echo "    STATICK_REPO_DIR=$REPO_DIR"
echo ""

# =============================================================================
# Optional: initial mine
# =============================================================================

if [ "$DO_MINE" = true ]; then
  section "Initial mine  (this may take several minutes)"
  info "Mining $REPO_DIR → palace wing '$PALACE_WING' ..."
  "$LINK" --palace "$PALACE_DIR" mine "$REPO_DIR" --wing "$PALACE_WING" --mode projects
  info "Initial mine complete."
else
  echo "  ${BOLD}To index the codebase now:${RESET}"
  echo "    $0 --mine"
  echo ""
  echo "  ${BOLD}Or from the MCP server (after it's running):${RESET}"
  echo "    mine_changed_files()"
  echo ""
fi

echo "${BOLD}${GREEN}✅  MemPalace setup complete.${RESET}"
