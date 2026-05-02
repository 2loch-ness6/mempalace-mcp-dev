import { extname } from 'path';

// Code-only mining policy. Docs, configs, build artifacts are excluded.
// If the strategy changes (e.g. add .graphql), only this Engine changes.

const ALLOWED_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mts',
  '.cts',
  '.prisma',
  '.graphql',
  '.gql',
  '.sql',
  '.sh',
]);

const EXCLUDED_PATH_FRAGMENTS = [
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.git',
  '.palace',
  '.mcp-dev',
  '__snapshots__',
];

const EXCLUDED_FILENAMES = new Set([
  '.env',
  '.env.example',
  '.env.dev',
  '.env.production',
  '.env.staging',
]);

export interface FileFilterEngine {
  isMineable(filePath: string): boolean;
  filterPaths(filePaths: string[]): string[];
}

export function createFileFilterEngine(): FileFilterEngine {
  function isMineable(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, '/');

    for (const fragment of EXCLUDED_PATH_FRAGMENTS) {
      if (normalized.includes(`/${fragment}/`) || normalized.includes(`/${fragment}`)) {
        return false;
      }
    }

    const filename = normalized.split('/').pop() ?? '';
    if (EXCLUDED_FILENAMES.has(filename)) return false;
    if (filename.startsWith('.env')) return false;

    const ext = extname(filename);
    return ALLOWED_EXTENSIONS.has(ext);
  }

  function filterPaths(filePaths: string[]): string[] {
    return filePaths.filter(isMineable);
  }

  return { isMineable, filterPaths };
}
