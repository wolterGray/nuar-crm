import {useCallback, useEffect, useMemo} from "react";
import {EditorContent, useEditor} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {Markdown} from "@tiptap/markdown";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import {Table, TableCell, TableHeader, TableRow} from "@tiptap/extension-table";
import Placeholder from "@tiptap/extension-placeholder";
import {AppIcon} from "./ui/index.js";
import {looksLikeMarkdown, normalizeMarkdownForEditor} from "../utils/noteMarkdown.js";

function ToolButton({active = false, children, disabled = false, icon, label, onClick, title}) {
  return (
    <button
      aria-label={label}
      className={`notion-rich-tool ${active ? "is-active" : ""}`}
      disabled={disabled}
      title={title || label}
      type="button"
      onMouseDown={(event) => {
        event.preventDefault();
        if (!disabled) onClick?.();
      }}
    >
      {icon ? <AppIcon name={icon} size="xs" /> : null}
      {children ? <span>{children}</span> : null}
    </button>
  );
}

function EditorToolbar({editor}) {
  const setLink = useCallback(() => {
    const previousUrl = editor?.getAttributes("link")?.href || "";
    const url = window.prompt("Ссылка", previousUrl || "https://");
    if (url === null) return;
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({href: url.trim()}).run();
  }, [editor]);

  if (!editor) return null;
  const inTable = editor.isActive("table");

  return (
    <div className="notion-rich-toolbar" role="toolbar" aria-label="Форматирование заметки">
      <div className="notion-rich-tool-group">
        <ToolButton active={editor.isActive("bold")} icon="bold" label="Жирный" onClick={() => editor.chain().focus().toggleBold().run()} />
        <ToolButton active={editor.isActive("italic")} icon="italic" label="Курсив" onClick={() => editor.chain().focus().toggleItalic().run()} />
        <ToolButton active={editor.isActive("strike")} label="Зачёркнутый" onClick={() => editor.chain().focus().toggleStrike().run()}>S</ToolButton>
        <ToolButton active={editor.isActive("code")} label="Код" onClick={() => editor.chain().focus().toggleCode().run()}>Code</ToolButton>
        <ToolButton active={editor.isActive("link")} icon="link" label="Ссылка" onClick={setLink} />
      </div>
      <div className="notion-rich-tool-divider" />
      <div className="notion-rich-tool-group">
        <ToolButton active={editor.isActive("heading", {level: 1})} label="Заголовок 1" onClick={() => editor.chain().focus().toggleHeading({level: 1}).run()}>H1</ToolButton>
        <ToolButton active={editor.isActive("heading", {level: 2})} label="Заголовок 2" onClick={() => editor.chain().focus().toggleHeading({level: 2}).run()}>H2</ToolButton>
        <ToolButton active={editor.isActive("heading", {level: 3})} label="Заголовок 3" onClick={() => editor.chain().focus().toggleHeading({level: 3}).run()}>H3</ToolButton>
        <ToolButton active={editor.isActive("bulletList")} icon="list" label="Маркированный список" onClick={() => editor.chain().focus().toggleBulletList().run()} />
        <ToolButton active={editor.isActive("orderedList")} icon="listOrdered" label="Нумерованный список" onClick={() => editor.chain().focus().toggleOrderedList().run()} />
        <ToolButton active={editor.isActive("taskList")} icon="checkSquare" label="Чек-лист" onClick={() => editor.chain().focus().toggleTaskList().run()} />
        <ToolButton active={editor.isActive("blockquote")} label="Цитата" onClick={() => editor.chain().focus().toggleBlockquote().run()}>“”</ToolButton>
        <ToolButton icon="minus" label="Разделитель" onClick={() => editor.chain().focus().setHorizontalRule().run()} />
      </div>
      <div className="notion-rich-tool-divider" />
      <div className="notion-rich-tool-group">
        <ToolButton label="Вставить таблицу" onClick={() => editor.chain().focus().insertTable({rows: 3, cols: 3, withHeaderRow: true}).run()}>Таблица</ToolButton>
        {inTable ? (
          <>
            <ToolButton label="Добавить строку" onClick={() => editor.chain().focus().addRowAfter().run()}>+ строка</ToolButton>
            <ToolButton label="Удалить строку" onClick={() => editor.chain().focus().deleteRow().run()}>− строка</ToolButton>
            <ToolButton label="Добавить колонку" onClick={() => editor.chain().focus().addColumnAfter().run()}>+ колонка</ToolButton>
            <ToolButton label="Удалить колонку" onClick={() => editor.chain().focus().deleteColumn().run()}>− колонка</ToolButton>
            <ToolButton label="Удалить таблицу" onClick={() => editor.chain().focus().deleteTable().run()}>Удалить</ToolButton>
          </>
        ) : null}
      </div>
      <div className="notion-rich-toolbar-spacer" />
      <div className="notion-rich-tool-group">
        <ToolButton disabled={!editor.can().undo()} icon="undo" label="Отменить" onClick={() => editor.chain().focus().undo().run()} />
        <ToolButton disabled={!editor.can().redo()} icon="redo" label="Повторить" onClick={() => editor.chain().focus().redo().run()} />
      </div>
    </div>
  );
}

function MarkdownNoteEditor({onBlur, onChange, value = ""}) {
  const extensions = useMemo(() => [
    StarterKit.configure({
      heading: {levels: [1, 2, 3]},
      link: {autolink: true, defaultProtocol: "https", linkOnPaste: true, openOnClick: false},
    }),
    TaskList,
    TaskItem.configure({nested: true}),
    Table.configure({resizable: true}),
    TableRow,
    TableHeader,
    TableCell,
    Placeholder.configure({placeholder: "Начните писать или вставьте готовый Markdown-документ…"}),
    Markdown.configure({markedOptions: {gfm: true, breaks: true}}),
  ], []);

  const editor = useEditor({
    content: normalizeMarkdownForEditor(value),
    contentType: "markdown",
    extensions,
    immediatelyRender: false,
    editorProps: {
      attributes: {class: "notion-rich-content", spellcheck: "true"},
      handlePaste: (_view, event) => {
        const plainText = event.clipboardData?.getData("text/plain") || "";
        if (!looksLikeMarkdown(plainText)) return false;
        event.preventDefault();
        editor?.chain().focus().insertContent(normalizeMarkdownForEditor(plainText), {contentType: "markdown"}).run();
        return true;
      },
    },
    onBlur: ({editor: currentEditor}) => onBlur?.(currentEditor.getMarkdown()),
    onUpdate: ({editor: currentEditor}) => onChange?.(currentEditor.getMarkdown()),
  });

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const nextValue = normalizeMarkdownForEditor(value);
    if (editor.getMarkdown() === nextValue) return;
    editor.commands.setContent(nextValue, {contentType: "markdown", emitUpdate: false});
  }, [editor, value]);

  return (
    <div className="notion-rich-editor">
      <EditorToolbar editor={editor} />
      <div className="notion-rich-canvas" onDrop={(event) => event.stopPropagation()}>
        <EditorContent editor={editor} />
      </div>
      <p className="notion-rich-paste-hint">Markdown из ChatGPT форматируется автоматически при вставке. Таблицы можно редактировать прямо в документе.</p>
    </div>
  );
}

export default MarkdownNoteEditor;
