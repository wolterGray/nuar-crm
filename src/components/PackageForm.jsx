import {Button, Field, Input, Select} from "./ui/index.js";

function PackageForm({packageItem, services, onSubmit}) {
  return (
    <section className="panel package-form-panel package-form-sheet-root">
      <h2>{packageItem ? "Редактировать пакет" : "Новый пакет"}</h2>
      <form className="catalog-form" onSubmit={onSubmit}>
        <Field label="Название">
          <Input name="name" defaultValue={packageItem?.name ?? ""} required />
        </Field>
        <Field label="Услуга">
          <Select name="service" defaultValue={packageItem?.service ?? services[0] ?? ""}>
            {services.map((service) => (
              <option key={service}>{service}</option>
            ))}
          </Select>
        </Field>
        <Field label="Количество визитов">
          <Input name="visitsCount" defaultValue={packageItem?.visitsCount ?? ""} />
        </Field>
        <Field label="Стоимость">
          <Input name="price" defaultValue={packageItem?.price ?? ""} />
        </Field>
        <Field label="Срок действия, дней">
          <Input name="validityDays" defaultValue={packageItem?.validityDays ?? ""} />
        </Field>
        <Field label="Статус">
          <Select name="status" defaultValue={packageItem?.status ?? "Активен"}>
            <option>Активен</option>
            <option>Пауза</option>
            <option>Архив</option>
          </Select>
        </Field>
        <Button
          className="crm-primary-action package-form-submit"
          size="lg"
          type="submit"
          variant="primary">
          {packageItem ? "Сохранить пакет" : "Добавить пакет"}
        </Button>
      </form>
    </section>
  );
}

export default PackageForm;
