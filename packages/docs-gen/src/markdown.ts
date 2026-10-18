/** A link target found in a markdown file, with its 1-based line for error messages. */
interface MarkdownLink {
  readonly href: string;
  readonly line: number;
}

/** What the link and compliance checks need to know about one markdown file. */
export interface MarkdownOutline {
  readonly links: readonly MarkdownLink[];
  /** Anchor IDs a `#fragment` can target: heading slugs plus explicit `<a id>` anchors. */
  readonly anchors: ReadonlySet<string>;
  readonly headings: readonly { readonly depth: number; readonly text: string }[];
  readonly codeBlockCount: number;
}

const FENCE = /^\s*(```|~~~)/;
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
// Inline links and images: [text](href "title") and [text](<href with spaces>).
// Reference-style links are not used by the generators, and hand-written pages in this
// repo use inline links only.
const INLINE_LINK = /!?\[[^\]]*\]\(\s*(?:<([^>]+)>|([^)\s]+))(?:\s+"[^"]*")?\s*\)/g;
const HTML_ANCHOR = /<a\s+(?:[^>]*\s)?(?:id|name)="([^"]+)"/g;
const INLINE_CODE = /`[^`]*`/g;

/**
 * Extracts links, anchors, and headings from markdown. Fenced code blocks and inline code
 * are skipped, because a link inside a code sample is example text, not navigation.
 */
export function outlineMarkdown(markdown: string): MarkdownOutline {
  const links: MarkdownLink[] = [];
  const anchors = new Set<string>();
  const headings: { depth: number; text: string }[] = [];
  const slugCounts = new Map<string, number>();
  let inFence = false;
  let codeBlockCount = 0;

  markdown.split('\n').forEach((rawLine, index) => {
    if (FENCE.test(rawLine)) {
      if (!inFence) {
        codeBlockCount++;
      }
      inFence = !inFence;
      return;
    }
    if (inFence) {
      return;
    }
    const line = rawLine.replace(INLINE_CODE, '');
    const heading = HEADING.exec(rawLine);
    if (heading?.[1] !== undefined && heading[2] !== undefined) {
      headings.push({ depth: heading[1].length, text: heading[2] });
      anchors.add(uniqueSlug(slugify(heading[2]), slugCounts));
    }
    for (const match of line.matchAll(INLINE_LINK)) {
      const href = match[1] ?? match[2];
      if (href !== undefined) {
        links.push({ href, line: index + 1 });
      }
    }
    for (const match of rawLine.matchAll(HTML_ANCHOR)) {
      if (match[1] !== undefined) {
        anchors.add(match[1]);
      }
    }
  });
  return { links, anchors, headings, codeBlockCount };
}

/**
 * GitHub's heading anchor algorithm: lowercase, drop punctuation except `-` and `_`, and
 * turn spaces into `-`. Links must match what GitHub renders, because that is where
 * readers click them.
 */
function slugify(heading: string): string {
  return heading
    .replace(/`/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

/** GitHub suffixes repeated slugs with `-1`, `-2`, and so on, in document order. */
function uniqueSlug(slug: string, counts: Map<string, number>): string {
  const seen = counts.get(slug) ?? 0;
  counts.set(slug, seen + 1);
  return seen === 0 ? slug : `${slug}-${seen}`;
}
