function SupplyForm({supply, onSubmit}) {
  return (
    <form className="catalog-form" onSubmit={onSubmit}>
      <label>
        Название
        <input name="name" defaultValue={supply?.name ?? ""} placeholder="Например: массажное масло" required />
      </label>
      <div className="form-split">
        <label>
          Остаток
          <input min="0" name="stock" type="number" defaultValue={supply?.stock ?? 0} />
        </label>
        <label>
          Минимальный остаток
          <input min="0" name="minStock" type="number" defaultValue={supply?.minStock ?? 0} />
        </label>
      </div>
      <div className="form-split">
        <label>
          Единица
          <select name="unit" defaultValue={supply?.unit ?? "шт."}>
            <option>шт.</option>
            <option>л</option>
            <option>мл</option>
            <option>уп.</option>
            <option>рулон</option>
          </select>
        </label>
        <label>
          Стоимость
          <input min="0" name="cost" type="number" step="0.01" defaultValue={supply?.cost ?? 0} />
        </label>
      </div>
      <label>
        Комментарий
        <textarea name="note" defaultValue={supply?.note ?? ""} rows="3" />
      </label>
      <button className="submit-button">{supply ? "Сохранить" : "Добавить расходник"}</button>
    </form>
  );
}

export default SupplyForm;

