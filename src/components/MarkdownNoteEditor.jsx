import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {EditorContent, useEditor} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {Markdown} from "@tiptap/markdown";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import {Table, TableCell, TableHeader, TableRow} from "@tiptap/extension-table";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import {AppIcon} from "./ui/index.js";
import {TableSmartDecorations} from "../utils/tableSmartDecorations.js";
import {looksLikeMarkdown, normalizeMarkdownForEditor} from "../utils/noteMarkdown.js";

function ToolButton({active = false, children, className = "", disabled = false, icon, label, onClick, title}) {
  return (
    <button
      aria-label={label}
      className={`notion-rich-tool ${active ? "is-active" : ""} ${className}`}
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
  const [blockMenuOpen, setBlockMenuOpen] = useState(false);
  const [insertMenuOpen, setInsertMenuOpen] = useState(false);
  const [tableMenuOpen, setTableMenuOpen] = useState(false);
  const toolbarRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (toolbarRef.current && !toolbarRef.current.contains(event.target)) {
        setBlockMenuOpen(false);
        setInsertMenuOpen(false);
        setTableMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const setLink = useCallback(() => {
    const previousUrl = editor?.getAttributes("link")?.href || "";
    const url = window.prompt("Ссылка", previousUrl || "https://");
    if (url === null) return;
    if (!url.trim()) {
      editor?.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor?.chain().focus().extendMarkRange("link").setLink({href: url.trim()}).run();
  }, [editor]);

  if (!editor) return null;

  const inTable = editor.isActive("table");

  let currentBlockLabel = "Абзац";
  if (editor.isActive("heading", {level: 1})) currentBlockLabel = "Заголовок 1";
  else if (editor.isActive("heading", {level: 2})) currentBlockLabel = "Заголовок 2";
  else if (editor.isActive("heading", {level: 3})) currentBlockLabel = "Заголовок 3";

  return (
    <div className="notion-rich-toolbar" ref={toolbarRef} role="toolbar" aria-label="Форматирование документа">
      {/* Undo / Redo */}
      <div className="notion-rich-tool-group">
        <ToolButton
          disabled={!editor.can().undo()}
          icon="undo"
          label="Отменить (Ctrl+Z)"
          onClick={() => editor.chain().focus().undo().run()}
        />
        <ToolButton
          disabled={!editor.can().redo()}
          icon="redo"
          label="Повторить (Ctrl+Y)"
          onClick={() => editor.chain().focus().redo().run()}
        />
      </div>

      <div className="notion-rich-tool-divider" />

      {/* Block Type Dropdown */}
      <div className="notion-rich-dropdown-wrap">
        <button
          className="notion-rich-dropdown-btn"
          type="button"
          aria-expanded={blockMenuOpen}
          aria-label="Тип блока"
          onClick={() => {
            setInsertMenuOpen(false);
            setTableMenuOpen(false);
            setBlockMenuOpen((prev) => !prev);
          }}
        >
          <span>{currentBlockLabel}</span>
          <AppIcon name="chevronDown" size="xs" />
        </button>

        {blockMenuOpen && (
          <div className="notion-rich-popover">
            <button
              className={`notion-popover-item ${currentBlockLabel === "Абзац" ? "is-active" : ""}`}
              type="button"
              onClick={() => {
                editor.chain().focus().setParagraph().run();
                setBlockMenuOpen(false);
              }}
            >
              <span>Абзац</span>
            </button>
            <button
              className={`notion-popover-item ${currentBlockLabel === "Заголовок 1" ? "is-active" : ""}`}
              type="button"
              onClick={() => {
                editor.chain().focus().toggleHeading({level: 1}).run();
                setBlockMenuOpen(false);
              }}
            >
              <strong style={{fontSize: "14px"}}>H1 Заголовок 1</strong>
            </button>
            <button
              className={`notion-popover-item ${currentBlockLabel === "Заголовок 2" ? "is-active" : ""}`}
              type="button"
              onClick={() => {
                editor.chain().focus().toggleHeading({level: 2}).run();
                setBlockMenuOpen(false);
              }}
            >
              <strong style={{fontSize: "13px"}}>H2 Заголовок 2</strong>
            </button>
            <button
              className={`notion-popover-item ${currentBlockLabel === "Заголовок 3" ? "is-active" : ""}`}
              type="button"
              onClick={() => {
                editor.chain().focus().toggleHeading({level: 3}).run();
                setBlockMenuOpen(false);
              }}
            >
              <strong style={{fontSize: "12px"}}>H3 Заголовок 3</strong>
            </button>
          </div>
        )}
      </div>

      <div className="notion-rich-tool-divider" />

      {/* Inline Formatting: Bold, Italic, Underline, Strike, Code */}
      <div className="notion-rich-tool-group">
        <ToolButton
          active={editor.isActive("bold")}
          label="Полужирный (Ctrl+B)"
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <strong style={{fontWeight: 700}}>B</strong>
        </ToolButton>
        <ToolButton
          active={editor.isActive("italic")}
          label="Курсив (Ctrl+I)"
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <em style={{fontStyle: "italic", fontFamily: "serif"}}>I</em>
        </ToolButton>
        <ToolButton
          active={editor.isActive("underline")}
          label="Подчёркнутый (Ctrl+U)"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <span style={{textDecoration: "underline"}}>U</span>
        </ToolButton>
        <ToolButton
          active={editor.isActive("strike")}
          label="Зачёркнутый"
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <span style={{textDecoration: "line-through"}}>S</span>
        </ToolButton>
        <ToolButton
          active={editor.isActive("code")}
          label="Инлайн-код"
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          <span style={{fontFamily: "monospace", fontSize: "11px"}}>&lt;/&gt;</span>
        </ToolButton>
      </div>

      <div className="notion-rich-tool-divider" />

      {/* Lists */}
      <div className="notion-rich-tool-group">
        <ToolButton
          active={editor.isActive("bulletList")}
          icon="list"
          label="Маркированный список"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <ToolButton
          active={editor.isActive("orderedList")}
          icon="listOrdered"
          label="Нумерованный список"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />
        <ToolButton
          active={editor.isActive("taskList")}
          icon="checkSquare"
          label="Чек-лист задач"
          onClick={() => editor.chain().focus().toggleTaskList().run()}
        />
      </div>

      <div className="notion-rich-tool-divider" />

      {/* Quote & Link */}
      <div className="notion-rich-tool-group">
        <ToolButton
          active={editor.isActive("blockquote")}
          icon="quote"
          label="Цитата"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        />
        <ToolButton
          active={editor.isActive("link")}
          icon="link"
          label="Ссылка"
          onClick={setLink}
        />
      </div>

      <div className="notion-rich-tool-divider" />

      {/* Table Actions */}
      <div className="notion-rich-tool-group">
        {!inTable ? (
          <ToolButton
            icon="table"
            label="Вставить таблицу"
            onClick={() => editor.chain().focus().insertTable({rows: 4, cols: 5, withHeaderRow: true}).run()}
          >
            Таблица
          </ToolButton>
        ) : (
          <div className="notion-rich-dropdown-wrap">
            <button
              className="notion-rich-dropdown-btn is-in-table"
              type="button"
              aria-expanded={tableMenuOpen}
              aria-label="Управление таблицей"
              onClick={() => {
                setBlockMenuOpen(false);
                setInsertMenuOpen(false);
                setTableMenuOpen((prev) => !prev);
              }}
            >
              <AppIcon name="table" size="xs" />
              <span>Таблица</span>
              <AppIcon name="chevronDown" size="xs" />
            </button>

            {tableMenuOpen && (
              <div className="notion-rich-popover is-right-aligned">
                <button
                  className="notion-popover-item"
                  type="button"
                  onClick={() => {
                    editor.chain().focus().addRowAfter().run();
                    setTableMenuOpen(false);
                  }}
                >
                  <AppIcon name="plus" size="xs" />
                  <span>Добавить строку ниже</span>
                </button>
                <button
                  className="notion-popover-item"
                  type="button"
                  onClick={() => {
                    editor.chain().focus().addColumnAfter().run();
                    setTableMenuOpen(false);
                  }}
                >
                  <AppIcon name="plus" size="xs" />
                  <span>Добавить колонку справа</span>
                </button>
                <button
                  className="notion-popover-item"
                  type="button"
                  onClick={() => {
                    editor.chain().focus().deleteRow().run();
                    setTableMenuOpen(false);
                  }}
                >
                  <AppIcon name="minus" size="xs" />
                  <span>Удалить текущую строку</span>
                </button>
                <button
                  className="notion-popover-item"
                  type="button"
                  onClick={() => {
                    editor.chain().focus().deleteColumn().run();
                    setTableMenuOpen(false);
                  }}
                >
                  <AppIcon name="minus" size="xs" />
                  <span>Удалить текущую колонку</span>
                </button>
                <div className="notion-popover-separator" />
                <button
                  className="notion-popover-item is-danger"
                  type="button"
                  onClick={() => {
                    editor.chain().focus().deleteTable().run();
                    setTableMenuOpen(false);
                  }}
                >
                  <AppIcon name="trash" size="xs" />
                  <span>Удалить таблицу</span>
                </button>
              </div>
            )}
          </div>
        )}

        {inTable ? (
          <>
            <ToolButton
              className="notion-tool-compact"
              label="Добавить строку"
              onClick={() => editor.chain().focus().addRowAfter().run()}
            >
              + стр
            </ToolButton>
            <ToolButton
              className="notion-tool-compact"
              label="Добавить колонку"
              onClick={() => editor.chain().focus().addColumnAfter().run()}
            >
              + кол
            </ToolButton>
          </>
        ) : null}
      </div>

      <div className="notion-rich-tool-divider" />

      {/* Insert Menu Dropdown */}
      <div className="notion-rich-dropdown-wrap">
        <button
          className="notion-rich-dropdown-btn"
          type="button"
          aria-expanded={insertMenuOpen}
          aria-label="Вставить блок"
          onClick={() => {
            setBlockMenuOpen(false);
            setTableMenuOpen(false);
            setInsertMenuOpen((prev) => !prev);
          }}
        >
          <AppIcon name="plus" size="xs" />
          <span>Вставить</span>
          <AppIcon name="chevronDown" size="xs" />
        </button>

        {insertMenuOpen && (
          <div className="notion-rich-popover is-right-aligned">
            <button
              className="notion-popover-item"
              type="button"
              onClick={() => {
                editor.chain().focus().insertTable({rows: 4, cols: 5, withHeaderRow: true}).run();
                setInsertMenuOpen(false);
              }}
            >
              <AppIcon name="table" size="xs" />
              <span>Таблица (4×5)</span>
            </button>
            <button
              className="notion-popover-item"
              type="button"
              onClick={() => {
                editor.chain().focus().toggleTaskList().run();
                setInsertMenuOpen(false);
              }}
            >
              <AppIcon name="checkSquare" size="xs" />
              <span>Чек-лист задач</span>
            </button>
            <button
              className="notion-popover-item"
              type="button"
              onClick={() => {
                editor.chain().focus().toggleBlockquote().run();
                setInsertMenuOpen(false);
              }}
            >
              <AppIcon name="quote" size="xs" />
              <span>Цитата / Выделение</span>
            </button>
            <button
              className="notion-popover-item"
              type="button"
              onClick={() => {
                editor.chain().focus().setHorizontalRule().run();
                setInsertMenuOpen(false);
              }}
            >
              <AppIcon name="minus" size="xs" />
              <span>Разделительная линия</span>
            </button>
            <button
              className="notion-popover-item"
              type="button"
              onClick={() => {
                editor.chain().focus().toggleCodeBlock().run();
                setInsertMenuOpen(false);
              }}
            >
              <span style={{fontFamily: "monospace", fontSize: "11px"}}>&lt;/&gt;</span>
              <span>Блок кода</span>
            </button>
          </div>
        )}
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
    Underline,
    TaskList,
    TaskItem.configure({nested: true}),
    Table.configure({resizable: true}),
    TableRow,
    TableHeader,
    TableCell,
    TableSmartDecorations,
    Placeholder.configure({placeholder: "Начните писать или вставьте готовый план/документ…"}),
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
        <button
          type="button"
          className="notion-rich-add-paragraph"
          onClick={() => {
            editor?.chain().focus("end").insertContent("<p></p>").run();
          }}
        >
          <AppIcon name="plus" size="xs" />
          <span>Добавить текст / блок ниже таблицы</span>
        </button>
      </div>
      <p className="notion-rich-paste-hint">Markdown форматируется автоматически при вставке. Таблицы можно редактировать и масштабировать прямо в документе.</p>
    </div>
  );
}

export default MarkdownNoteEditor;
