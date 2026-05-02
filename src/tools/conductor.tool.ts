/**
 * Conductor tools — exposes the Project Tracks methodology via MCP.
 *
 * Available tools:
 * - list_tracks         — enumerate all live tracks (directories with plan.md)
 * - get_track_plan      — read plan.md for a track
 * - update_track_plan   — overwrite plan.md
 * - get_track_spec      — read spec.md for a track
 * - update_track_spec   — overwrite spec.md
 * - get_track_index     — read index.md for a track
 * - update_track_index  — overwrite index.md
 * - create_track        — scaffold a new track directory
 *
 * See ConductorManager for full methodology documentation.
 */

import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ConductorManager } from '../managers/ConductorManager.js';

export const ListTracksSchema = z.object({});

export const GetTrackPlanSchema = z.object({
  trackName: z.string().min(1),
});

export const UpdateTrackPlanSchema = z.object({
  trackName: z.string().min(1),
  content: z.string().min(1),
});

export const UpdateTrackSpecSchema = z.object({
  trackName: z.string().min(1),
  content: z.string().min(1),
});

export const GetTrackSpecSchema = z.object({
  trackName: z.string().min(1),
});

export const UpdateTrackIndexSchema = z.object({
  trackName: z.string().min(1),
  content: z.string().min(1),
});

export const GetTrackIndexSchema = z.object({
  trackName: z.string().min(1),
});

export const CreateTrackSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  type: z.string().optional(),
  owner: z.string().optional(),
});

export function registerConductorTools(server: McpServer, manager: ConductorManager): void {
  server.tool('list_tracks', 'List all live conductor tracks (only tracks with a plan.md are returned). Use to understand current work in progress.', ListTracksSchema.shape, async () => {
    const tracks = await manager.listTracks();
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(tracks, null, 2) }],
    };
  });

  server.tool('get_track_plan', 'Read the plan.md for a specific conductor track. Returns live file content — not docs, not memory.', GetTrackPlanSchema.shape, async (args) => {
    const plan = await manager.getTrackPlan(args.trackName);
    return {
      content: [{ type: 'text' as const, text: plan.content }],
    };
  });

  server.tool(
    'get_track_spec',
    'Read the spec.md for a specific conductor track. Returns the live technical specification.',
    GetTrackSpecSchema.shape,
    async (args) => {
      const file = await manager.getTrackSpec(args.trackName);
      return {
        content: [{ type: 'text' as const, text: file.content }],
      };
    },
  );

  server.tool(
    'update_track_spec',
    'Overwrite spec.md for an existing conductor track. Use to update technical decisions, architecture notes, or acceptance criteria.',
    UpdateTrackSpecSchema.shape,
    async (args) => {
      const result = await manager.updateTrackSpec(args.trackName, args.content);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.tool(
    'get_track_index',
    'Read the index.md for a specific conductor track. Returns the live track overview and summary.',
    GetTrackIndexSchema.shape,
    async (args) => {
      const file = await manager.getTrackIndex(args.trackName);
      return {
        content: [{ type: 'text' as const, text: file.content }],
      };
    },
  );

  server.tool(
    'update_track_index',
    'Overwrite index.md for an existing conductor track. Use to update the track summary, status, or linked resources.',
    UpdateTrackIndexSchema.shape,
    async (args) => {
      const result = await manager.updateTrackIndex(args.trackName, args.content);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.tool(
    'update_track_plan',
    'Overwrite the plan.md for an existing conductor track with new content. The track must already exist. Use this to update task status, add phases, or record decisions.',
    UpdateTrackPlanSchema.shape,
    async (args) => {
      const result = await manager.updateTrackPlan(args.trackName, args.content);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.tool(
    'create_track',
    'Create a new conductor track directory with plan.md, index.md, and metadata.json. Fails if the slug already exists.',
    CreateTrackSchema.shape,
    async (args) => {
      const result = await manager.createTrack(args.slug, args.title, args.type, args.owner);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}
