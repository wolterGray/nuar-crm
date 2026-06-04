function TaskForm({task, onSubmit}) {
  const isNote = task?.type === "note";

  return (
    <form className="catalog-form" onSubmit={onSubmit}>
      <label>
        {isNote ? "Заметка" : "Задача"}
        <input
          name="title"
          defaultValue={task?.title ?? ""}
          placeholder={isNote ? "Например: идея для салона" : "Например: заказать масло"}
          required
        />
      </label>
      {isNote ? (
        <label>
          Категория
          <select name="priority" defaultValue={task?.priority ?? "Мысль"}>
            <option>Мысль</option>
            <option>Заказать</option>
            <option>Идея</option>
            <option>Личное</option>
          </select>
        </label>
      ) : (
        <div className="form-split">
          <label>
            Срок
            <input
              name="dueDate"
              type="date"
              defaultValue={task?.dueDate ?? ""}
            />
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
      )}
      <label>
        {isNote ? "Детали" : "Комментарий"}
        <textarea name="note" defaultValue={task?.note ?? ""} rows="3" />
      </label>
      <button className="submit-button">
        {task ? "Сохранить" : "Добавить задачу"}
      </button>
    </form>
  );
}

export default TaskForm;
