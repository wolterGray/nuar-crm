const MARKDOWN_BLOCK_PATTERN = /(^|\n)(#{1,3}\s+|>\s+|[-*+]\s+|\d+\.\s+|-\s+\[[ xX]\]\s+|```|---\s*$)/m;
const MARKDOWN_TABLE_PATTERN = /(^|\n)\s*\|?.+\|.+\n\s*\|?\s*:?-{3,}/m;
const MARKDOWN_INLINE_PATTERN = /(\*\*[^*\n]+\*\*|~~[^~\n]+~~|`[^`\n]+`|\[[^\]]+\]\(https?:\/\/[^)]+\))/;

export const looksLikeMarkdown = (value = "") => {
  const text = normalizeMarkdownForEditor(value);
  if (!text.trim()) return false;
  return MARKDOWN_BLOCK_PATTERN.test(text)
    || MARKDOWN_TABLE_PATTERN.test(text)
    || MARKDOWN_INLINE_PATTERN.test(text);
};

const isPipeTableLine = (line = "") => {
  const trimmed = String(line).trim();
  return trimmed.startsWith("|") && trimmed.endsWith("|") && (trimmed.match(/\|/g)?.length || 0) >= 3;
};

export function normalizeMarkdownForEditor(value = "") {
  const lines = String(value).replace(/\r\n?/g, "\n").split("\n");
  const normalized = [];
  let inCodeFence = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^\s*```/.test(line)) {
      inCodeFence = !inCodeFence;
      normalized.push(line);
      continue;
    }

    if (!inCodeFence && !line.trim()) {
      const previous = normalized.at(-1);
      const next = lines.slice(index + 1).find((candidate) => candidate.trim());
      if (isPipeTableLine(previous) && isPipeTableLine(next)) continue;
    }

    normalized.push(!inCodeFence && isPipeTableLine(line) ? line.trim() : line);
  }

  return normalized.join("\n");
}

export const stripMarkdownForSnippet = (value = "") => String(value)
  .replace(/<br\s*\/?>/gi, " ")
  .replace(/<\/?[^>]+(>|$)/g, "")
  .replace(/^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*$/gm, "")
  .replace(/^#{1,6}\s+/gm, "")
  .replace(/^\s*[-*+]\s+\[[ xX]\]\s*/gm, "")
  .replace(/^\s*(?:[-*+•]|\d+\.)\s+/gm, "")
  .replace(/^>\s*/gm, "")
  .replace(/\[([^\]]+)]\((?:https?:\/\/|mailto:)[^)]+\)/g, "$1")
  .replace(/(\*\*|__|~~|`)(.*?)\1/g, "$2")
  .replace(/\|/g, " ")
  .replace(/\s+/g, " ")
  .trim();
