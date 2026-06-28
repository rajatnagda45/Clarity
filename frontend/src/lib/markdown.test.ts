import { describe, expect, it } from 'vitest';

import { parseMarkdownBlocks } from './markdown';


describe('parseMarkdownBlocks', () => {
  it('parses paragraphs and lists deterministically', () => {
    const blocks = parseMarkdownBlocks(
      'This is a paragraph.\n\n- First item\n- Second item\n\nAnother paragraph.',
    );

    expect(blocks).toEqual([
      { type: 'paragraph', text: 'This is a paragraph.' },
      { type: 'list', items: ['First item', 'Second item'] },
      { type: 'paragraph', text: 'Another paragraph.' },
    ]);
  });
});
