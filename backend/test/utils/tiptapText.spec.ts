import { expect } from 'chai';

import { extractPlainText, extractRichBlocks } from '../../src/utils/tiptapText';

describe('extractRichBlocks', () => {
  it('preserves bold, italic, underline, and strike marks on separate runs', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Plain ' },
            { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
            { type: 'text', text: ' and ' },
            { type: 'text', text: 'italic underline', marks: [{ type: 'italic' }, { type: 'underline' }] },
            { type: 'text', text: ' and ' },
            { type: 'text', text: 'struck', marks: [{ type: 'strike' }] },
          ],
        },
      ],
    };

    const blocks = extractRichBlocks(doc);

    expect(blocks).to.have.length(1);
    expect(blocks[0]).to.deep.equal({
      kind: 'paragraph',
      runs: [
        { text: 'Plain ' },
        { text: 'bold', bold: true },
        { text: ' and ' },
        { text: 'italic underline', italic: true, underline: true },
        { text: ' and ' },
        { text: 'struck', strike: true },
      ],
    });
  });

  it('captures a valid hex color from a textStyle mark', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'red text', marks: [{ type: 'textStyle', attrs: { color: '#ff0000' } }] }],
        },
      ],
    };

    expect(extractRichBlocks(doc)).to.deep.equal([{ kind: 'paragraph', runs: [{ text: 'red text', color: '#ff0000' }] }]);
  });

  it('ignores a textStyle mark with no color or a non-hex color', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'no color', marks: [{ type: 'textStyle', attrs: {} }] },
            { type: 'text', text: 'bad color', marks: [{ type: 'textStyle', attrs: { color: 'red' } }] },
          ],
        },
      ],
    };

    const blocks = extractRichBlocks(doc);
    expect(blocks[0].runs).to.deep.equal([{ text: 'no color' }, { text: 'bad color' }]);
  });

  it('captures heading level from attrs, defaulting to 1', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Section' }] },
        { type: 'heading', content: [{ type: 'text', text: 'No level given' }] },
      ],
    };

    const blocks = extractRichBlocks(doc);

    expect(blocks[0]).to.deep.include({ kind: 'heading', level: 2 });
    expect(blocks[1]).to.deep.include({ kind: 'heading', level: 1 });
  });

  it('flattens bulletList and orderedList items into bullet/ordered blocks', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Second' }] }] },
          ],
        },
        {
          type: 'orderedList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Step one' }] }] },
          ],
        },
      ],
    };

    const blocks = extractRichBlocks(doc);

    expect(blocks.map((b) => b.kind)).to.deep.equal(['bullet', 'bullet', 'ordered']);
    expect(blocks[0].runs).to.deep.equal([{ text: 'First' }]);
    expect(blocks[2].runs).to.deep.equal([{ text: 'Step one' }]);
  });

  it('handles blockquote nodes', () => {
    const doc = {
      type: 'doc',
      content: [{ type: 'blockquote', content: [{ type: 'text', text: 'Quoted text' }] }],
    };

    expect(extractRichBlocks(doc)).to.deep.equal([{ kind: 'blockquote', runs: [{ text: 'Quoted text' }] }]);
  });

  it('preserves empty paragraphs as blank blocks for spacing', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'First' }] },
        { type: 'paragraph' },
        { type: 'paragraph', content: [{ type: 'text', text: 'Second' }] },
      ],
    };

    const blocks = extractRichBlocks(doc);

    expect(blocks).to.have.length(3);
    expect(blocks[1]).to.deep.equal({ kind: 'paragraph', runs: [] });
  });

  it('treats a plain string as a single unformatted paragraph', () => {
    expect(extractRichBlocks('Hello world')).to.deep.equal([{ kind: 'paragraph', runs: [{ text: 'Hello world' }] }]);
  });

  it('returns an empty array for null/undefined content', () => {
    expect(extractRichBlocks(null)).to.deep.equal([]);
    expect(extractRichBlocks(undefined)).to.deep.equal([]);
  });
});

describe('extractPlainText', () => {
  it('still flattens formatted content to plain text (used by the .txt export)', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Plain ' },
            { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
          ],
        },
      ],
    };

    expect(extractPlainText(doc)).to.equal('Plain bold');
  });
});
