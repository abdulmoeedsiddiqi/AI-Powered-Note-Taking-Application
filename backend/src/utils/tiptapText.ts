export function extractPlainText(content: unknown): string {
  if (typeof content === 'string') {
    const trimmed = content.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object') {
          return extractPlainText(parsed);
        }
      } catch {
        // not valid JSON, treat as raw text
      }
    }
    return content;
  }
  if (!content || typeof content !== 'object') {
    return '';
  }
  const node = content as { text?: string; content?: unknown[] };
  let result = node.text ?? '';
  if (Array.isArray(node.content)) {
    result += node.content.map(extractPlainText).join(' ');
  }
  return result.replace(/\s+/g, ' ').trim();
}

export interface RichTextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  color?: string;
}

export type RichBlock =
  | { kind: 'heading'; level: 1 | 2 | 3; runs: RichTextRun[] }
  | { kind: 'bullet'; runs: RichTextRun[] }
  | { kind: 'ordered'; runs: RichTextRun[] }
  | { kind: 'blockquote'; runs: RichTextRun[] }
  | { kind: 'paragraph'; runs: RichTextRun[] };

interface TiptapNode {
  type?: string;
  attrs?: { level?: number };
  marks?: { type: string; attrs?: { color?: string } }[];
  text?: string;
  content?: TiptapNode[];
}

const HEX_COLOR = /^#[0-9a-f]{3}([0-9a-f]{3})?$/i;

function runFromTextNode(node: TiptapNode): RichTextRun {
  const run: RichTextRun = { text: node.text ?? '' };
  for (const mark of node.marks ?? []) {
    if (mark.type === 'bold') run.bold = true;
    if (mark.type === 'italic') run.italic = true;
    if (mark.type === 'underline') run.underline = true;
    if (mark.type === 'strike') run.strike = true;
    if (mark.type === 'textStyle' && mark.attrs?.color && HEX_COLOR.test(mark.attrs.color)) {
      run.color = mark.attrs.color;
    }
  }
  return run;
}

function extractRuns(node: TiptapNode | undefined): RichTextRun[] {
  if (!node) return [];
  const runs: RichTextRun[] = [];
  if (node.type === 'text' && node.text) {
    runs.push(runFromTextNode(node));
  }
  for (const child of node.content ?? []) {
    runs.push(...extractRuns(child));
  }
  return runs;
}

function headingLevel(node: TiptapNode): 1 | 2 | 3 {
  return node.attrs?.level === 2 || node.attrs?.level === 3 ? (node.attrs.level as 2 | 3) : 1;
}

/**
 * Walks a Tiptap/ProseMirror JSON document into a flat list of blocks with
 * per-run bold/italic/underline/strike marks preserved, for renderers (PDF,
 * DOCX) that can actually represent rich formatting - unlike
 * extractPlainText, which collapses everything to a single string.
 */
export function extractRichBlocks(content: unknown): RichBlock[] {
  if (typeof content === 'string') {
    const trimmed = content.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object') {
          return extractRichBlocks(parsed);
        }
      } catch {
        // not valid JSON, fall through to plain-text handling
      }
    }
    return trimmed ? [{ kind: 'paragraph', runs: [{ text: trimmed }] }] : [];
  }

  if (!content || typeof content !== 'object') {
    return [];
  }

  const doc = content as TiptapNode;
  const topLevel = Array.isArray(doc.content) ? doc.content : [doc];
  const blocks: RichBlock[] = [];

  for (const node of topLevel) {
    if (!node || typeof node !== 'object') continue;

    if (node.type === 'heading') {
      blocks.push({ kind: 'heading', level: headingLevel(node), runs: extractRuns(node) });
      continue;
    }

    if (node.type === 'bulletList') {
      for (const item of node.content ?? []) {
        blocks.push({ kind: 'bullet', runs: extractRuns(item) });
      }
      continue;
    }

    if (node.type === 'orderedList') {
      for (const item of node.content ?? []) {
        blocks.push({ kind: 'ordered', runs: extractRuns(item) });
      }
      continue;
    }

    if (node.type === 'blockquote') {
      blocks.push({ kind: 'blockquote', runs: extractRuns(node) });
      continue;
    }

    if (node.type === 'paragraph') {
      blocks.push({ kind: 'paragraph', runs: extractRuns(node) });
      continue;
    }

    const runs = extractRuns(node);
    if (runs.length > 0) {
      blocks.push({ kind: 'paragraph', runs });
    }
  }

  return blocks;
}
