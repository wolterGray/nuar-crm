function TaskForm({task, onSubmit}) {
  return (
    <form className="catalog-form" onSubmit={onSubmit}>
      <label>
        Задача
        <input name="title" defaultValue={task?.title ?? ""} placeholder="Например: заказать масло" required />
      </label>
      <div className="form-split">
        <label>
          Срок
          <input name="dueDate" type="date" defaultValue={task?.dueDate ?? ""} />
        </label>
        <label>
          Приоритет
          <select name="priority" defaultValue={task?.priority ?? "Средний"}>
            <option>Низкий</option>
            <option>Средний</option>
            <option>Высокий</option>
          </select>
        </label>
      </div>
      <label>
        Комментарий
        <textarea name="note" defaultValue={task?.note ?? ""} rows="3" />
      </label>
      <button className="submit-button">{task ? "Сохранить" : "Добавить задачу"}</button>
    </form>
  );
}

export default TaskForm;

