import {Button, Field, Input, Select, Textarea} from "./ui/index.js";

function SupplyForm({supply, onSubmit}) {
  return (
    <form className="catalog-form" onSubmit={onSubmit}>
      <Field label="Название" required>
        <Input name="name" defaultValue={supply?.name ?? ""} placeholder="Например: массажное масло" required />
      </Field>
      <div className="form-split">
        <Field label="Остаток">
          <Input min="0" name="stock" type="number" defaultValue={supply?.stock ?? 0} />
        </Field>
        <Field label="Минимальный остаток">
          <Input min="0" name="minStock" type="number" defaultValue={supply?.minStock ?? 0} />
        </Field>
      </div>
      <div className="form-split">
        <Field label="Единица">
          <Select name="unit" defaultValue={supply?.unit ?? "шт."}>
            <option>шт.</option>
            <option>л</option>
            <option>мл</option>
            <option>уп.</option>
            <option>рулон</option>
          </Select>
        </Field>
        <Field label="Стоимость">
          <Input min="0" name="cost" type="number" step="0.01" defaultValue={supply?.cost ?? 0} />
        </Field>
      </div>
      <Field label="Комментарий">
        <Textarea name="note" defaultValue={supply?.note ?? ""} rows="3" />
      </Field>
      <Field label="Ссылка на заказ">
        <Input
          name="orderUrl"
          defaultValue={supply?.orderUrl ?? ""}
          inputMode="url"
          placeholder="https://shop.pl/product/123"
          type="url"
        />
      </Field>
      <Button
        className="submit-button"
        fullWidth
        type="submit"
        variant="primary">
        {supply ? "Сохранить" : "Добавить расходник"}
      </Button>
    </form>
  );
}

export default SupplyForm;
