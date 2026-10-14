import {useCallback, useEffect, useRef, useState} from "react";
import TaskForm from "../TaskForm.jsx";
import {Button} from "../ui/index.js";
import {getTaskPayload} from "../../utils/operationsPlanner.js";

const AREA_LABELS = {
  acquisition: "Привлечение новых клиентов",
  general: "Другие задачи",
};

export default function TaskEditorPage({employees, onClose, onDirtyChange, onSubmit, task}) {
  const dirtyRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const payload = getTaskPayload(task);
  const areaName = AREA_LABELS[payload.areaId] ?? "Рабочий план";
  const title = task?.id ? task.title || "Редактирование задачи" : "Новая задача";

  const requestClose = useCallback(() => {
    if (dirtyRef.current && !window.confirm("Вернуться к плану? Несохранённые изменения будут потеряны.")) return;
    dirtyRef.current = false;
    onClose();
  }, [onClose]);

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

  return (
    <main className="task-workspace-page">
      <header className="task-workspace-header">
        <div className="task-workspace-heading">
          <Button leftIcon="chevronLeft" type="button" variant="ghost" onClick={requestClose}>
            К плану работы
          </Button>
          <div>
            <span>{areaName}</span>
            <h1>{title}</h1>
          </div>
        </div>
        <Button form="task-editor-form" leftIcon="save" loading={saving} type="submit" variant="primary">
          Сохранить изменения
        </Button>
      </header>

      <TaskForm
        employees={employees}
        formId="task-editor-form"
        layout="page"
        saving={saving}
        task={task}
        onCancel={requestClose}
        onDirtyChange={(dirty) => {
          dirtyRef.current = dirty;
          onDirtyChange(dirty);
        }}
        onSubmit={handleSubmit}
      />
    </main>
  );
}
