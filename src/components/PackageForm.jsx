function PackageForm({packageItem, services, onSubmit}) {
  return (
    <section className="panel package-form-panel package-form-sheet-root">
      <h2>{packageItem ? "Редактировать пакет" : "Новый пакет"}</h2>
      <form className="catalog-form" onSubmit={onSubmit}>
        <label>
          Название
          <input name="name" defaultValue={packageItem?.name ?? ""} required />
        </label>
        <label>
          Услуга
          <select name="service" defaultValue={packageItem?.service ?? services[0] ?? ""}>
            {services.map((service) => (
              <option key={service}>{service}</option>
            ))}
          </select>
        </label>
        <label>
          Количество визитов
          <input name="visitsCount" defaultValue={packageItem?.visitsCount ?? ""} />
        </label>
        <label>
          Стоимость
          <input name="price" defaultValue={packageItem?.price ?? ""} />
        </label>
        <label>
          Срок действия, дней
          <input name="validityDays" defaultValue={packageItem?.validityDays ?? ""} />
        </label>
        <label>
          Статус
          <select name="status" defaultValue={packageItem?.status ?? "Активен"}>
            <option>Активен</option>
            <option>Пауза</option>
            <option>Архив</option>
          </select>
        </label>
        <button className="submit-button">
          {packageItem ? "Сохранить пакет" : "Добавить пакет"}
        </button>
      </form>
    </section>
  );
}

export default PackageForm;
