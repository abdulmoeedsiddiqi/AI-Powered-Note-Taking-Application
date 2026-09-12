import path from 'path';

import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';

import { ApiError } from '../../utils/ApiError';

export const IMPORTABLE_FILE_EXTENSIONS = ['.txt', '.pdf', '.docx'] as const;

export async function extractTextFromFile(buffer: Buffer, originalname: string): Promise<string> {
  const ext = path.extname(originalname).toLowerCase();

  if (ext === '.txt') {
    return buffer.toString('utf-8');
  }

  if (ext === '.pdf') {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return result.text;
    } finally {
      await parser.destroy();
    }
  }

  if (ext === '.docx') {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  throw ApiError.badRequest('File must be a .txt, .pdf, or .docx file');
}

export function titleFromFilename(originalname: string): string {
  const withoutExt = originalname.replace(/\.[^./]+$/, '').trim();
  return withoutExt || 'Imported note';
}

type TiptapNode = { type: string; content?: TiptapNode[]; text?: string };

/**
 * Turn extracted plain text into a Tiptap/ProseMirror document so that the
 * document's paragraph breaks survive as real paragraphs in the note, instead
 * of collapsing into a single run-on block when rendered. Each non-empty line
 * (mammoth/pdf give one line per source paragraph) becomes its own paragraph.
 */
export function textToDocContent(text: string): TiptapNode {
  const paragraphs: TiptapNode[] = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => ({ type: 'paragraph', content: [{ type: 'text', text: line }] }));

  return {
    type: 'doc',
    content: paragraphs.length > 0 ? paragraphs : [{ type: 'paragraph' }],
  };
}
