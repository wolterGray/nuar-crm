import {useCallback, useEffect, useRef, useState} from "react";
import {
  deleteNoteAttachment,
  fetchNoteAttachmentBlob,
  fetchNoteAttachments,
  uploadNoteAttachment,
} from "../api/notes.js";
import {AppIcon, Button, IconButton} from "./ui/index.js";

const ACCEPTED_TYPES = new Set(["image/gif", "image/jpeg", "image/png", "image/webp", "application/pdf"]);
const MAX_FILE_SIZE = 8 * 1024 * 1024;

function AttachmentPreview({attachment}) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    let currentUrl = "";
    let cancelled = false;
    fetchNoteAttachmentBlob(attachment.id)
      .then((blob) => {
        if (cancelled) return;
        currentUrl = URL.createObjectURL(blob);
        setUrl(currentUrl);
      })
      .catch(() => setUrl(""));
    return () => {
      cancelled = true;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [attachment.id]);

  if (!url) return <div className="note-attachment-placeholder"><AppIcon name="loader" size="md" spin /></div>;
  if (attachment.mime_type === "application/pdf") {
    return <a className="note-attachment-file" href={url} rel="noreferrer" target="_blank"><AppIcon name="fileText" size="lg" /><span>{attachment.file_name}</span></a>;
  }
  return <a href={url} rel="noreferrer" target="_blank"><img alt={attachment.file_name} loading="lazy" src={url} /></a>;
}

export default function NoteAttachments({noteId}) {
  const inputRef = useRef(null);
  const [attachments, setAttachments] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [status, setStatus] = useState({error: "", uploading: false});

  const loadAttachments = useCallback(() => {
    fetchNoteAttachments(noteId)
      .then((items) => setAttachments(Array.isArray(items) ? items : []))
      .catch(() => setStatus({error: "Материалы временно недоступны", uploading: false}));
  }, [noteId]);

  useEffect(() => loadAttachments(), [loadAttachments]);

  const uploadFiles = useCallback(async (files) => {
    const accepted = [...files].filter((file) => ACCEPTED_TYPES.has(file.type) && file.size <= MAX_FILE_SIZE);
    if (!accepted.length) {
      setStatus({error: "Поддерживаются изображения и PDF до 8 МБ", uploading: false});
      return;
    }
    setStatus({error: "", uploading: true});
    try {
      for (const file of accepted) await uploadNoteAttachment(noteId, file);
      loadAttachments();
      setStatus({error: "", uploading: false});
    } catch (error) {
      setStatus({error: error.message || "Файл не загружен", uploading: false});
    }
  }, [loadAttachments, noteId]);

  useEffect(() => {
    const handlePaste = (event) => {
      const files = [...(event.clipboardData?.files ?? [])];
      if (!files.length) return;
      event.preventDefault();
      uploadFiles(files);
    };
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [uploadFiles]);

  const removeAttachment = async (attachmentId) => {
    try {
      await deleteNoteAttachment(attachmentId);
      setAttachments((current) => current.filter((item) => item.id !== attachmentId));
    } catch (error) {
      setStatus({error: error.message || "Файл не удалён", uploading: false});
    }
  };

  return (
    <section
      className={`note-attachments ${dragActive ? "is-dragging" : ""}`}
      onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }}
      onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragActive(false); }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => { event.preventDefault(); setDragActive(false); uploadFiles(event.dataTransfer.files); }}
    >
      <header className="note-attachments-header">
        <div><AppIcon name="image" size="sm" /><strong>Материалы</strong><span>{attachments.length || ""}</span></div>
        <Button disabled={status.uploading} leftIcon={status.uploading ? "loader" : "upload"} size="sm" variant="secondary" onClick={() => inputRef.current?.click()}>
          {status.uploading ? "Загрузка…" : "Добавить"}
        </Button>
        <input ref={inputRef} accept="image/png,image/jpeg,image/webp,image/gif,application/pdf" hidden multiple type="file" onChange={(event) => { uploadFiles(event.target.files); event.target.value = ""; }} />
      </header>
      {status.error ? <p className="note-attachments-error" role="alert">{status.error}</p> : null}
      {attachments.length ? (
        <div className="note-attachments-grid">
          {attachments.map((attachment) => (
            <article className="note-attachment-card" key={attachment.id}>
              <AttachmentPreview attachment={attachment} />
              <div className="note-attachment-meta"><span title={attachment.file_name}>{attachment.file_name}</span><IconButton aria-label="Удалить вложение" icon="trash" size="sm" variant="ghost" onClick={() => removeAttachment(attachment.id)} /></div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
