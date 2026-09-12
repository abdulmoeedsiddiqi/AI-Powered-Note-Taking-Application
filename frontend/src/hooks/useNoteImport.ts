import { useCallback, useState } from 'react';

import type { ImportNoteInput } from '../api/notes.api';
import { fileTextToNoteContent } from '../lib/importContent';
import { useCreateNote, useImportNoteFile, useImportNotes } from './useNotes';

const SUPPORTED_EXTENSIONS = ['.json', '.txt', '.text', '.md', '.markdown', '.csv', '.log', '.pdf', '.docx'];
const TEXT_EXTENSIONS = ['.txt', '.text', '.md', '.markdown', '.csv', '.log'];
const MAX_TITLE_LENGTH = 80;

export function isSupportedImportFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return SUPPORTED_EXTENSIONS.some((ext) => name.endsWith(ext));
}

// A file whose text we can read directly in the browser (as opposed to a PDF or
// Word document, which the server has to parse).
function isPlainTextFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return file.type.startsWith('text/') || TEXT_EXTENSIONS.some((ext) => name.endsWith(ext));
}

const MARKDOWN_FILE_EXTENSIONS = ['.md', '.markdown'];

// Strip leading block markers (#, >, -, 1.) and inline emphasis/code markers so
// a markdown heading like "# Project Plan" yields the title "Project Plan".
function stripMarkdownSyntax(line: string): string {
  return line
    .replace(/^#{1,6}\s+/, '')
    .replace(/^>\s+/, '')
    .replace(/^[-*+]\s+/, '')
    .replace(/^\d+\.\s+/, '')
    .replace(/(\*\*|__|\*|_|~~|`)/g, '')
    .trim();
}

// Build a note title from the file's text: the first non-empty line, trimmed to
// a reasonable length, falling back to the file name.
function deriveTitle(text: string, fileName: string): string {
  const isMarkdown = MARKDOWN_FILE_EXTENSIONS.some((ext) => fileName.toLowerCase().endsWith(ext));
  const rawFirstLine = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  const fallback = fileName.replace(/\.[^./\\]+$/, '').trim() || 'Untitled note';
  const firstLine = rawFirstLine && isMarkdown ? stripMarkdownSyntax(rawFirstLine) : rawFirstLine;
  if (!firstLine) {
    return fallback;
  }
  return firstLine.length > MAX_TITLE_LENGTH
    ? `${firstLine.slice(0, MAX_TITLE_LENGTH).trimEnd()}…`
    : firstLine;
}

/**
 * Shared note-import logic used by both the sidebar "Import notes" button and
 * the drag-and-drop drop zone. A `.json` file is treated as a notes export
 * (bulk import); any other supported file (`.txt`/`.pdf`/`.docx`) becomes a
 * single note via the file-upload endpoint.
 */
export function useNoteImport() {
  const importNotes = useImportNotes();
  const importNoteFile = useImportNoteFile();
  const createNote = useCreateNote();
  const [status, setStatus] = useState<string | null>(null);

  // Imports one file; returns how many notes it created (0 on failure).
  const importFile = useCallback(
    async (file: File): Promise<number> => {
      const isJson = file.name.toLowerCase().endsWith('.json') || file.type === 'application/json';

      // A JSON file is treated as a notes export (bulk import).
      if (isJson) {
        try {
          const text = await file.text();
          const parsed = JSON.parse(text) as { notes?: ImportNoteInput[] };
          if (!Array.isArray(parsed.notes) || parsed.notes.length === 0) {
            setStatus('That file has no notes to import.');
            return 0;
          }

          const result = await importNotes.mutateAsync(parsed.notes);
          setStatus(`Imported ${result.imported} note${result.imported === 1 ? '' : 's'}.`);
          return result.imported;
        } catch {
          setStatus("Couldn't import that file. Make sure it's a notes export.");
          return 0;
        }
      }

      // A plain-text or markdown file: read it in the browser and turn its text
      // into a note, preserving line breaks and markdown formatting (headings,
      // bold/italic, lists, …), titled from the file's first line.
      if (isPlainTextFile(file)) {
        try {
          const text = await file.text();
          const title = deriveTitle(text, file.name);
          const content = fileTextToNoteContent(text, file.name);
          await createNote.mutateAsync({ title, content });
          setStatus(`Created note "${title}".`);
          return 1;
        } catch {
          setStatus("Couldn't read that text file.");
          return 0;
        }
      }

      // A PDF or Word document: the server extracts the text.
      try {
        const result = await importNoteFile.mutateAsync(file);
        setStatus(`Imported "${result.note.title}".`);
        return 1;
      } catch {
        setStatus("Couldn't import that file. Use a .txt, .md, .pdf, or .docx file.");
        return 0;
      }
    },
    [createNote, importNoteFile, importNotes],
  );

  // Imports several dropped files, aggregating a single summary status.
  const importFiles = useCallback(
    async (files: File[]): Promise<void> => {
      const supported = files.filter(isSupportedImportFile);

      if (supported.length === 0) {
        setStatus('Unsupported file. Drop a .json, .txt, .pdf, or .docx file.');
        return;
      }

      if (supported.length === 1) {
        await importFile(supported[0]);
        return;
      }

      let importedNotes = 0;
      let failedFiles = 0;
      for (const file of supported) {
        const created = await importFile(file);
        if (created > 0) {
          importedNotes += created;
        } else {
          failedFiles += 1;
        }
      }

      const noteLabel = `${importedNotes} note${importedNotes === 1 ? '' : 's'}`;
      setStatus(
        failedFiles > 0
          ? `Imported ${noteLabel} (${failedFiles} file${failedFiles === 1 ? '' : 's'} failed).`
          : `Imported ${noteLabel} from ${supported.length} files.`,
      );
    },
    [importFile],
  );

  const isImporting = importNotes.isPending || importNoteFile.isPending || createNote.isPending;

  return { importFile, importFiles, status, setStatus, isImporting };
}
