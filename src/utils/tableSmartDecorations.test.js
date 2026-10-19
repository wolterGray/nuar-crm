import {describe, expect, it} from "vitest";
import {Editor} from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import {Markdown} from "@tiptap/markdown";
import {Table, TableCell, TableHeader, TableRow} from "@tiptap/extension-table";
import {TableSmartDecorations} from "./tableSmartDecorations.js";

const TEST_TABLE_MARKDOWN = `| День | Время | Статус |
| --- | --- | --- |
| Понедельник | 10:30 | [ ] Запланировать |
| Среда | 18:30 | [x] Снято |`;

describe("TableSmartDecorations", () => {
  it("initializes without errors and applies decorations", () => {
    const editor = new Editor({
      content: TEST_TABLE_MARKDOWN,
      contentType: "markdown",
      extensions: [
        StarterKit,
        Table.configure({resizable: true}),
        TableRow,
        TableHeader,
        TableCell,
        TableSmartDecorations,
        Markdown.configure({markedOptions: {gfm: true, breaks: true}}),
      ],
    });

    expect(editor.getJSON().content.some((node) => node.type === "table")).toBe(true);
    const md = editor.getMarkdown();
    expect(md).toContain("| Понедельник");
    expect(md).toContain("\\[ \\] Запланировать");
    expect(md).toContain("\\[x\\] Снято");

    editor.destroy();
  });
});
