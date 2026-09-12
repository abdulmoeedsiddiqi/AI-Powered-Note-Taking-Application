import Color from '@tiptap/extension-color';
import TextStyle from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';
import { generateJSON } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import MarkdownIt from 'markdown-it';

// Same extension set the editor uses, so imported content matches the app's
// schema (headings, bold/italic/underline/strike, lists, color, …).
const IMPORT_EXTENSIONS = [StarterKit, Underline, TextStyle, Color];

const MARKDOWN_EXTENSIONS = ['.md', '.markdown'];

// breaks: single newlines become <br>; html: false so raw HTML in the file is
// escaped rather than injected.
const md = new MarkdownIt({ html: false, linkify: true, breaks: true });

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Plain text has no rich formatting, but line breaks are meaningful: blank lines
// separate paragraphs and single newlines become hard breaks.
function plainTextToHtml(text: string): string {
  const paragraphs = text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((block) => escapeHtml(block).replace(/\n/g, '<br>'))
    .filter((block) => block.length > 0)
    .map((block) => `<p>${block}</p>`);
  return paragraphs.join('') || '<p></p>';
}

function isMarkdownFile(fileName: string): boolean {
  const name = fileName.toLowerCase();
  return MARKDOWN_EXTENSIONS.some((ext) => name.endsWith(ext));
}

/**
 * Convert a dropped text/markdown file's contents into Tiptap document JSON,
 * preserving line breaks and — for markdown files — headings, bold/italic,
 * lists, blockquotes and code, so the note keeps the file's formatting.
 */
export function fileTextToNoteContent(text: string, fileName: string): object {
  const html = isMarkdownFile(fileName) ? md.render(text) : plainTextToHtml(text);
  return generateJSON(html, IMPORT_EXTENSIONS);
}
