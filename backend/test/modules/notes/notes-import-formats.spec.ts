import { expect } from 'chai';

import { toDocxBuffer, toPdfBuffer } from '../../../src/modules/notes/notes-export-formats';
import { extractTextFromFile, titleFromFilename } from '../../../src/modules/notes/notes-import-formats';
import type { ExportedNote } from '../../../src/modules/notes/notes.types';

function makeExportedNote(title: string, content: string): ExportedNote {
  return {
    title,
    content,
    type: 'TEXT',
    color: 'yellow',
    pinned: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe('notes-import-formats', () => {
  describe('extractTextFromFile', () => {
    it('reads a .txt file as-is', async () => {
      const text = await extractTextFromFile(Buffer.from('Hello from txt', 'utf-8'), 'my-note.txt');
      expect(text).to.equal('Hello from txt');
    });

    it('extracts text from a .pdf file', async function () {
      this.timeout(10000);
      const pdfBuffer = await toPdfBuffer([makeExportedNote('PDF Source', 'Some pdf body text')]);

      const text = await extractTextFromFile(pdfBuffer, 'export.pdf');

      expect(text).to.include('PDF Source');
      expect(text).to.include('Some pdf body text');
    });

    it('extracts text from a .docx file', async () => {
      const docxBuffer = await toDocxBuffer([makeExportedNote('Docx Source', 'Some docx body text')]);

      const text = await extractTextFromFile(docxBuffer, 'export.docx');

      expect(text).to.include('Docx Source');
      expect(text).to.include('Some docx body text');
    });

    it('rejects an unsupported file extension', async () => {
      try {
        await extractTextFromFile(Buffer.from('data'), 'file.exe');
        expect.fail('expected extractTextFromFile to throw');
      } catch (err) {
        expect((err as { statusCode: number }).statusCode).to.equal(400);
      }
    });
  });

  describe('titleFromFilename', () => {
    it('strips the extension', () => {
      expect(titleFromFilename('My Notes.txt')).to.equal('My Notes');
    });

    it('falls back to a default title for an extension-only name', () => {
      expect(titleFromFilename('.txt')).to.equal('Imported note');
    });
  });
});
