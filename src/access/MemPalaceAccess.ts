import { execFile } from 'child_process';
import { promisify } from 'util';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const execFileAsync = promisify(execFile);

// Path to the Python bridge script for JSON search output.
// mempalace search has no --format json flag; we use the Python API directly.
const BRIDGE_SCRIPT = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'scripts',
  'mp_search_bridge.py',
);

export interface MemPalaceSearchResult {
  content: string;
  source: string;
  score: number;
  room: string;
  wing: string;
}

export interface MemPalaceAccess {
  search(query: string, wing: string, limit: number): Promise<MemPalaceSearchResult[]>;
  mine(dir: string, wing: string): Promise<void>;
  mineFile(filePath: string, wing: string): Promise<void>;
}

export function createMemPalaceAccess(palaceDir: string): MemPalaceAccess {
  async function search(
    query: string,
    wing: string,
    limit: number,
  ): Promise<MemPalaceSearchResult[]> {
    const pythonBin = process.env['MEMPALACE_PYTHON'] ?? 'python3';
    const { stdout } = await execFileAsync(pythonBin, [
      BRIDGE_SCRIPT,
      palaceDir,
      wing,
      String(limit),
      query,
    ]);

    const raw: unknown = JSON.parse(stdout);
    if (!Array.isArray(raw)) return [];

    return (raw as Record<string, unknown>[]).map((r) => ({
      content: String(r['content'] ?? ''),
      source: String(r['source'] ?? ''),
      score: Number(r['score'] ?? 0),
      room: String(r['room'] ?? ''),
      wing: String(r['wing'] ?? wing),
    }));
  }

  async function mine(dir: string, wing: string): Promise<void> {
    await execFileAsync('mempalace', [
      '--palace', palaceDir,
      'mine', dir,
      '--wing', wing,
      '--mode', 'projects',
    ]);
  }

  async function mineFile(filePath: string, wing: string): Promise<void> {
    await mine(filePath, wing);
  }

  return { search, mine, mineFile };
}

