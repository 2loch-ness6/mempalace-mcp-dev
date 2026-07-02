# Contributing

Thank you for your interest in contributing to `mempalace-mcp-dev`.

## Getting Started

```bash
git clone https://github.com/your-org/mempalace-mcp-dev
cd mempalace-mcp-dev
npm install
npm run build
npm test
```

## Code Style

- **TypeScript strict mode** — no `any`, explicit return types on public functions
- **Formatting:** 2-space indent, single quotes, 100-char line width (Prettier)
- **Lint:** ESLint with TypeScript rules (`npm run lint`)
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:`)

## Architecture

The codebase follows the IDesign layered pattern:

```
src/
  access/      ← I/O boundary (filesystem, git, process, MemPalace)
  engines/     ← pure transformation logic (filtering, scoping)
  managers/    ← business logic, orchestration
  tools/       ← MCP tool registration (thin adapters over managers)
  utilities/   ← shared helpers (logging)
```

Rules:
- **Tools** only call **Managers**; they never call Access or Engines directly.
- **Managers** may call Access and Engines; they do not call other Managers.
- **Access** objects are created once and injected; they do no business logic.

## Testing

```bash
npm test                     # run all tests
npm run test:coverage        # with coverage report
npm run typecheck            # TypeScript check without emit
```

- Write unit tests for all new manager and engine logic.
- Mock Access objects at the module boundary using `jest.unstable_mockModule`.
- Target ≥ 85% coverage on new code.

## Pull Requests

1. Fork the repo and create a feature branch: `git checkout -b feat/my-feature`
2. Make your changes with tests.
3. Run `npm run build && npm test && npm run typecheck` — all must pass.
4. Open a PR against `main` with a clear description of what changed and why.

## Reporting Issues

Please open a GitHub issue with:
- Steps to reproduce
- Expected vs actual behaviour
- Node.js version, OS, and relevant environment variables
