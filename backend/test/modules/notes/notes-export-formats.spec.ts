import { expect } from 'chai';
import JSZip from 'jszip';

import { toDocxBuffer, toPdfBuffer, toPlainText } from '../../../src/modules/notes/notes-export-formats';
import type { ExportedNote } from '../../../src/modules/notes/notes.types';

const sampleNotes: ExportedNote[] = [
  {
    title: 'Grocery list',
    content: 'Eggs milk bread',
    type: 'TEXT',
    color: 'yellow',
    pinned: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    title: 'Tiptap note',
    content: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Buy milk' }] }],
    },
    type: 'TEXT',
    color: 'blue',
    pinned: true,
    createdAt: '2026-01-02T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  },
];

const formattedNote: ExportedNote = {
  title: 'Formatted note',
  content: {
    type: 'doc',
    content: [
      { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Section heading' }] },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Plain ' },
          { type: 'text', text: 'bold text', marks: [{ type: 'bold' }] },
          { type: 'text', text: ' and ' },
          { type: 'text', text: 'italic text', marks: [{ type: 'italic' }] },
          { type: 'text', text: ' and ' },
          { type: 'text', text: 'red text', marks: [{ type: 'textStyle', attrs: { color: '#ff0000' } }] },
        ],
      },
      {
        type: 'bulletList',
        content: [
          { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Bulleted item' }] }] },
        ],
      },
    ],
  },
  type: 'TEXT',
  color: 'green',
  pinned: false,
  createdAt: '2026-01-03T00:00:00.000Z',
  updatedAt: '2026-01-03T00:00:00.000Z',
};

describe('notes-export-formats', () => {
  describe('toPlainText', () => {
    it('includes each note title and its extracted content', () => {
      const text = toPlainText(sampleNotes);

      expect(text).to.include('Grocery list');
      expect(text).to.include('Eggs milk bread');
      expect(text).to.include('Tiptap note');
      expect(text).to.include('Buy milk');
    });

    it('returns a placeholder for an empty note list', () => {
      expect(toPlainText([])).to.equal('No notes to export.');
    });
  });

  describe('toPdfBuffer', () => {
    it('produces a non-empty buffer starting with the PDF signature', async () => {
      const buffer = await toPdfBuffer(sampleNotes);

      expect(buffer.length).to.be.greaterThan(0);
      expect(buffer.subarray(0, 4).toString('ascii')).to.equal('%PDF');
    });

    it('still produces a valid PDF for an empty note list', async () => {
      const buffer = await toPdfBuffer([]);
      expect(buffer.subarray(0, 4).toString('ascii')).to.equal('%PDF');
    });

    it('embeds bold and italic fonts when the note has formatted marks', async () => {
      const buffer = await toPdfBuffer([formattedNote]);
      const raw = buffer.toString('latin1');

      expect(raw).to.include('Helvetica-Bold');
      expect(raw).to.include('Helvetica-Oblique');
    });
  });

  describe('toDocxBuffer', () => {
    it('produces a non-empty buffer starting with the zip signature docx uses', async () => {
      const buffer = await toDocxBuffer(sampleNotes);

      expect(buffer.length).to.be.greaterThan(0);
      expect(buffer.subarray(0, 2).toString('ascii')).to.equal('PK');
    });

    it('still produces a valid docx for an empty note list', async () => {
      const buffer = await toDocxBuffer([]);
      expect(buffer.subarray(0, 2).toString('ascii')).to.equal('PK');
    });

    it('preserves bold/italic runs, heading level, and list structure in the document XML', async () => {
      const buffer = await toDocxBuffer([formattedNote]);
      const zip = await JSZip.loadAsync(buffer);
      const documentXml = await zip.file('word/document.xml')?.async('text');

      expect(documentXml, 'word/document.xml should exist in the docx package').to.be.a('string');
      const xml = documentXml as string;

      expect(xml).to.include('bold text');
      expect(xml).to.include('<w:b/>');
      expect(xml).to.include('italic text');
      expect(xml).to.include('<w:i/>');
      expect(xml).to.include('Section heading');
      expect(xml).to.match(/Heading2/);
      expect(xml).to.include('Bulleted item');
      expect(xml).to.include('<w:numPr>');
      expect(xml).to.include('red text');
      expect(xml).to.include('w:val="ff0000"');
    });
  });
});
