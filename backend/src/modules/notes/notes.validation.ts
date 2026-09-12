import { z } from 'zod';

import { EXPORT_FORMATS } from './notes-export-formats';

export const NOTE_COLORS = ['white', 'yellow', 'blue', 'green', 'purple', 'pink', 'orange', 'red'] as const;
const NOTE_TYPES = ['TEXT', 'VIDEO', 'MIXED'] as const;

export const createNoteSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  content: z.unknown().optional(),
  type: z.enum(NOTE_TYPES).optional(),
  color: z.enum(NOTE_COLORS).optional(),
});

export const updateNoteSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200).optional(),
  content: z.unknown().optional(),
  type: z.enum(NOTE_TYPES).optional(),
  color: z.enum(NOTE_COLORS).optional(),
  pinned: z.boolean().optional(),
});

export const importNoteSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  content: z.unknown().optional(),
  type: z.enum(NOTE_TYPES).optional(),
  color: z.enum(NOTE_COLORS).optional(),
  pinned: z.boolean().optional(),
});

export const importNotesSchema = z.object({
  notes: z
    .array(importNoteSchema)
    .min(1, 'At least one note is required')
    .max(500, 'Cannot import more than 500 notes at once'),
});

export const exportNotesQuerySchema = z.object({
  format: z.enum(EXPORT_FORMATS).optional().default('json'),
});

export const listNotesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).optional().default(8),
  filter: z.enum(['all', 'pinned', 'video']).optional().default('all'),
  q: z.string().trim().min(1).max(200).optional(),
});
