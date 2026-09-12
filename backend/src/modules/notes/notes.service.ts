import type { Note } from '@prisma/client';

import * as aiService from '../ai/ai.service';
import { emitNoteEvent } from '../../socket/notesEvents';
import { ApiError } from '../../utils/ApiError';
import { extractPlainText } from '../../utils/tiptapText';
import { countWords } from '../../utils/wordCount';
import type { NoteListFilter } from './notes.repository';
import * as notesRepository from './notes.repository';
import {
  CreateNoteInput,
  ImportNoteInput,
  NoteCounts,
  NotesExport,
  NoteWithAssets,
  PaginationMeta,
  UpdateNoteInput,
} from './notes.types';

type NotesRepository = typeof notesRepository;

function computeWordCount(content: unknown): number {
  const text = typeof content === 'string' ? content : extractPlainText(content);
  return countWords(text);
}

export async function createNote(
  userId: string,
  input: CreateNoteInput,
  repository: NotesRepository = notesRepository,
): Promise<Note> {
  const note = await repository.create(userId, {
    title: input.title,
    content: input.content,
    type: input.type ?? 'TEXT',
    color: input.color ?? 'yellow',
    wordCount: computeWordCount(input.content),
  });
  emitNoteEvent(userId, 'note:created', note);
  return note;
}

export async function importNotes(
  userId: string,
  notes: ImportNoteInput[],
  repository: NotesRepository = notesRepository,
): Promise<{ imported: number }> {
  const rows = notes.map((note) => ({
    title: note.title,
    content: note.content,
    type: note.type ?? ('TEXT' as const),
    color: note.color ?? 'yellow',
    pinned: note.pinned ?? false,
    wordCount: computeWordCount(note.content),
  }));

  const imported = await repository.createManyForUser(userId, rows);
  emitNoteEvent(userId, 'notes:imported', { count: imported });
  return { imported };
}

export interface ListNotesOptions {
  page: number;
  pageSize: number;
  filter?: NoteListFilter;
  q?: string;
}

export async function listNotes(
  userId: string,
  options: ListNotesOptions,
  repository: NotesRepository = notesRepository,
): Promise<{ notes: NoteWithAssets[]; pagination: PaginationMeta; counts: NoteCounts }> {
  const { page, pageSize, filter = 'all', q } = options;

  const [notes, total, pinned, video, trash, filteredTotal] = await Promise.all([
    repository.findManyForUser({ userId, page, pageSize, filter, q }),
    repository.countForUser(userId),
    repository.countPinnedForUser(userId),
    repository.countVideoForUser(userId),
    repository.countTrashForUser(userId),
    repository.countMatchingForUser(userId, filter, q),
  ]);

  return {
    notes,
    pagination: {
      page,
      pageSize,
      total: filteredTotal,
      totalPages: Math.max(1, Math.ceil(filteredTotal / pageSize)),
    },
    counts: { all: total, pinned, video, trash },
  };
}

export async function exportNotes(
  userId: string,
  repository: NotesRepository = notesRepository,
): Promise<NotesExport> {
  const notes = await repository.findAllForExport(userId);

  return {
    exportedAt: new Date().toISOString(),
    notes: notes.map((note) => ({
      title: note.title,
      content: note.content,
      type: note.type,
      color: note.color,
      pinned: note.pinned,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
    })),
  };
}

export async function getNote(
  userId: string,
  noteId: string,
  repository: NotesRepository = notesRepository,
): Promise<NoteWithAssets> {
  const note = await repository.findOneForUser(noteId, userId);
  if (!note) {
    throw ApiError.notFound('Note not found');
  }
  return note;
}

export async function updateNote(
  userId: string,
  noteId: string,
  input: UpdateNoteInput,
  repository: NotesRepository = notesRepository,
): Promise<Note> {
  const existing = await repository.findOneForUser(noteId, userId);
  if (!existing) {
    throw ApiError.notFound('Note not found');
  }

  const wordCount = input.content !== undefined ? computeWordCount(input.content) : undefined;

  const updated = await repository.update(noteId, {
    title: input.title,
    content: input.content,
    type: input.type,
    color: input.color,
    pinned: input.pinned,
    wordCount,
  });
  emitNoteEvent(userId, 'note:updated', updated);
  return updated;
}

export async function summarizeNote(
  userId: string,
  noteId: string,
  repository: NotesRepository = notesRepository,
  summarizeText: typeof aiService.summarizeText = aiService.summarizeText,
  overrideContent?: unknown,
): Promise<Note> {
  const existing = await repository.findOneForUser(noteId, userId);
  if (!existing) {
    throw ApiError.notFound('Note not found');
  }

  const rawContent = overrideContent !== undefined ? overrideContent : existing.content;
  const summary = await summarizeText(extractPlainText(rawContent));
  if (overrideContent !== undefined) {
    await repository.update(noteId, {
      content: overrideContent,
      wordCount: computeWordCount(overrideContent),
    });
  }
  const updated = await repository.updateSummary(noteId, summary);
  emitNoteEvent(userId, 'note:updated', updated);
  return updated;
}

export async function softDeleteNote(
  userId: string,
  noteId: string,
  repository: NotesRepository = notesRepository,
): Promise<void> {
  const existing = await repository.findOneForUser(noteId, userId);
  if (!existing) {
    throw ApiError.notFound('Note not found');
  }

  await repository.softDelete(noteId);
  emitNoteEvent(userId, 'note:deleted', { id: noteId });
}

export async function listTrash(
  userId: string,
  page: number,
  pageSize: number,
  repository: NotesRepository = notesRepository,
): Promise<{ notes: Note[]; pagination: PaginationMeta }> {
  const [notes, total] = await Promise.all([
    repository.findManyTrashForUser({ userId, page, pageSize }),
    repository.countTrashForUser(userId),
  ]);

  return {
    notes,
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
}

export async function restoreNote(
  userId: string,
  noteId: string,
  repository: NotesRepository = notesRepository,
): Promise<Note> {
  const existing = await repository.findOneTrashedForUser(noteId, userId);
  if (!existing) {
    throw ApiError.notFound('Note not found in trash');
  }

  const restored = await repository.restore(noteId);
  emitNoteEvent(userId, 'note:restored', restored);
  return restored;
}

export async function purgeNote(
  userId: string,
  noteId: string,
  repository: NotesRepository = notesRepository,
): Promise<void> {
  const existing = await repository.findOneTrashedForUser(noteId, userId);
  if (!existing) {
    throw ApiError.notFound('Note not found in trash');
  }

  await repository.purge(noteId);
  emitNoteEvent(userId, 'note:purged', { id: noteId });
}
