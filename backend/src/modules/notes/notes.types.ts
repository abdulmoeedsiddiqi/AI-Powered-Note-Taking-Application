import type { Note, NoteAsset, NoteType } from '@prisma/client';

export type NoteWithAssets = Note & { assets: NoteAsset[] };

export interface CreateNoteInput {
  title: string;
  content?: unknown;
  type?: NoteType;
  color?: string;
}

export interface UpdateNoteInput {
  title?: string;
  content?: unknown;
  type?: NoteType;
  color?: string;
  pinned?: boolean;
}

export interface NoteCounts {
  all: number;
  pinned: number;
  video: number;
  trash: number;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ExportedNote {
  title: string;
  content: unknown;
  type: NoteType;
  color: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotesExport {
  exportedAt: string;
  notes: ExportedNote[];
}

export interface ImportNoteInput {
  title: string;
  content?: unknown;
  type?: NoteType;
  color?: string;
  pinned?: boolean;
}
