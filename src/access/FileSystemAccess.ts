import { readFile, writeFile, readdir, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

export interface LedgerEntry {
  id: string;
  timestamp: string;
  branch: string;
  sha: string;
  sessionId: string;
  model: string;
  filesAffected: string[];
  description: string;
  reason: string;
  tags: string[];
  conductorTrack?: string;
  conductorTask?: string;
}

export interface TrackPlan {
  trackName: string;
  content: string;
}

export interface TrackFile {
  trackName: string;
  filename: string;
  content: string;
}

export interface FileSystemAccess {
  appendLedgerEntry(ledgerPath: string, entry: LedgerEntry): Promise<void>;
  readLedger(ledgerPath: string): Promise<LedgerEntry[]>;
  readTrackPlan(tracksDir: string, trackName: string): Promise<TrackPlan>;
  writeTrackPlan(tracksDir: string, trackName: string, content: string): Promise<void>;
  readTrackFile(tracksDir: string, trackName: string, filename: string): Promise<TrackFile>;
  writeTrackFile(tracksDir: string, trackName: string, filename: string, content: string): Promise<void>;
  createTrackDir(tracksDir: string, slug: string, files: Record<string, string>): Promise<void>;
  listTracks(tracksDir: string): Promise<string[]>;
  readFileRaw(filePath: string): Promise<string>;
}

export function createFileSystemAccess(): FileSystemAccess {
  async function appendLedgerEntry(ledgerPath: string, entry: LedgerEntry): Promise<void> {
    const line = JSON.stringify(entry) + '\n';
    await writeFile(ledgerPath, line, { flag: 'a', encoding: 'utf8' });
  }

  async function readLedger(ledgerPath: string): Promise<LedgerEntry[]> {
    if (!existsSync(ledgerPath)) return [];
    const raw = await readFile(ledgerPath, 'utf8');
    return raw
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as LedgerEntry);
  }

  async function readTrackPlan(tracksDir: string, trackName: string): Promise<TrackPlan> {
    const planPath = join(tracksDir, trackName, 'plan.md');
    const content = await readFile(planPath, 'utf8');
    return { trackName, content };
  }

  async function writeTrackPlan(tracksDir: string, trackName: string, content: string): Promise<void> {
    const planPath = join(tracksDir, trackName, 'plan.md');
    await writeFile(planPath, content, { encoding: 'utf8' });
  }

  async function readTrackFile(tracksDir: string, trackName: string, filename: string): Promise<TrackFile> {
    const filePath = join(tracksDir, trackName, filename);
    const content = await readFile(filePath, 'utf8');
    return { trackName, filename, content };
  }

  async function writeTrackFile(tracksDir: string, trackName: string, filename: string, content: string): Promise<void> {
    const filePath = join(tracksDir, trackName, filename);
    await writeFile(filePath, content, { encoding: 'utf8' });
  }

  async function createTrackDir(tracksDir: string, slug: string, files: Record<string, string>): Promise<void> {
    const trackDir = join(tracksDir, slug);
    await mkdir(trackDir, { recursive: false });
    await Promise.all(
      Object.entries(files).map(([filename, content]) =>
        writeFile(join(trackDir, filename), content, { encoding: 'utf8' }),
      ),
    );
  }

  async function listTracks(tracksDir: string): Promise<string[]> {
    const entries = await readdir(tracksDir, { withFileTypes: true });
    const tracks: string[] = [];
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const planPath = join(tracksDir, entry.name, 'plan.md');
        if (existsSync(planPath)) {
          tracks.push(entry.name);
        }
      }
    }
    return tracks;
  }

  async function readFileRaw(filePath: string): Promise<string> {
    return readFile(filePath, 'utf8');
  }

  return { appendLedgerEntry, readLedger, readTrackPlan, writeTrackPlan, readTrackFile, writeTrackFile, createTrackDir, listTracks, readFileRaw };
}
