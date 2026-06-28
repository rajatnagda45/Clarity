export interface MarkdownParagraph {
  type: 'paragraph';
  text: string;
}

export interface MarkdownList {
  type: 'list';
  items: string[];
}

export type MarkdownBlock = MarkdownParagraph | MarkdownList;

export function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const lines = markdown.split('\n');
  const blocks: MarkdownBlock[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];

  function flushParagraph() {
    if (paragraph.length > 0) {
      blocks.push({ type: 'paragraph', text: paragraph.join(' ').trim() });
      paragraph = [];
    }
  }

  function flushList() {
    if (listItems.length > 0) {
      blocks.push({ type: 'list', items: [...listItems] });
      listItems = [];
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    if (line.startsWith('- ') || line.startsWith('* ')) {
      flushParagraph();
      listItems.push(line.slice(2).trim());
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      flushParagraph();
      listItems.push(line.replace(/^\d+\.\s/, '').trim());
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  return blocks;
}
