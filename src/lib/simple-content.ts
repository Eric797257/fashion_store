export type ContentBlock =
  | { type: "heading"; level: 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] };

const MAX_LENGTH = 50_000;

/**
 * "## Heading", "### Subheading", "- list item" and plain paragraphs. Nothing else.
 * The result is plain text that React escapes, so a page can never contain HTML or scripts.
 */
export function parseSimpleContent(input: string): ContentBlock[] {
  const text = Array.from(input.slice(0, MAX_LENGTH).replace(/\r\n?/g, "\n"))
    .filter((ch) => ch === "\n" || ch === "\t" || ch.charCodeAt(0) >= 32)
    .join("");

  const blocks: ContentBlock[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) blocks.push({ type: "paragraph", text: paragraph.join("\n") });
    paragraph = [];
  };
  const flushList = () => {
    if (list.length > 0) blocks.push({ type: "list", items: list });
    list = [];
  };

  for (const raw of text.split("\n")) {
    const line = raw.trim();

    if (line === "") {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = line.match(/^(#{2,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ type: "heading", level: heading[1]!.length === 2 ? 2 : 3, text: heading[2]! });
      continue;
    }

    const item = line.match(/^[-*]\s+(.+)$/);
    if (item) {
      flushParagraph();
      list.push(item[1]!);
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  return blocks;
}