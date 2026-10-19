import { describe, expect, it } from 'vitest';

import { outlineMarkdown } from '../../src/markdown.ts';

describe('outlineMarkdown', () => {
  it('collects inline links and images with their lines, outside code', () => {
    const outline = outlineMarkdown(
      [
        '# Title',
        'See [a](a.md) and ![img](img/x.png "Title").',
        '`[not](a link)` and [b](<b c.md>)',
        '```md',
        '[inside](fence.md)',
        '```',
      ].join('\n'),
    );

    expect(outline.links).toEqual([
      { href: 'a.md', line: 2 },
      { href: 'img/x.png', line: 2 },
      { href: 'b c.md', line: 3 },
    ]);
    expect(outline.codeBlockCount).toBe(1);
  });

  it('builds GitHub-style heading anchors, numbering repeats', () => {
    const outline = outlineMarkdown(
      [
        '# Retry `run()` errors!',
        '## Constructor',
        '## Constructor',
        '### [Linked](x.md) heading',
        '<a id="custom"></a>',
      ].join('\n'),
    );

    expect([...outline.anchors]).toEqual([
      'retry-run-errors',
      'constructor',
      'constructor-1',
      'linked-heading',
      'custom',
    ]);
    expect(outline.headings.map((heading) => heading.depth)).toEqual([1, 2, 2, 3]);
  });
});
