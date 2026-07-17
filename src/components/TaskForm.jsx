import {Button, Field, Input, Select, Textarea} from "./ui/index.js";

function TaskForm({task, onSubmit}) {
  const isNote = task?.type === "note";

  return (
    <form className="catalog-form" onSubmit={onSubmit}>
      <Field label={isNote ? "Заметка" : "Задача"}>
        <Input
          name="title"
          defaultValue={task?.title ?? ""}
          placeholder={isNote ? "Например: идея для салона" : "Например: заказать масло"}
          required
        />
      </Field>
      {isNote ? (
        <Field label="Категория">
          <Select name="priority" defaultValue={task?.priority ?? "Мысль"}>
            <option>Мысль</option>
            <option>Заказать</option>
            <option>Идея</option>
            <option>Личное</option>
          </Select>
        </Field>
      ) : (
        <div className="form-split">
          <Field label="Срок">
            <Input
              name="dueDate"
              type="date"
              defaultValue={task?.dueDate ?? ""}
            />
          </Field>
          <Field label="Приоритет">
            <Select name="priority" defaultValue={task?.priority ?? "Средний"}>
              <option>Низкий</option>
              <option>Средний</option>
              <option>Высокий</option>
            </Select>
          </Field>
        </div>
      )}
      <Field label={isNote ? "Детали" : "Комментарий"}>
        <Textarea name="note" defaultValue={task?.note ?? ""} rows="3" />
      </Field>
      <Button
        className="crm-primary-action task-submit-button"
        size="lg"
        type="submit"
        variant="primary">
        {task ? "Сохранить" : "Добавить задачу"}
      </Button>
    </form>
  );
}

export default TaskForm;
