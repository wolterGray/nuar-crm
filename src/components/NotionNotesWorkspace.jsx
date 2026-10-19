import {memo, useCallback, useEffect, useMemo, useRef, useState} from "react";
import {DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors} from "@dnd-kit/core";
import {CSS} from "@dnd-kit/utilities";
import "./NotionNotesWorkspace.css";
import {useBreakpoint} from "../hooks/useBreakpoint.js";
import {AppIcon, Badge, Button, IconButton} from "./ui/index.js";
import NoteAttachments from "./NoteAttachments.jsx";
import {
  deleteNotePermanently,
  fetchNoteAttachmentBlob,
  fetchNoteAttachments,
  fetchNoteRevisions,
  fetchNotesTrash,
  restoreDeletedNote,
} from "../api/notes.js";
import {
  NOTION_NOTE_CATEGORIES,
  NOTION_NOTE_TEMPLATES,
  POPULAR_EMOJIS,
} from "../constants/notionNotes.js";

const getNoteIcon = (note) => {
  const payloadIcon = note?.payload?.icon;
  if (payloadIcon) return payloadIcon;
  const category = note?.priority;
  const catObj = NOTION_NOTE_CATEGORIES.find((c) => c.id === category);
  return catObj?.emoji || "📄";
};

const formatNoteDate = (isoString) => {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return "";
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return `сегодня, ${d.toLocaleTimeString("ru-RU", {hour: "2-digit", minute: "2-digit"})}`;
    }
    return d.toLocaleDateString("ru-RU", {day: "numeric", month: "short"});
  } catch {
    return "";
  }
};

const stripMarkdownForSnippet = (text = "") => {
  return text
    .replace(/^#+\s+/gm, "")
    .replace(/^-\s*\[[ xX]\]\s*/gm, "")
    .replace(/^[•\-*]\s+/gm, "")
    .replace(/^>\s*/gm, "")
    .replace(/\n+/g, " ")
    .trim();
};

const NOTE_VIEW_STORAGE_KEY = "nuar-crm-notes-view-v1";
const NOTE_BOARD_COLUMNS = [
  {id: "inbox", label: "Входящие"},
  {id: "idea", label: "Идеи"},
  {id: "planned", label: "Запланировано"},
  {id: "active", label: "В работе"},
  {id: "done", label: "Готово"},
];

function NoteCover({noteId}) {
  const [coverUrl, setCoverUrl] = useState("");

  useEffect(() => {
    let objectUrl = "";
    let cancelled = false;
    fetchNoteAttachments(noteId)
      .then((items) => items.find((item) => String(item.mime_type).startsWith("image/")))
      .then((cover) => cover ? fetchNoteAttachmentBlob(cover.id) : null)
      .then((blob) => {
        if (!blob || cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setCoverUrl(objectUrl);
      })
      .catch(() => setCoverUrl(""));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [noteId]);

  return coverUrl ? <img alt="" className="notion-visual-card-cover" loading="lazy" src={coverUrl} /> : null;
}

function NoteVisualCard({draggable = true, note, onOpen, showCover = false}) {
  const {attributes, listeners, setNodeRef, transform, isDragging} = useDraggable({id: `note:${note.id}`, disabled: !draggable});
  return (
    <article
      className={`notion-visual-card ${isDragging ? "is-dragging" : ""}`}
      ref={setNodeRef}
      style={{transform: CSS.Translate.toString(transform)}}
      {...attributes}
    >
      <button className="notion-visual-card-main" type="button" onClick={() => onOpen(note.id)}>
        {showCover ? <NoteCover noteId={note.id} /> : null}
        <span className="notion-visual-card-icon">{getNoteIcon(note)}</span>
        <strong>{note.title || "Без названия"}</strong>
        <p>{stripMarkdownForSnippet(note.note || note.description) || "Пустая заметка"}</p>
        <small>{note.priority || "Без категории"} · {formatNoteDate(note.updatedAt || note.createdAt)}</small>
      </button>
      {draggable ? <IconButton aria-label="Переместить карточку" className="notion-card-drag" icon="grip" size="sm" variant="ghost" {...listeners} /> : null}
    </article>
  );
}

function NoteBoardColumn({column, notes, onOpen}) {
  const {isOver, setNodeRef} = useDroppable({id: `note-status:${column.id}`});
  return (
    <section className={`notion-board-column ${isOver ? "is-over" : ""}`} ref={setNodeRef}>
      <header><strong>{column.label}</strong><Badge size="sm" variant="neutral">{notes.length}</Badge></header>
      <div className="notion-board-column-list">
        {notes.map((note) => <NoteVisualCard key={note.id} note={note} onOpen={onOpen} />)}
      </div>
    </section>
  );
}

function NotionMarkdownRenderer({ content = "", onToggleCheckbox }) {
  const lines = useMemo(() => content.split("\n"), [content]);

  if (!content.trim()) {
    return (
      <div className="notion-empty-content-hint">
        <p>Страница пуста. Введите текст в редакторе или используйте блоки выше для структуры процесса.</p>
      </div>
    );
  }

  return (
    <div className="notion-rendered-doc">
      {lines.map((line, index) => {
        const trimmed = line.trim();

        // 1. Checklist item
        const checkMatch = line.match(/^(\s*-\s*\[)([ xX])(\]\s*)(.*)$/);
        if (checkMatch) {
          const isChecked = checkMatch[2].toLowerCase() === "x";
          const labelText = checkMatch[4];
          return (
            <div
              className={`notion-checklist-row ${isChecked ? "is-checked" : ""}`}
              key={`line-${index}`}
              onClick={() => onToggleCheckbox?.(index)}
            >
              <span
                aria-checked={isChecked}
                className={`notion-custom-checkbox ${isChecked ? "is-checked" : ""}`}
                role="checkbox"
              >
                {isChecked ? <AppIcon name="check" size="xs" /> : null}
              </span>
              <span className="notion-checklist-label">{labelText || "Пустой пункт"}</span>
            </div>
          );
        }

        // 2. Heading 2
        if (trimmed.startsWith("## ")) {
          return (
            <h2 className="notion-h2" key={`line-${index}`}>
              {trimmed.replace(/^##\s+/, "")}
            </h2>
          );
        }

        // 3. Heading 1
        if (trimmed.startsWith("# ")) {
          return (
            <h1 className="notion-h1" key={`line-${index}`}>
              {trimmed.replace(/^#\s+/, "")}
            </h1>
          );
        }

        // 4. Heading 3
        if (trimmed.startsWith("### ")) {
          return (
            <h3 className="notion-h3" key={`line-${index}`}>
              {trimmed.replace(/^###\s+/, "")}
            </h3>
          );
        }

        // 5. Callout
        if (trimmed.startsWith("> ")) {
          const calloutText = trimmed.replace(/^>\s*/, "");
          return (
            <div className="notion-callout-box" key={`line-${index}`}>
              <div className="notion-callout-icon">💡</div>
              <div className="notion-callout-body">{calloutText}</div>
            </div>
          );
        }

        // 6. Divider
        if (trimmed === "---" || trimmed === "***") {
          return <hr className="notion-divider" key={`line-${index}`} />;
        }

        // 7. Bullet list
        if (trimmed.startsWith("• ") || trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          return (
            <div className="notion-bullet-row" key={`line-${index}`}>
              <span className="notion-bullet-dot">•</span>
              <span className="notion-bullet-text">{trimmed.replace(/^[•\-*]\s+/, "")}</span>
            </div>
          );
        }

        // 8. Numbered list
        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
        if (numMatch) {
          return (
            <div className="notion-numbered-row" key={`line-${index}`}>
              <span className="notion-numbered-idx">{numMatch[1]}.</span>
              <span className="notion-numbered-text">{numMatch[2]}</span>
            </div>
          );
        }

        // 9. Blank line
        if (!trimmed) {
          return <div className="notion-spacer" key={`line-${index}`} />;
        }

        // 10. Normal paragraph
        return (
          <p className="notion-p" key={`line-${index}`}>
            {line}
          </p>
        );
      })}
    </div>
  );
}

// Inner Editor component keyed by note.id so states initialize cleanly without effects
function NotionDocEditor({
  isMobile,
  note,
  onBackToList,
  onDeleteNote,
  onUpdateNote,
}) {
  const [draftTitle, setDraftTitle] = useState(() => note.title || "");
  const [draftContent, setDraftContent] = useState(() => note.note || note.description || "");
  const [draftCategory, setDraftCategory] = useState(() => note.priority || "Процессы");
  const [draftIcon, setDraftIcon] = useState(() => getNoteIcon(note));
  const [draftPinned, setDraftPinned] = useState(() => Boolean(note.payload?.isPinned));
  const [docMode, setDocMode] = useState("live");
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [revisions, setRevisions] = useState([]);
  const [saveStatus, setSaveStatus] = useState("saved");
  const saveTimeoutRef = useRef(null);
  const pendingUpdatesRef = useRef({});
  const savingRef = useRef(false);
  const mountedRef = useRef(true);
  const versionRef = useRef(Number(note.payload?.noteVersion) || 0);

  const mergePendingUpdates = useCallback((updates) => {
    const current = pendingUpdatesRef.current;
    pendingUpdatesRef.current = {
      ...current,
      ...updates,
      payload: updates.payload
        ? {...(current.payload || {}), ...updates.payload}
        : current.payload,
    };
  }, []);

  const flushSave = useCallback(async () => {
    if (savingRef.current || !Object.keys(pendingUpdatesRef.current).length) return;
    const updates = pendingUpdatesRef.current;
    pendingUpdatesRef.current = {};
    savingRef.current = true;
    if (mountedRef.current) setSaveStatus("saving");
    try {
      const saved = await onUpdateNote?.(note.id, {...updates, expectedVersion: versionRef.current});
      versionRef.current = Number(saved?.payload?.noteVersion) || versionRef.current + 1;
      if (mountedRef.current) setSaveStatus(Object.keys(pendingUpdatesRef.current).length ? "saving" : "saved");
    } catch {
      mergePendingUpdates(updates);
      if (mountedRef.current) setSaveStatus("error");
    } finally {
      savingRef.current = false;
      if (Object.keys(pendingUpdatesRef.current).length && mountedRef.current) {
        saveTimeoutRef.current = window.setTimeout(flushSave, 900);
      }
    }
  }, [mergePendingUpdates, note.id, onUpdateNote]);

  const triggerAutoSave = useCallback(
    (updates) => {
      mergePendingUpdates(updates);
      setSaveStatus("saving");
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = window.setTimeout(flushSave, 700);
    },
    [flushSave, mergePendingUpdates],
  );

  const triggerImmediateSave = useCallback(
    (updates) => {
      mergePendingUpdates(updates);
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      void flushSave();
    },
    [flushSave, mergePendingUpdates],
  );

  useEffect(() => () => {
    mountedRef.current = false;
    if (saveTimeoutRef.current) window.clearTimeout(saveTimeoutRef.current);
    if (Object.keys(pendingUpdatesRef.current).length) {
      void onUpdateNote?.(note.id, {...pendingUpdatesRef.current, expectedVersion: versionRef.current})?.catch(() => {});
    }
  }, [note.id, onUpdateNote]);

  useEffect(() => {
    if (!historyOpen) return;
    fetchNoteRevisions(note.id).then(setRevisions).catch(() => setRevisions([]));
  }, [historyOpen, note.id]);

  const restoreRevision = useCallback((revision) => {
    const nextTitle = revision.title || "Без названия";
    const nextContent = revision.content || "";
    setDraftTitle(nextTitle);
    setDraftContent(nextContent);
    setDraftCategory(revision.priority || "Процессы");
    setHistoryOpen(false);
    triggerImmediateSave({title: nextTitle, note: nextContent, description: nextContent, priority: revision.priority || "Процессы"});
  }, [triggerImmediateSave]);

  const handleTitleChange = useCallback(
    (event) => {
      const nextTitle = event.target.value;
      setDraftTitle(nextTitle);
      triggerAutoSave({ title: nextTitle });
    },
    [triggerAutoSave],
  );

  const handleContentChange = useCallback(
    (event) => {
      const nextContent = event.target.value;
      setDraftContent(nextContent);
      triggerAutoSave({ note: nextContent, description: nextContent });
    },
    [triggerAutoSave],
  );

  const handleCategorySelect = useCallback(
    (category) => {
      setDraftCategory(category);
      setCategoryPickerOpen(false);
      triggerImmediateSave({ priority: category });
    },
    [triggerImmediateSave],
  );

  const handleEmojiSelect = useCallback(
    (emoji) => {
      setDraftIcon(emoji);
      setEmojiPickerOpen(false);
      triggerImmediateSave({
        payload: { ...(note.payload || {}), icon: emoji },
      });
    },
    [note.payload, triggerImmediateSave],
  );

  const handleTogglePin = useCallback(() => {
    const nextPinned = !draftPinned;
    setDraftPinned(nextPinned);
    triggerImmediateSave({
      payload: { ...(note.payload || {}), isPinned: nextPinned },
    });
  }, [draftPinned, note.payload, triggerImmediateSave]);

  const handleToggleCheckbox = useCallback(
    (lineIndex) => {
      const lines = draftContent.split("\n");
      const targetLine = lines[lineIndex];
      if (!targetLine) return;

      const checkMatch = targetLine.match(/^(\s*-\s*\[)([ xX])(\]\s*)(.*)$/);
      if (!checkMatch) return;

      const currentStatus = checkMatch[2].toLowerCase() === "x";
      const newStatus = currentStatus ? " " : "x";
      lines[lineIndex] = `${checkMatch[1]}${newStatus}${checkMatch[3]}${checkMatch[4]}`;

      const nextContent = lines.join("\n");
      setDraftContent(nextContent);
      triggerImmediateSave({ note: nextContent, description: nextContent });
    },
    [draftContent, triggerImmediateSave],
  );

  const insertBlock = useCallback(
    (snippet) => {
      setDocMode("edit");
      setDraftContent((prev) => {
        const next = prev ? `${prev}\n${snippet}` : snippet;
        triggerAutoSave({ note: next, description: next });
        return next;
      });
    },
    [triggerAutoSave],
  );

  return (
    <div className="notion-doc-container">
      {/* Top Header */}
      <header className="notion-doc-header">
        <div className="notion-doc-header-left">
          {isMobile ? (
            <button
              className="notion-back-btn"
              type="button"
              onClick={onBackToList}
            >
              <AppIcon name="chevronLeft" size="sm" />
              <span>К заметкам</span>
            </button>
          ) : null}

          {/* Category Selector Pill */}
          <div className="notion-category-picker-wrap">
            <button
              className="notion-doc-category-btn"
              type="button"
              onClick={() => setCategoryPickerOpen((prev) => !prev)}
            >
              <AppIcon name="tag" size="xs" />
              <span>{draftCategory}</span>
              <AppIcon name="chevronDown" size="xs" />
            </button>

            {categoryPickerOpen ? (
              <>
                <div
                  className="notion-picker-backdrop"
                  onClick={() => setCategoryPickerOpen(false)}
                />
                <div className="notion-category-dropdown">
                  {NOTION_NOTE_CATEGORIES.filter((c) => c.id !== "all").map((cat) => (
                    <button
                      className={`notion-dropdown-item ${draftCategory === cat.id ? "is-active" : ""}`}
                      key={cat.id}
                      type="button"
                      onClick={() => handleCategorySelect(cat.id)}
                    >
                      <span>{cat.emoji}</span>
                      <span>{cat.label}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>

          {/* Pin toggle */}
          <button
            className={`notion-pin-btn ${draftPinned ? "is-pinned" : ""}`}
            title={draftPinned ? "Открепить страницу" : "Закрепить страницу"}
            type="button"
            onClick={handleTogglePin}
          >
            <span>📌</span>
            <span className="notion-pin-label">{draftPinned ? "Закреплено" : "Закрепить"}</span>
          </button>

          {/* Save Status Indicator */}
          <button className={`notion-save-status is-${saveStatus}`} disabled={saveStatus !== "error"} type="button" onClick={() => void flushSave()}>
            {saveStatus === "saving" ? "● Сохранение..." : saveStatus === "error" ? "Не сохранено · повторить" : "✓ Сохранено"}
          </button>
        </div>

        <div className="notion-doc-header-right">
          <IconButton aria-label="История версий" icon="history" size="sm" title="История версий" variant="ghost" onClick={() => setHistoryOpen((current) => !current)} />
          {/* Mode Toggle: View / Edit */}
          <div className="notion-mode-toggle">
            <button
              className={`notion-mode-btn ${docMode === "live" ? "is-active" : ""}`}
              title="Интерактивный вид процесса (кликабельные чек-листы)"
              type="button"
              onClick={() => setDocMode("live")}
            >
              <AppIcon name="checkSquare" size="xs" />
              <span>Процесс</span>
            </button>
            <button
              className={`notion-mode-btn ${docMode === "edit" ? "is-active" : ""}`}
              title="Текстовый редактор"
              type="button"
              onClick={() => setDocMode("edit")}
            >
              <AppIcon name="edit" size="xs" />
              <span>Текст</span>
            </button>
          </div>

          {/* Delete Button */}
          <IconButton
            aria-label="Удалить заметку"
            className="notion-delete-btn"
            icon="trash"
            size="sm"
            title="Удалить страницу"
            variant="ghost"
            onClick={() => onDeleteNote?.(note)}
          />
        </div>
      </header>

      {/* Page Content Canvas */}
      <div className="notion-doc-scrollable">
        {historyOpen ? (
          <section className="notion-history-panel">
            <header><strong>История версий</strong><IconButton aria-label="Закрыть историю" icon="close" size="sm" variant="ghost" onClick={() => setHistoryOpen(false)} /></header>
            {revisions.length ? revisions.map((revision) => <button key={String(revision.id)} type="button" onClick={() => restoreRevision(revision)}><span>{new Date(revision.created_at).toLocaleString("ru-RU")}</span><strong>{revision.title}</strong><small>Версия {revision.version}</small></button>) : <p>Предыдущих версий пока нет</p>}
          </section>
        ) : null}
        {/* Emoji Selector */}
        <div className="notion-icon-row">
          <button
            className="notion-emoji-btn"
            title="Сменить иконку"
            type="button"
            onClick={() => setEmojiPickerOpen((prev) => !prev)}
          >
            {draftIcon}
          </button>

          {emojiPickerOpen ? (
            <>
              <div
                className="notion-picker-backdrop"
                onClick={() => setEmojiPickerOpen(false)}
              />
              <div className="notion-emoji-palette">
                {POPULAR_EMOJIS.map((emoji) => (
                  <button
                    className="notion-emoji-choice"
                    key={emoji}
                    type="button"
                    onClick={() => handleEmojiSelect(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>

        {/* Big Title Input */}
        <input
          className="notion-title-input"
          placeholder="Без названия"
          type="text"
          value={draftTitle}
          onBlur={() => triggerImmediateSave({ title: draftTitle })}
          onChange={handleTitleChange}
        />

        {/* Block Insertion Toolbar */}
        <div className="notion-block-toolbar">
          <span className="notion-block-toolbar-label">Вставить:</span>
          <button
            className="notion-block-tool"
            type="button"
            onClick={() => insertBlock("- [ ] Новый пункт чек-листа")}
          >
            <AppIcon name="checkSquare" size="xs" />
            <span>Чекбокс</span>
          </button>
          <button
            className="notion-block-tool"
            type="button"
            onClick={() => insertBlock("• Пункт списка")}
          >
            <AppIcon name="list" size="xs" />
            <span>Список</span>
          </button>
          <button
            className="notion-block-tool"
            type="button"
            onClick={() => insertBlock("1. Первый шаг")}
          >
            <AppIcon name="listOrdered" size="xs" />
            <span>Шаги</span>
          </button>
          <button
            className="notion-block-tool"
            type="button"
            onClick={() => insertBlock("## Новый раздел процесса")}
          >
            <AppIcon name="heading" size="xs" />
            <span>Раздел H2</span>
          </button>
          <button
            className="notion-block-tool"
            type="button"
            onClick={() => insertBlock("> 💡 Важное замечание: ")}
          >
            <AppIcon name="lightbulb" size="xs" />
            <span>Выноска</span>
          </button>
          <button
            className="notion-block-tool"
            type="button"
            onClick={() => insertBlock("---")}
          >
            <AppIcon name="minus" size="xs" />
            <span>Линия</span>
          </button>
        </div>

        {/* Document Body */}
        {docMode === "live" ? (
          <div className="notion-live-area">
            <NotionMarkdownRenderer
              content={draftContent}
              onToggleCheckbox={handleToggleCheckbox}
            />
            <div className="notion-live-bottom-hint">
              <span>💡 Чекбоксы кликабельны прямо в процессе работы. Для добавления или изменения текста нажмите «Текст» вверху.</span>
            </div>
          </div>
        ) : (
          <div className="notion-editor-area">
            <textarea
              className="notion-textarea"
              placeholder="Опишите процесс, регламент, чек-лист или идею... Поддерживаются списки (- [ ] чекбоксы, • списки, ## заголовки)"
              rows={16}
              value={draftContent}
              onBlur={() => triggerImmediateSave({ note: draftContent, description: draftContent })}
              onChange={handleContentChange}
            />
          </div>
        )}
        <NoteAttachments noteId={note.id} />
      </div>
    </div>
  );
}

function NotionNotesWorkspace({
  notes = [],
  onAddNote,
  onDeleteNote,
  onUpdateNote,
}) {
  const {isMobile} = useBreakpoint();
  const [selectedNoteId, setSelectedNoteId] = useState(null);
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [viewMode, setViewMode] = useState(() => window.localStorage.getItem(NOTE_VIEW_STORAGE_KEY) || "list");
  const [trashNotes, setTrashNotes] = useState([]);
  const [restoredNotes, setRestoredNotes] = useState([]);
  const [trashStatus, setTrashStatus] = useState("");
  const boardSensors = useSensors(useSensor(PointerSensor, {activationConstraint: {distance: 6}}));

  const visibleNotes = useMemo(() => {
    const existingIds = new Set(notes.map((note) => String(note.id)));
    return [...notes, ...restoredNotes.filter((note) => !existingIds.has(String(note.id)))];
  }, [notes, restoredNotes]);

  useEffect(() => window.localStorage.setItem(NOTE_VIEW_STORAGE_KEY, viewMode), [viewMode]);
  useEffect(() => {
    if (viewMode !== "trash") return;
    fetchNotesTrash()
      .then((items) => { setTrashNotes(Array.isArray(items) ? items : []); setTrashStatus(""); })
      .catch(() => setTrashStatus("error"));
  }, [viewMode]);

  // Derive resolved note ID (first note if desktop and none explicitly chosen)
  const resolvedActiveNoteId = useMemo(() => {
    if (selectedNoteId) return selectedNoteId;
    if (!isMobile && visibleNotes.length > 0) return visibleNotes[0].id;
    return null;
  }, [selectedNoteId, isMobile, visibleNotes]);

  const activeNote = useMemo(
    () => visibleNotes.find((n) => String(n.id) === String(resolvedActiveNoteId)) || null,
    [visibleNotes, resolvedActiveNoteId],
  );

  // Create Note
  const handleCreateNote = useCallback(
    async (preset = {}) => {
      setTemplatesOpen(false);
      const newTitle = preset.title || "Новый рабочий процесс";
      const newCategory = preset.category || (activeCategory !== "all" ? activeCategory : "Процессы");
      const newContent = preset.content || "";
      const newIcon = preset.icon || "⚙️";

      const created = await onAddNote?.({
        title: newTitle,
        category: newCategory,
        note: newContent,
        payload: {
          icon: newIcon,
          isPinned: false,
        },
      });

      if (created?.id) {
        setSelectedNoteId(created.id);
      }
    },
    [activeCategory, onAddNote],
  );

  // Filtered Notes
  const filteredNotes = useMemo(() => {
    return visibleNotes.filter((item) => {
      const matchCat =
        activeCategory === "all" ||
        item.priority === activeCategory;
      const q = searchQuery.trim().toLowerCase();
      if (!q) return matchCat;
      const matchSearch =
        (item.title || "").toLowerCase().includes(q) ||
        (item.note || item.description || "").toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [visibleNotes, activeCategory, searchQuery]);

  const pinnedNotes = useMemo(
    () => filteredNotes.filter((n) => Boolean(n.payload?.isPinned)),
    [filteredNotes],
  );
  const unpinnedNotes = useMemo(
    () => filteredNotes.filter((n) => !n.payload?.isPinned),
    [filteredNotes],
  );

  const showMobileDoc = isMobile && Boolean(selectedNoteId);

  const handleBoardDragEnd = useCallback(async ({active, over}) => {
    if (!over || !String(over.id).startsWith("note-status:")) return;
    const noteId = String(active.id).replace("note:", "");
    const status = String(over.id).replace("note-status:", "");
    const note = visibleNotes.find((item) => String(item.id) === noteId);
    if (!note || (note.payload?.noteStatus || "inbox") === status) return;
    try {
      const saved = await onUpdateNote?.(note.id, {payload: {...(note.payload || {}), noteStatus: status}});
      if (saved) setRestoredNotes((current) => current.map((item) => String(item.id) === String(saved.id) ? saved : item));
    } catch {
      // The shared notification layer reports the save failure.
    }
  }, [visibleNotes, onUpdateNote]);

  const handleUpdateNote = useCallback(async (id, updates) => {
    const saved = await onUpdateNote?.(id, updates);
    if (saved) {
      setRestoredNotes((current) => current.map((item) => String(item.id) === String(saved.id) ? saved : item));
    }
    return saved;
  }, [onUpdateNote]);

  const handleRestoreNote = useCallback(async (note) => {
    try {
      const restored = await restoreDeletedNote(note.id);
      setTrashNotes((current) => current.filter((item) => String(item.id) !== String(note.id)));
      setRestoredNotes((current) => [restored, ...current.filter((item) => String(item.id) !== String(restored.id))]);
    } catch {
      setTrashStatus("error");
    }
  }, []);

  const handlePermanentDelete = useCallback(async (note) => {
    if (!window.confirm(`Удалить «${note.title || "Без названия"}» без возможности восстановления?`)) return;
    try {
      await deleteNotePermanently(note.id);
      setTrashNotes((current) => current.filter((item) => String(item.id) !== String(note.id)));
    } catch {
      setTrashStatus("error");
    }
  }, []);

  const selectView = useCallback((nextView) => {
    setSelectedNoteId(null);
    if (nextView === "trash") setTrashStatus("loading");
    setViewMode(nextView);
  }, []);

  return (
    <div className="notion-workspace-shell">
      <header className="notion-workspace-toolbar">
        <div className="notion-view-switch" role="tablist" aria-label="Представление заметок">
          <Button leftIcon="list" size="sm" variant={viewMode === "list" ? "secondary" : "ghost"} onClick={() => selectView("list")}>Список</Button>
          <Button leftIcon="columns" size="sm" variant={viewMode === "board" ? "secondary" : "ghost"} onClick={() => selectView("board")}>Доска</Button>
          <Button leftIcon="layoutGrid" size="sm" variant={viewMode === "gallery" ? "secondary" : "ghost"} onClick={() => selectView("gallery")}>Галерея</Button>
          <Button leftIcon="trash" size="sm" variant={viewMode === "trash" ? "secondary" : "ghost"} onClick={() => selectView("trash")}>Корзина</Button>
        </div>
        {viewMode !== "list" && viewMode !== "trash" ? <Button leftIcon="plus" size="sm" variant="primary" onClick={() => handleCreateNote()}>Новая заметка</Button> : null}
      </header>
      {viewMode === "list" ? (
      <div className={`notion-workspace ${isMobile ? "is-mobile" : "is-desktop"}`}>
      {/* SIDEBAR */}
      {(!isMobile || !showMobileDoc) && (
        <aside className="notion-sidebar">
          {/* Header */}
          <div className="notion-sidebar-header">
            <div className="notion-sidebar-title-group">
              <h2 className="notion-sidebar-title">Заметки</h2>
              <Badge size="sm" variant="neutral">
                {visibleNotes.length}
              </Badge>
            </div>
            <div className="notion-sidebar-actions">
              <Button
                className="notion-new-btn"
                leftIcon="plus"
                size="sm"
                variant="primary"
                onClick={() => handleCreateNote()}
              >
                Новая
              </Button>
              <IconButton
                aria-label="Шаблоны процессов"
                className="notion-template-trigger"
                icon="sparkles"
                size="sm"
                title="Готовые шаблоны процессов"
                variant="secondary"
                onClick={() => setTemplatesOpen((prev) => !prev)}
              />
            </div>
          </div>

          {/* Templates popover */}
          {templatesOpen ? (
            <div className="notion-templates-dropdown">
              <div className="notion-templates-head">
                <span>⚡ Быстрые шаблоны процессов</span>
                <button
                  className="notion-templates-close"
                  type="button"
                  onClick={() => setTemplatesOpen(false)}
                >
                  ✕
                </button>
              </div>
              <div className="notion-templates-list">
                {NOTION_NOTE_TEMPLATES.map((tmpl) => (
                  <button
                    className="notion-template-item"
                    key={tmpl.id}
                    type="button"
                    onClick={() => handleCreateNote(tmpl)}
                  >
                    <span className="notion-template-icon">{tmpl.icon}</span>
                    <div className="notion-template-text">
                      <strong>{tmpl.title}</strong>
                      <small>{tmpl.category}</small>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* Search bar */}
          <div className="notion-search-wrap">
            <AppIcon className="notion-search-icon" name="search" size="xs" />
            <input
              className="notion-search-input"
              placeholder="Поиск по заметкам и процессам..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery ? (
              <button
                className="notion-search-clear"
                type="button"
                onClick={() => setSearchQuery("")}
              >
                ✕
              </button>
            ) : null}
          </div>

          {/* Category Chips Bar */}
          <div className="notion-category-bar" role="tablist">
            {NOTION_NOTE_CATEGORIES.map((cat) => {
              const count =
                cat.id === "all"
                  ? visibleNotes.length
                  : visibleNotes.filter((n) => n.priority === cat.id).length;
              return (
                <button
                  className={`notion-cat-chip ${activeCategory === cat.id ? "is-active" : ""}`}
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                >
                  <span>{cat.emoji || ""} {cat.label}</span>
                  <span className="notion-cat-count">{count}</span>
                </button>
              );
            })}
          </div>

          {/* Notes List */}
          <div className="notion-notes-list">
            {filteredNotes.length === 0 ? (
              <div className="notion-sidebar-empty">
                <AppIcon name="fileText" size="lg" />
                <p>Заметок не найдено</p>
                <Button size="sm" variant="secondary" onClick={() => handleCreateNote()}>
                  Создать первую
                </Button>
              </div>
            ) : (
              <>
                {pinnedNotes.length > 0 ? (
                  <div className="notion-list-section">
                    <span className="notion-section-label">📌 Закреплённые</span>
                    {pinnedNotes.map((note) => (
                      <article
                        className={`notion-item-card ${resolvedActiveNoteId === note.id ? "is-active" : ""}`}
                        key={note.id}
                        onClick={() => setSelectedNoteId(note.id)}
                      >
                        <span className="notion-item-emoji">{getNoteIcon(note)}</span>
                        <div className="notion-item-body">
                          <h4 className="notion-item-title">{note.title || "Без названия"}</h4>
                          <p className="notion-item-snippet">
                            {stripMarkdownForSnippet(note.note || note.description) || "Пустая страница..."}
                          </p>
                          <div className="notion-item-footer">
                            <span className="notion-item-tag">{note.priority || "Процессы"}</span>
                            <span className="notion-item-date">{formatNoteDate(note.createdAt)}</span>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : null}

                <div className="notion-list-section">
                  {pinnedNotes.length > 0 ? (
                    <span className="notion-section-label">📄 Все страницы</span>
                  ) : null}
                  {unpinnedNotes.map((note) => (
                    <article
                      className={`notion-item-card ${resolvedActiveNoteId === note.id ? "is-active" : ""}`}
                      key={note.id}
                      onClick={() => setSelectedNoteId(note.id)}
                    >
                      <span className="notion-item-emoji">{getNoteIcon(note)}</span>
                      <div className="notion-item-body">
                        <h4 className="notion-item-title">{note.title || "Без названия"}</h4>
                        <p className="notion-item-snippet">
                          {stripMarkdownForSnippet(note.note || note.description) || "Пустая страница..."}
                        </p>
                        <div className="notion-item-footer">
                          <span className="notion-item-tag">{note.priority || "Процессы"}</span>
                          <span className="notion-item-date">{formatNoteDate(note.createdAt)}</span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            )}
          </div>
        </aside>
      )}

      {/* CANVAS */}
      {(!isMobile || showMobileDoc) && (
        <main className="notion-canvas">
          {activeNote ? (
            <NotionDocEditor
              isMobile={isMobile}
              key={activeNote.id}
              note={activeNote}
              onBackToList={() => setSelectedNoteId(null)}
              onDeleteNote={onDeleteNote}
              onUpdateNote={handleUpdateNote}
            />
          ) : (
            <div className="notion-no-doc-selected">
              <span className="notion-empty-icon">📝</span>
              <h3>Выберите заметку или создайте новую</h3>
              <p>Записывайте рабочие процессы студии, регламенты открытия, чек-листы уборки и идеи в удобном стиле Notion.</p>
              <Button leftIcon="plus" variant="primary" onClick={() => handleCreateNote()}>
                Создать страницу процесса
              </Button>
            </div>
          )}
        </main>
      )}
      </div>
      ) : selectedNoteId && activeNote ? (
        <div className="notion-visual-editor">
          <NotionDocEditor
            isMobile
            key={activeNote.id}
            note={activeNote}
            onBackToList={() => setSelectedNoteId(null)}
            onDeleteNote={onDeleteNote}
            onUpdateNote={handleUpdateNote}
          />
        </div>
      ) : (
        <div className="notion-visual-workspace">
          {viewMode !== "trash" ? <div className="notion-visual-filters">
            <div className="notion-search-wrap"><AppIcon className="notion-search-icon" name="search" size="xs" /><input className="notion-search-input" placeholder="Поиск заметок" type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} /></div>
            <div className="notion-category-bar">{NOTION_NOTE_CATEGORIES.map((cat) => <button className={`notion-cat-chip ${activeCategory === cat.id ? "is-active" : ""}`} key={cat.id} type="button" onClick={() => setActiveCategory(cat.id)}><span>{cat.emoji || ""} {cat.label}</span></button>)}</div>
          </div> : null}
          {viewMode === "trash" ? (
            <div className="notion-trash-list">
              {trashStatus === "loading" ? <p>Загрузка корзины…</p> : null}
              {trashStatus === "error" ? <p className="notion-trash-error">Не удалось загрузить корзину</p> : null}
              {!trashStatus && !trashNotes.length ? <div className="notion-trash-empty"><AppIcon name="trash" size="lg" /><strong>Корзина пуста</strong><span>Удалённые заметки можно восстановить отсюда</span></div> : null}
              {trashNotes.map((note) => <article className="notion-trash-card" key={note.id}><div><span>{getNoteIcon(note)}</span><div><strong>{note.title || "Без названия"}</strong><small>Удалено {formatNoteDate(note.payload?.deletedAt)}</small></div></div><div><Button leftIcon="rotateCcw" size="sm" variant="secondary" onClick={() => handleRestoreNote(note)}>Восстановить</Button><IconButton aria-label="Удалить навсегда" icon="trash" size="sm" title="Удалить навсегда" variant="ghost" onClick={() => handlePermanentDelete(note)} /></div></article>)}
            </div>
          ) : viewMode === "board" ? (
            <DndContext sensors={boardSensors} onDragEnd={handleBoardDragEnd}>
              <div className="notion-board">
                {NOTE_BOARD_COLUMNS.map((column) => <NoteBoardColumn column={column} key={column.id} notes={filteredNotes.filter((note) => (note.payload?.noteStatus || "inbox") === column.id)} onOpen={setSelectedNoteId} />)}
              </div>
            </DndContext>
          ) : (
            <div className="notion-gallery">
              {filteredNotes.map((note) => <NoteVisualCard draggable={false} key={note.id} note={note} onOpen={setSelectedNoteId} showCover />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(NotionNotesWorkspace);
