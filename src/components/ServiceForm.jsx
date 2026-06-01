const serviceDurations = [60, 75, 90, 120];

function ServiceForm({service, onSubmit}) {
  const getPrice = (duration) =>
    service?.variants?.find((variant) => variant.duration === duration)?.price ?? "";

  return (
    <section className="panel service-form-panel">
      <h2>{service ? "Редактировать услугу" : "Новая услуга"}</h2>
      <form className="catalog-form" onSubmit={onSubmit}>
        <label>
          Название
          <input name="name" defaultValue={service?.name ?? ""} required />
        </label>
        <label>
          Категория
          <input name="category" defaultValue={service?.category ?? "Массаж"} />
        </label>
        <label>
          Цвет в календаре
          <input
            className="color-input"
            name="color"
            type="color"
            defaultValue={service?.color ?? "#4f8edc"}
          />
        </label>
        <div className="catalog-price-grid">
          {serviceDurations.map((duration) => (
            <label key={duration}>
              {duration} мин
              <input
                name={`price_${duration}`}
                defaultValue={getPrice(duration)}
                placeholder="0"
              />
            </label>
          ))}
        </div>
        <button className="submit-button">
          {service ? "Сохранить услугу" : "Добавить услугу"}
        </button>
      </form>
    </section>
  );
}

export default ServiceForm;
