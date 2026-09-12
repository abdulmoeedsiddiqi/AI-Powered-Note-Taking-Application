import { countWords, extractNotePreview, extractPlainText } from './tiptapText';

describe('extractPlainText', () => {
  it('extracts text from a Tiptap document tree', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'world' }] },
      ],
    };

    expect(extractPlainText(doc)).toBe('Hello world');
  });

  it('returns an empty string for null/undefined/non-object content', () => {
    expect(extractPlainText(null)).toBe('');
    expect(extractPlainText(undefined)).toBe('');
  });
});

describe('countWords', () => {
  it('counts words in a plain string', () => {
    expect(countWords('one two three')).toBe(3);
  });

  it('returns 0 for empty or whitespace-only text', () => {
    expect(countWords('   ')).toBe(0);
  });
});

describe('extractNotePreview', () => {
  it('returns plain string content as-is', () => {
    expect(extractNotePreview('Just a plain string note')).toBe('Just a plain string note');
  });

  it('extracts readable text from a Tiptap JSON document', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Buy milk and eggs' }] }],
    };

    expect(extractNotePreview(doc)).toBe('Buy milk and eggs');
  });

  it('returns an empty string for null content', () => {
    expect(extractNotePreview(null)).toBe('');
  });

  it('keeps paragraph breaks as line breaks so the card preview is not run-on', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'First paragraph.' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Second paragraph.' }] },
      ],
    };

    expect(extractNotePreview(doc)).toBe('First paragraph.\nSecond paragraph.');
  });
});
