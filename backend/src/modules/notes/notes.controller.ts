import { Request, Response } from 'express';

import { ApiError } from '../../utils/ApiError';
import { asyncHandler } from '../../utils/asyncHandler';
import { toAssetResponse } from './notes-assets.controller';
import { toDocxBuffer, toPdfBuffer, toPlainText } from './notes-export-formats';
import { extractTextFromFile, textToDocContent, titleFromFilename } from './notes-import-formats';
import * as notesService from './notes.service';
import {
  createNoteSchema,
  exportNotesQuerySchema,
  importNotesSchema,
  listNotesQuerySchema,
  updateNoteSchema,
} from './notes.validation';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const parsed = listNotesQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw ApiError.badRequest('Invalid query parameters', parsed.error.flatten().fieldErrors);
  }

  const result = await notesService.listNotes(req.user!.id, {
    page: parsed.data.page,
    pageSize: parsed.data.pageSize,
    filter: parsed.data.filter,
    q: parsed.data.q,
  });
  res.status(200).json({
    ...result,
    notes: result.notes.map((note) => ({ ...note, assets: note.assets.map(toAssetResponse) })),
  });
});

export const exportNotes = asyncHandler(async (req: Request, res: Response) => {
  const parsedQuery = exportNotesQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    throw ApiError.badRequest('Invalid export format', parsedQuery.error.flatten().fieldErrors);
  }

  const result = await notesService.exportNotes(req.user!.id);
  const dateStamp = new Date().toISOString().slice(0, 10);
  const { format } = parsedQuery.data;

  if (format === 'txt') {
    res.setHeader('Content-Disposition', `attachment; filename="notes-export-${dateStamp}.txt"`);
    res.status(200).type('text/plain').send(toPlainText(result.notes));
    return;
  }

  if (format === 'pdf') {
    const pdf = await toPdfBuffer(result.notes);
    res.setHeader('Content-Disposition', `attachment; filename="notes-export-${dateStamp}.pdf"`);
    res.status(200).type('application/pdf').send(pdf);
    return;
  }

  if (format === 'docx') {
    const docx = await toDocxBuffer(result.notes);
    res.setHeader('Content-Disposition', `attachment; filename="notes-export-${dateStamp}.docx"`);
    res.status(200).type(DOCX_MIME).send(docx);
    return;
  }

  res.setHeader('Content-Disposition', `attachment; filename="notes-export-${dateStamp}.json"`);
  res.status(200).json(result);
});

export const importNotes = asyncHandler(async (req: Request, res: Response) => {
  const parsed = importNotesSchema.safeParse(req.body);
  if (!parsed.success) {
    throw ApiError.badRequest('Invalid import file', parsed.error.flatten().fieldErrors);
  }

  const result = await notesService.importNotes(req.user!.id, parsed.data.notes);
  res.status(201).json(result);
});

export const importFile = asyncHandler(async (req: Request, res: Response) => {
  const file = req.file as Express.Multer.File | undefined;
  if (!file) {
    throw ApiError.badRequest('No file provided');
  }

  const text = await extractTextFromFile(file.buffer, file.originalname);
  if (!text.trim()) {
    throw ApiError.badRequest('The uploaded file has no readable text');
  }

  const note = await notesService.createNote(req.user!.id, {
    title: titleFromFilename(file.originalname),
    content: textToDocContent(text),
  });

  res.status(201).json({ note, imported: 1 });
});

export const create = asyncHandler(async (req: Request, res: Response) => {
  const parsed = createNoteSchema.safeParse(req.body);
  if (!parsed.success) {
    throw ApiError.badRequest('Invalid note details', parsed.error.flatten().fieldErrors);
  }

  const note = await notesService.createNote(req.user!.id, parsed.data);
  res.status(201).json({ note });
});

export const getOne = asyncHandler(async (req: Request, res: Response) => {
  const note = await notesService.getNote(req.user!.id, req.params.id);
  res.status(200).json({ note: { ...note, assets: note.assets.map(toAssetResponse) } });
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const parsed = updateNoteSchema.safeParse(req.body);
  if (!parsed.success) {
    throw ApiError.badRequest('Invalid note details', parsed.error.flatten().fieldErrors);
  }

  const note = await notesService.updateNote(req.user!.id, req.params.id, parsed.data);
  res.status(200).json({ note });
});

export const summarize = asyncHandler(async (req: Request, res: Response) => {
  const note = await notesService.summarizeNote(
    req.user!.id,
    req.params.id,
    undefined,
    undefined,
    req.body?.content,
  );
  res.status(200).json({ note });
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  await notesService.softDeleteNote(req.user!.id, req.params.id);
  res.status(204).send();
});

export const listTrash = asyncHandler(async (req: Request, res: Response) => {
  const parsed = listNotesQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw ApiError.badRequest('Invalid query parameters', parsed.error.flatten().fieldErrors);
  }

  const result = await notesService.listTrash(req.user!.id, parsed.data.page, parsed.data.pageSize);
  res.status(200).json(result);
});

export const restore = asyncHandler(async (req: Request, res: Response) => {
  const note = await notesService.restoreNote(req.user!.id, req.params.id);
  res.status(200).json({ note });
});

export const purge = asyncHandler(async (req: Request, res: Response) => {
  await notesService.purgeNote(req.user!.id, req.params.id);
  res.status(204).send();
});
