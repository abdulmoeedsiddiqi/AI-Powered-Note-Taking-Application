import type { NoteType, Prisma } from '@prisma/client';

import { prisma } from '../../lib/prisma';

export type NoteListFilter = 'all' | 'pinned' | 'video';

interface ListOptions {
  userId: string;
  page: number;
  pageSize: number;
  filter?: NoteListFilter;
  q?: string;
}

interface CreateNoteData {
  title: string;
  content?: unknown;
  type: NoteType;
  color: string;
  wordCount: number;
}

interface ImportNoteRow {
  title: string;
  content?: unknown;
  type: NoteType;
  color: string;
  pinned: boolean;
  wordCount: number;
}

interface UpdateNoteData {
  title?: string;
  content?: unknown;
  type?: NoteType;
  color?: string;
  pinned?: boolean;
  wordCount?: number;
}

function filterWhere(filter?: NoteListFilter): Prisma.NoteWhereInput {
  if (filter === 'pinned') return { pinned: true };
  if (filter === 'video') return { type: { in: ['VIDEO', 'MIXED'] } };
  return {};
}

function searchWhere(q?: string): Prisma.NoteWhereInput {
  const trimmed = q?.trim();
  return trimmed ? { title: { contains: trimmed, mode: 'insensitive' } } : {};
}

function listWhere(userId: string, filter?: NoteListFilter, q?: string): Prisma.NoteWhereInput {
  return { userId, deletedAt: null, ...filterWhere(filter), ...searchWhere(q) };
}

export function findManyForUser({ userId, page, pageSize, filter, q }: ListOptions) {
  return prisma.note.findMany({
    where: listWhere(userId, filter, q),
    orderBy: { updatedAt: 'desc' },
    skip: (page - 1) * pageSize,
    take: pageSize,
    include: { assets: true },
  });
}

export function countMatchingForUser(userId: string, filter?: NoteListFilter, q?: string) {
  return prisma.note.count({ where: listWhere(userId, filter, q) });
}

export function countForUser(userId: string) {
  return prisma.note.count({ where: { userId, deletedAt: null } });
}

export function countPinnedForUser(userId: string) {
  return prisma.note.count({ where: { userId, deletedAt: null, pinned: true } });
}

export function countVideoForUser(userId: string) {
  return prisma.note.count({
    where: { userId, deletedAt: null, type: { in: ['VIDEO', 'MIXED'] } },
  });
}

export function countTrashForUser(userId: string) {
  return prisma.note.count({ where: { userId, deletedAt: { not: null } } });
}

export function findAllForExport(userId: string) {
  return prisma.note.findMany({
    where: { userId, deletedAt: null },
    orderBy: { createdAt: 'asc' },
    select: {
      title: true,
      content: true,
      type: true,
      color: true,
      pinned: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export function findOneForUser(id: string, userId: string) {
  return prisma.note.findFirst({ where: { id, userId, deletedAt: null }, include: { assets: true } });
}

export function findManyTrashForUser({ userId, page, pageSize }: ListOptions) {
  return prisma.note.findMany({
    where: { userId, deletedAt: { not: null } },
    orderBy: { deletedAt: 'desc' },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
}

export function findOneTrashedForUser(id: string, userId: string) {
  return prisma.note.findFirst({ where: { id, userId, deletedAt: { not: null } } });
}

export function create(userId: string, data: CreateNoteData) {
  return prisma.note.create({
    data: {
      userId,
      title: data.title,
      type: data.type,
      color: data.color,
      wordCount: data.wordCount,
      ...(data.content !== undefined ? { content: data.content as Prisma.InputJsonValue } : {}),
    },
  });
}

export async function createManyForUser(userId: string, notes: ImportNoteRow[]): Promise<number> {
  const result = await prisma.note.createMany({
    data: notes.map((note) => ({
      userId,
      title: note.title,
      type: note.type,
      color: note.color,
      pinned: note.pinned,
      wordCount: note.wordCount,
      ...(note.content !== undefined ? { content: note.content as Prisma.InputJsonValue } : {}),
    })),
  });
  return result.count;
}

export function update(id: string, data: UpdateNoteData) {
  const { content, ...rest } = data;
  return prisma.note.update({
    where: { id },
    data: {
      ...rest,
      ...(content !== undefined ? { content: content as Prisma.InputJsonValue } : {}),
    },
  });
}

export function updateSummary(id: string, summary: string) {
  return prisma.note.update({ where: { id }, data: { summary, summaryUpdatedAt: new Date() } });
}

export function softDelete(id: string) {
  return prisma.note.update({ where: { id }, data: { deletedAt: new Date() } });
}

export function restore(id: string) {
  return prisma.note.update({ where: { id }, data: { deletedAt: null } });
}

export function purge(id: string) {
  return prisma.note.delete({ where: { id } });
}
