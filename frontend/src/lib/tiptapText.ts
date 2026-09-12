export function extractPlainText(node: unknown): string {
  if (!node || typeof node !== 'object') {
    return '';
  }
  const { text, content } = node as { text?: string; content?: unknown[] };
  let result = text ?? '';
  if (Array.isArray(content)) {
    result += content.map(extractPlainText).join(' ');
  }
  return result;
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

// Block-level node types that should start on their own line in a text preview,
// so a note's paragraph breaks show up in the card thumbnail too.
const BLOCK_NODE_TYPES = new Set([
  'paragraph',
  'heading',
  'blockquote',
  'codeBlock',
  'listItem',
  'bulletList',
  'orderedList',
]);

function extractPreviewText(node: unknown): string {
  if (!node || typeof node !== 'object') {
    return '';
  }
  const { type, text, content } = node as { type?: string; text?: string; content?: unknown[] };
  if (type === 'text') {
    return text ?? '';
  }
  if (type === 'hardBreak') {
    return '\n';
  }
  const inner = Array.isArray(content) ? content.map(extractPreviewText).join('') : '';
  return type && BLOCK_NODE_TYPES.has(type) ? `${inner}\n` : inner;
}

export function extractNotePreview(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }
  return extractPreviewText(content)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
