import {describe, expect, it} from "vitest";
import {Editor} from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import {Markdown} from "@tiptap/markdown";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import {Table, TableCell, TableHeader, TableRow} from "@tiptap/extension-table";
import {looksLikeMarkdown, stripMarkdownForSnippet} from "./noteMarkdown.js";

const TEST_DOCUMENT = `### 📅 Контент-план NUAR

**Концепция:** массаж с характером.

---

### 🎬 План публикаций

| День | Контент | Время |
|---|---|---|
| Понедельник | Stories | 10:30 |
| Среда | Reels | 19:00 |
| Пятница | Карусель | 18:00 |

### ✅ Подготовка

- [x] Разработать стратегию
- [ ] Подготовить сценарий
- [ ] Снять Reels

> Главное правило: один съёмочный день — контент на всю неделю.`;

const createMarkdownEditor = (content) => new Editor({
  content,
  contentType: "markdown",
  extensions: [
    StarterKit,
    TaskList,
    TaskItem.configure({nested: true}),
    Table,
    TableRow,
    TableHeader,
    TableCell,
    Markdown.configure({markedOptions: {gfm: true, breaks: true}}),
  ],
});

describe("note Markdown", () => {
  it("detects structured Markdown without changing ordinary text", () => {
    expect(looksLikeMarkdown(TEST_DOCUMENT)).toBe(true);
    expect(looksLikeMarkdown("Обычная заметка без форматирования")).toBe(false);
    expect(looksLikeMarkdown("https://nuarr.pl")).toBe(false);
  });

  it("builds a clean list preview without Markdown table syntax", () => {
    const snippet = stripMarkdownForSnippet(`## План\n\n| День | **Статус** |\n|---|---|\n| Пн | [Готово](https://nuarr.pl) |`);
    expect(snippet).toBe("План День Статус Пн Готово");
  });

  it("round-trips GFM tables, task lists and document blocks", () => {
    const editor = createMarkdownEditor(TEST_DOCUMENT);
    const document = editor.getJSON();
    const table = document.content.find((node) => node.type === "table");
    const taskList = document.content.find((node) => node.type === "taskList");

    expect(document.content.map((node) => node.type)).toEqual(expect.arrayContaining([
      "heading",
      "horizontalRule",
      "table",
      "taskList",
      "blockquote",
    ]));
    expect(table.content).toHaveLength(4);
    expect(taskList.content.map((node) => node.attrs.checked)).toEqual([true, false, false]);

    const markdown = editor.getMarkdown();
    expect(markdown).toContain("| Понедельник | Stories");
    expect(markdown).toContain("- [x] Разработать стратегию");
    expect(markdown).toContain("> Главное правило");
    editor.destroy();
  });
});
