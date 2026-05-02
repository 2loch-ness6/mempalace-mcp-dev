/**
 * Unit tests for ConductorManager.
 *
 * All FileSystemAccess calls are mocked via jest.unstable_mockModule.
 */

import { jest } from '@jest/globals';

// ── module mocks ──────────────────────────────────────────────────────────────
const mockFs = {
  listTracks: jest.fn<() => Promise<string[]>>(),
  readTrackPlan: jest.fn(),
  writeTrackPlan: jest.fn<() => Promise<void>>(),
  readTrackFile: jest.fn(),
  writeTrackFile: jest.fn<() => Promise<void>>(),
  createTrackDir: jest.fn<() => Promise<void>>(),
  appendLedgerEntry: jest.fn(),
  readLedger: jest.fn(),
  readFileRaw: jest.fn(),
};

jest.unstable_mockModule('../access/FileSystemAccess.js', () => ({
  createFileSystemAccess: jest.fn(() => mockFs),
}));

// ── dynamic imports ───────────────────────────────────────────────────────────
const { createConductorManager } = await import('./ConductorManager.js');

const TRACKS_DIR = '/fake/conductor/tracks';

// ── tests ─────────────────────────────────────────────────────────────────────
describe('ConductorManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── listTracks ──────────────────────────────────────────────────────────────
  describe('listTracks', () => {
    it('returns a TrackSummary array with hasPlan:true for each directory', async () => {
      mockFs.listTracks.mockResolvedValue(['track-a', 'track-b']);
      const mgr = createConductorManager(TRACKS_DIR);
      const result = await mgr.listTracks();
      expect(result).toEqual([
        { name: 'track-a', hasPlan: true },
        { name: 'track-b', hasPlan: true },
      ]);
      expect(mockFs.listTracks).toHaveBeenCalledWith(TRACKS_DIR);
    });

    it('returns an empty array when no tracks exist', async () => {
      mockFs.listTracks.mockResolvedValue([]);
      const mgr = createConductorManager(TRACKS_DIR);
      expect(await mgr.listTracks()).toEqual([]);
    });
  });

  // ── getTrackPlan ────────────────────────────────────────────────────────────
  describe('getTrackPlan', () => {
    it('returns the plan from FileSystemAccess', async () => {
      const fakePlan = { trackName: 'my-track', content: '# Plan' };
      mockFs.readTrackPlan.mockResolvedValue(fakePlan);
      const mgr = createConductorManager(TRACKS_DIR);
      const result = await mgr.getTrackPlan('my-track');
      expect(result).toEqual(fakePlan);
      expect(mockFs.readTrackPlan).toHaveBeenCalledWith(TRACKS_DIR, 'my-track');
    });

    it('rejects on invalid slug (path traversal attempt)', async () => {
      const mgr = createConductorManager(TRACKS_DIR);
      await expect(mgr.getTrackPlan('../etc/passwd')).rejects.toThrow('Invalid track slug');
    });
  });

  // ── updateTrackPlan ─────────────────────────────────────────────────────────
  describe('updateTrackPlan', () => {
    it('writes content and returns update metadata', async () => {
      mockFs.writeTrackPlan.mockResolvedValue(undefined);
      const mgr = createConductorManager(TRACKS_DIR);
      const content = '# Updated Plan\n\n- [x] Done\n';
      const result = await mgr.updateTrackPlan('my-track', content);

      expect(mockFs.writeTrackPlan).toHaveBeenCalledWith(TRACKS_DIR, 'my-track', content);
      expect(result).toEqual({ trackName: 'my-track', updated: true, length: content.length });
    });

    it('rejects on invalid slug', async () => {
      const mgr = createConductorManager(TRACKS_DIR);
      await expect(mgr.updateTrackPlan('../../evil', '# x')).rejects.toThrow('Invalid track slug');
      expect(mockFs.writeTrackPlan).not.toHaveBeenCalled();
    });
  });

  // ── createTrack ─────────────────────────────────────────────────────────────
  describe('createTrack', () => {
    it('creates track with default type and owner', async () => {
      mockFs.createTrackDir.mockResolvedValue(undefined);
      const mgr = createConductorManager(TRACKS_DIR);
      const result = await mgr.createTrack('new-feature', 'New Feature');

      expect(mockFs.createTrackDir).toHaveBeenCalledTimes(1);
      const [calledDir, calledSlug, calledFiles] = (mockFs.createTrackDir.mock.calls[0] as unknown[]) as [string, string, Record<string, string>];
      expect(calledDir).toBe(TRACKS_DIR);
      expect(calledSlug).toBe('new-feature');
      expect(Object.keys(calledFiles).sort()).toEqual(['index.md', 'metadata.json', 'plan.md']);
      expect(calledFiles['plan.md']).toContain('new-feature');
      expect(calledFiles['metadata.json']).toContain('"type": "feature"');
      expect(calledFiles['metadata.json']).toContain('"owner": "platform-team"');
      expect(result).toEqual({ slug: 'new-feature', created: true, files: expect.arrayContaining(['plan.md', 'index.md', 'metadata.json']) });
    });

    it('respects custom type and owner', async () => {
      mockFs.createTrackDir.mockResolvedValue(undefined);
      const mgr = createConductorManager(TRACKS_DIR);
      await mgr.createTrack('ops-task', 'Ops Task', 'ops', 'ops-team');

      const [, , files] = (mockFs.createTrackDir.mock.calls[0] as unknown[]) as [string, string, Record<string, string>];
      expect(files['metadata.json']).toContain('"type": "ops"');
      expect(files['metadata.json']).toContain('"owner": "ops-team"');
    });

    it('rejects on invalid slug', async () => {
      const mgr = createConductorManager(TRACKS_DIR);
      await expect(mgr.createTrack('/absolute/path', 'Bad')).rejects.toThrow('Invalid track slug');
      expect(mockFs.createTrackDir).not.toHaveBeenCalled();
    });

    it('propagates errors from FileSystemAccess (e.g. directory already exists)', async () => {
      mockFs.createTrackDir.mockRejectedValue(new Error('EEXIST: file already exists'));
      const mgr = createConductorManager(TRACKS_DIR);
      await expect(mgr.createTrack('existing', 'Existing')).rejects.toThrow('EEXIST');
    });
  });

  // ── getTrackSpec ────────────────────────────────────────────────────────────
  describe('getTrackSpec', () => {
    it('returns spec.md content', async () => {
      const fakeFile = { trackName: 'my-track', filename: 'spec.md', content: '# Spec' };
      mockFs.readTrackFile.mockResolvedValue(fakeFile);
      const mgr = createConductorManager(TRACKS_DIR);
      const result = await mgr.getTrackSpec('my-track');
      expect(result).toEqual(fakeFile);
      expect(mockFs.readTrackFile).toHaveBeenCalledWith(TRACKS_DIR, 'my-track', 'spec.md');
    });

    it('rejects on invalid slug', async () => {
      const mgr = createConductorManager(TRACKS_DIR);
      await expect(mgr.getTrackSpec('../bad')).rejects.toThrow('Invalid track slug');
      expect(mockFs.readTrackFile).not.toHaveBeenCalled();
    });
  });

  // ── updateTrackSpec ─────────────────────────────────────────────────────────
  describe('updateTrackSpec', () => {
    it('writes spec.md and returns update metadata', async () => {
      mockFs.writeTrackFile.mockResolvedValue(undefined);
      const mgr = createConductorManager(TRACKS_DIR);
      const content = '# Technical Spec\n\n- Requirement A\n';
      const result = await mgr.updateTrackSpec('my-track', content);
      expect(mockFs.writeTrackFile).toHaveBeenCalledWith(TRACKS_DIR, 'my-track', 'spec.md', content);
      expect(result).toEqual({ trackName: 'my-track', filename: 'spec.md', updated: true, length: content.length });
    });

    it('rejects on invalid slug', async () => {
      const mgr = createConductorManager(TRACKS_DIR);
      await expect(mgr.updateTrackSpec('../../evil', '# x')).rejects.toThrow('Invalid track slug');
      expect(mockFs.writeTrackFile).not.toHaveBeenCalled();
    });
  });

  // ── getTrackIndex ───────────────────────────────────────────────────────────
  describe('getTrackIndex', () => {
    it('returns index.md content', async () => {
      const fakeFile = { trackName: 'my-track', filename: 'index.md', content: '# Index' };
      mockFs.readTrackFile.mockResolvedValue(fakeFile);
      const mgr = createConductorManager(TRACKS_DIR);
      const result = await mgr.getTrackIndex('my-track');
      expect(result).toEqual(fakeFile);
      expect(mockFs.readTrackFile).toHaveBeenCalledWith(TRACKS_DIR, 'my-track', 'index.md');
    });

    it('rejects on invalid slug', async () => {
      const mgr = createConductorManager(TRACKS_DIR);
      await expect(mgr.getTrackIndex('../bad')).rejects.toThrow('Invalid track slug');
      expect(mockFs.readTrackFile).not.toHaveBeenCalled();
    });
  });

  // ── updateTrackIndex ────────────────────────────────────────────────────────
  describe('updateTrackIndex', () => {
    it('writes index.md and returns update metadata', async () => {
      mockFs.writeTrackFile.mockResolvedValue(undefined);
      const mgr = createConductorManager(TRACKS_DIR);
      const content = '# My Track\n\n**Status:** Complete\n';
      const result = await mgr.updateTrackIndex('my-track', content);
      expect(mockFs.writeTrackFile).toHaveBeenCalledWith(TRACKS_DIR, 'my-track', 'index.md', content);
      expect(result).toEqual({ trackName: 'my-track', filename: 'index.md', updated: true, length: content.length });
    });

    it('rejects on invalid slug', async () => {
      const mgr = createConductorManager(TRACKS_DIR);
      await expect(mgr.updateTrackIndex('../../evil', '# x')).rejects.toThrow('Invalid track slug');
      expect(mockFs.writeTrackFile).not.toHaveBeenCalled();
    });
  });
});
