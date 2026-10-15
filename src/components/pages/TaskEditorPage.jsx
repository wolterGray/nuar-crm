import {useCallback, useEffect, useRef, useState} from "react";
import TaskForm from "../TaskForm.jsx";
import {Button, IconButton} from "../ui/index.js";
import {getTaskAreaLabel} from "../../utils/operationsPlanner.js";

export default function TaskEditorPage({employees, onClose, onDirtyChange, onSubmit, task}) {
  const dirtyRef = useRef(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const areaName = getTaskAreaLabel(task);
  const title = task?.id ? task.title || "Редактирование задачи" : "Новая задача";

  const requestClose = useCallback(() => {
    if (saving) return;
    if (dirtyRef.current) {
      document.getElementById("task-editor-form")?.requestSubmit();
      return;
    }
    onClose();
  }, [onClose, saving]);

  useEffect(() => {
    const warnBeforeLeave = (event) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeave);
    return () => window.removeEventListener("beforeunload", warnBeforeLeave);
  }, []);

  const handleSubmit = async (event) => {
    setSaving(true);
    await onSubmit(event);
    setSaving(false);
  };
  const handleDirtyChange = useCallback((nextDirty) => {
    dirtyRef.current = nextDirty;
    setDirty(nextDirty);
    onDirtyChange(nextDirty);
  }, [onDirtyChange]);

  return <div className="task-drawer-layer">
    <button aria-label="Закрыть редактор" className="task-drawer-backdrop" type="button" onClick={requestClose} />
    <aside aria-label="Редактор задачи" className="task-drawer">
      <header className="task-drawer-header">
        <div><span>{areaName}</span><h1>{title}</h1></div>
        <IconButton icon="x" label="Закрыть и сохранить" variant="ghost" onClick={requestClose} />
      </header>
      <TaskForm employees={employees} formId="task-editor-form" layout="drawer" saving={saving} task={task} onCancel={requestClose} onDirtyChange={handleDirtyChange} onSubmit={handleSubmit} />
      <footer className="task-drawer-footer"><span>{dirty ? "Есть несохранённые изменения" : "Изменения сохранены"}</span><Button form="task-editor-form" leftIcon="save" loading={saving} type="submit" variant="primary">Сохранить</Button></footer>
    </aside>
  </div>;
}
