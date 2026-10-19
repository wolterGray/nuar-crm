const MARKDOWN_BLOCK_PATTERN = /(^|\n)(#{1,3}\s+|>\s+|[-*+]\s+|\d+\.\s+|-\s+\[[ xX]\]\s+|```|---\s*$)/m;
const MARKDOWN_TABLE_PATTERN = /(^|\n)\s*\|?.+\|.+\n\s*\|?\s*:?-{3,}/m;
const MARKDOWN_INLINE_PATTERN = /(\*\*[^*\n]+\*\*|~~[^~\n]+~~|`[^`\n]+`|\[[^\]]+\]\(https?:\/\/[^)]+\))/;

export const looksLikeMarkdown = (value = "") => {
  const text = String(value);
  if (!text.trim()) return false;
  return MARKDOWN_BLOCK_PATTERN.test(text)
    || MARKDOWN_TABLE_PATTERN.test(text)
    || MARKDOWN_INLINE_PATTERN.test(text);
};

export const stripMarkdownForSnippet = (value = "") => String(value)
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
