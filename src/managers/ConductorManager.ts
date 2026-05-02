import { createFileSystemAccess, FileSystemAccess, TrackFile, TrackPlan } from '../access/FileSystemAccess.js';

/**
 * ConductorManager — Project Tracks feature.
 *
 * Conductor is a lightweight, file-based project management methodology.
 * Each "track" is a directory under your configured tracks directory
 * (default: `conductor/tracks/` inside your repo) and contains up to four
 * markdown/JSON files:
 *
 * - **plan.md** — living task list; this is the status source of truth.
 * - **spec.md** — technical specification, architecture notes, acceptance criteria.
 * - **index.md** — short human-readable overview and linked resources.
 * - **metadata.json** — machine-readable track metadata (id, title, type, status, owner, dates).
 *
 * Only directories that contain a `plan.md` are treated as live tracks.
 *
 * To use this feature:
 * 1. Set `MCP_TRACKS_DIR` to the path of your tracks directory, or create
 *    `conductor/tracks/` at the root of your repo.
 * 2. Use `create_track` to scaffold a new track, or add the directory manually.
 * 3. Use `list_tracks`, `get_track_plan`, etc. from within your MCP client to
 *    read and update track state.
 *
 * Files are always read/written live — they are never routed through MemPalace,
 * so there is no staleness risk.
 */

// Conductor tracks are read/written directly on disk — NOT via MemPalace.
// Docs can be stale. We always read and write live files.

// Slug must be lowercase alphanumeric + hyphens/underscores, no path chars.
const SAFE_SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,99}$/i;

function assertSafeSlug(slug: string): void {
  if (!SAFE_SLUG_RE.test(slug)) {
    throw new Error(`Invalid track slug "${slug}". Must match [a-zA-Z0-9][a-zA-Z0-9_-]* (max 100 chars).`);
  }
}

export interface TrackSummary {
  name: string;
  hasPlan: boolean;
}

export interface UpdateTrackPlanResult {
  trackName: string;
  updated: true;
  length: number;
}

export interface UpdateTrackFileResult {
  trackName: string;
  filename: string;
  updated: true;
  length: number;
}

export interface CreateTrackResult {
  slug: string;
  created: true;
  files: string[];
}

export interface ConductorManager {
  listTracks(): Promise<TrackSummary[]>;
  getTrackPlan(trackName: string): Promise<TrackPlan>;
  updateTrackPlan(trackName: string, content: string): Promise<UpdateTrackPlanResult>;
  getTrackSpec(trackName: string): Promise<TrackFile>;
  updateTrackSpec(trackName: string, content: string): Promise<UpdateTrackFileResult>;
  getTrackIndex(trackName: string): Promise<TrackFile>;
  updateTrackIndex(trackName: string, content: string): Promise<UpdateTrackFileResult>;
  createTrack(slug: string, title: string, type?: string, owner?: string): Promise<CreateTrackResult>;
}

export function createConductorManager(tracksDir: string): ConductorManager {
  const fs: FileSystemAccess = createFileSystemAccess();

  async function listTracks(): Promise<TrackSummary[]> {
    const names = await fs.listTracks(tracksDir);
    return names.map((name) => ({ name, hasPlan: true }));
  }

  async function getTrackPlan(trackName: string): Promise<TrackPlan> {
    assertSafeSlug(trackName);
    return fs.readTrackPlan(tracksDir, trackName);
  }

  async function updateTrackPlan(trackName: string, content: string): Promise<UpdateTrackPlanResult> {
    assertSafeSlug(trackName);
    await fs.writeTrackPlan(tracksDir, trackName, content);
    return { trackName, updated: true, length: content.length };
  }

  async function getTrackSpec(trackName: string): Promise<TrackFile> {
    assertSafeSlug(trackName);
    return fs.readTrackFile(tracksDir, trackName, 'spec.md');
  }

  async function updateTrackSpec(trackName: string, content: string): Promise<UpdateTrackFileResult> {
    assertSafeSlug(trackName);
    await fs.writeTrackFile(tracksDir, trackName, 'spec.md', content);
    return { trackName, filename: 'spec.md', updated: true, length: content.length };
  }

  async function getTrackIndex(trackName: string): Promise<TrackFile> {
    assertSafeSlug(trackName);
    return fs.readTrackFile(tracksDir, trackName, 'index.md');
  }

  async function updateTrackIndex(trackName: string, content: string): Promise<UpdateTrackFileResult> {
    assertSafeSlug(trackName);
    await fs.writeTrackFile(tracksDir, trackName, 'index.md', content);
    return { trackName, filename: 'index.md', updated: true, length: content.length };
  }

  async function createTrack(
    slug: string,
    title: string,
    type: string = 'feature',
    owner: string = 'platform-team',
  ): Promise<CreateTrackResult> {
    assertSafeSlug(slug);
    const today = new Date().toISOString().slice(0, 10);

    const plan = `# Plan — ${slug}\n\n**Status:** 🟡 In Progress\n**Phase:** Initial\n\n## Phases\n\n### Phase 1 — ${title}\n- [ ] TODO\n`;
    const index = `# ${title}\n\n**Status:** In Progress\n**Track Type:** ${type}\n\n## Summary\n\n${title}\n`;
    const metadata = JSON.stringify(
      {
        id: slug,
        title,
        type,
        status: 'active',
        owner,
        created: today,
        completed: '',
        template: '',
        governanceArtifact: '',
        dependencies: [],
      },
      null,
      2,
    ) + '\n';

    const files = { 'plan.md': plan, 'index.md': index, 'metadata.json': metadata };
    await fs.createTrackDir(tracksDir, slug, files);
    return { slug, created: true, files: Object.keys(files) };
  }

  return { listTracks, getTrackPlan, updateTrackPlan, getTrackSpec, updateTrackSpec, getTrackIndex, updateTrackIndex, createTrack };
}
