import { AlignmentType, Document, HeadingLevel, LevelFormat, Packer, Paragraph, TextRun } from 'docx';
import PDFDocument from 'pdfkit';

import { extractPlainText, extractRichBlocks } from '../../utils/tiptapText';
import type { RichBlock, RichTextRun } from '../../utils/tiptapText';
import type { ExportedNote } from './notes.types';

export const EXPORT_FORMATS = ['json', 'txt', 'pdf', 'docx'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export function toPlainText(notes: ExportedNote[]): string {
  if (notes.length === 0) {
    return 'No notes to export.';
  }

  return notes
    .map((note) => `${note.title}\n${'='.repeat(note.title.length)}\n\n${extractPlainText(note.content)}`)
    .join('\n\n\n');
}

const PDF_HEADING_SIZES: Record<1 | 2 | 3, number> = { 1: 18, 2: 15, 3: 13 };

function pdfFontFor(bold?: boolean, italic?: boolean): string {
  if (bold && italic) return 'Helvetica-BoldOblique';
  if (bold) return 'Helvetica-Bold';
  if (italic) return 'Helvetica-Oblique';
  return 'Helvetica';
}

const PDF_DEFAULT_COLOR = '#000000';

function renderPdfRuns(doc: PDFKit.PDFDocument, runs: RichTextRun[], extraBold = false): void {
  if (runs.length === 0) {
    doc.text(' ');
    return;
  }
  runs.forEach((run, index) => {
    doc
      .font(pdfFontFor(run.bold || extraBold, run.italic))
      .fillColor(run.color ?? PDF_DEFAULT_COLOR)
      .text(run.text, {
        continued: index < runs.length - 1,
        underline: run.underline,
        strike: run.strike,
      });
  });
  doc.fillColor(PDF_DEFAULT_COLOR);
}

function renderPdfBlocks(doc: PDFKit.PDFDocument, blocks: RichBlock[]): void {
  let orderedIndex = 0;

  for (const block of blocks) {
    if (block.kind !== 'ordered') {
      orderedIndex = 0;
    }

    doc.fontSize(11);

    switch (block.kind) {
      case 'heading':
        doc.fontSize(PDF_HEADING_SIZES[block.level]).moveDown(0.3);
        renderPdfRuns(doc, block.runs, true);
        doc.fontSize(11).moveDown(0.3);
        break;
      case 'bullet':
        doc.text('•  ', { continued: true, indent: 12 });
        renderPdfRuns(doc, block.runs);
        break;
      case 'ordered':
        orderedIndex += 1;
        doc.text(`${orderedIndex}.  `, { continued: true, indent: 12 });
        renderPdfRuns(doc, block.runs);
        break;
      case 'blockquote':
        renderPdfRuns(
          doc,
          block.runs.map((run) => ({ ...run, italic: true })),
        );
        break;
      case 'paragraph':
      default:
        renderPdfRuns(doc, block.runs);
        doc.moveDown(0.4);
    }
  }
}

export function toPdfBuffer(notes: ExportedNote[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    if (notes.length === 0) {
      doc.fontSize(14).text('No notes to export.');
    }

    notes.forEach((note, index) => {
      if (index > 0) {
        doc.addPage();
      }
      doc.fontSize(18).font('Helvetica-Bold').text(note.title, { underline: true });
      doc.font('Helvetica').moveDown();

      const blocks = extractRichBlocks(note.content);
      if (blocks.length === 0) {
        doc.fontSize(11).text('(empty note)');
      } else {
        renderPdfBlocks(doc, blocks);
      }
    });

    doc.end();
  });
}

const DOCX_HEADING_LEVELS: Record<1 | 2 | 3, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
};
const ORDERED_LIST_REFERENCE = 'note-ordered-list';

function toDocxRun(run: RichTextRun, extraItalic = false): TextRun {
  return new TextRun({
    text: run.text,
    bold: run.bold,
    italics: run.italic || extraItalic,
    strike: run.strike,
    underline: run.underline ? {} : undefined,
    color: run.color,
  });
}

function renderDocxBlocks(blocks: RichBlock[]): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  let numberingInstance = 0;
  let previousWasOrdered = false;

  for (const block of blocks) {
    if (block.kind === 'ordered') {
      if (!previousWasOrdered) {
        numberingInstance += 1;
      }
      previousWasOrdered = true;
    } else {
      previousWasOrdered = false;
    }

    switch (block.kind) {
      case 'heading':
        paragraphs.push(
          new Paragraph({
            heading: DOCX_HEADING_LEVELS[block.level],
            children: block.runs.map((run) => toDocxRun(run)),
          }),
        );
        break;
      case 'bullet':
        paragraphs.push(
          new Paragraph({ bullet: { level: 0 }, children: block.runs.map((run) => toDocxRun(run)) }),
        );
        break;
      case 'ordered':
        paragraphs.push(
          new Paragraph({
            numbering: { reference: ORDERED_LIST_REFERENCE, level: 0, instance: numberingInstance },
            children: block.runs.map((run) => toDocxRun(run)),
          }),
        );
        break;
      case 'blockquote':
        paragraphs.push(
          new Paragraph({
            indent: { left: 720 },
            children: block.runs.map((run) => toDocxRun(run, true)),
          }),
        );
        break;
      case 'paragraph':
      default:
        paragraphs.push(new Paragraph({ children: block.runs.map((run) => toDocxRun(run)) }));
    }
  }

  return paragraphs;
}

export async function toDocxBuffer(notes: ExportedNote[]): Promise<Buffer> {
  const children =
    notes.length === 0
      ? [new Paragraph({ text: 'No notes to export.' })]
      : notes.flatMap((note) => {
          const blocks = extractRichBlocks(note.content);
          return [
            new Paragraph({ text: note.title, heading: HeadingLevel.TITLE }),
            ...(blocks.length === 0 ? [new Paragraph({ text: '(empty note)' })] : renderDocxBlocks(blocks)),
            new Paragraph({ text: '' }),
          ];
        });

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: ORDERED_LIST_REFERENCE,
          levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.START }],
        },
      ],
    },
    sections: [{ children }],
  });
  return Packer.toBuffer(doc);
}
