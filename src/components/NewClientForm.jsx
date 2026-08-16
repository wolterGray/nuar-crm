import {zodResolver} from "@hookform/resolvers/zod";
import {useEffect, useRef} from "react";
import {useForm} from "react-hook-form";
import {z} from "zod";
import {FieldLabel} from "./HintIcon.jsx";
import {AppIcon, Button, Field, Input, Select, Textarea} from "./ui/index.js";

const optionalEmail = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .refine((value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
    message: "Введите корректный email",
  });

const clientFormSchema = z.object({
  name: z.string().trim().min(1, "Укажите имя клиента"),
  messageName: z.string().optional(),
  phone: z.string().optional(),
  email: optionalEmail,
  birthday: z.string().optional(),
  instagram: z.string().optional(),
  telegram: z.string().optional(),
  source: z.string().min(1, "Укажите источник"),
  messageLanguage: z.string().min(1, "Укажите язык SMS"),
  preference: z.string().min(1, "Укажите предпочтение"),
  tags: z.string().optional(),
  note: z.string().optional(),
});

export const DEFAULT_CLIENT_PREFERENCE = "Любой мастер";

export function getClientPreferenceOptions(employees = [], currentPreference = "") {
  const options = [DEFAULT_CLIENT_PREFERENCE];
  const seen = new Set(options);

  employees.forEach((employee) => {
    const name = String(employee?.name ?? "").trim();

    if (!name || seen.has(name)) {
      return;
    }

    seen.add(name);
    options.push(name);
  });

  const preference = String(currentPreference ?? "").trim();
  if (preference && !seen.has(preference)) {
    options.push(preference);
  }

  return options;
}

function NewClientForm({client, employees = [], onSubmit}) {
  const formRef = useRef(null);
  const currentPreference = client?.preference ?? DEFAULT_CLIENT_PREFERENCE;
  const preferenceOptions = getClientPreferenceOptions(employees, currentPreference);
  const {
    formState: {errors, isValid},
    handleSubmit,
    register,
    trigger,
  } = useForm({
    defaultValues: {
      name: client?.name ?? "",
      messageName: client?.messageName ?? "",
      phone: client?.phone ?? "",
      email: client?.email ?? "",
      birthday: client?.birthday ?? "",
      instagram: client?.instagram ?? "",
      telegram: client?.telegram ?? "",
      source: client?.source ?? "Instagram",
      messageLanguage: client?.messageLanguage ?? "Польский",
      preference: currentPreference,
      tags: client?.tags ?? "",
      note: client?.note ?? "",
    },
    mode: "onChange",
    resolver: zodResolver(clientFormSchema),
  });
  useEffect(() => {
    trigger();
  }, [trigger]);
  useEffect(() => {
    formRef.current?.scrollTo({top: 0});
  }, [client?.id]);
  const submitForm = (event) => {
    const form = event.currentTarget;
    handleSubmit(() => onSubmit(form))(event);
  };

  return (
    <section className="panel new-client-panel client-form-sheet-root">
      <div className="form-title">
        <AppIcon name="user" size="sm" />
        <h2>{client ? "Редактировать клиента" : "Новый клиент"}</h2>
      </div>
      <form ref={formRef} noValidate onSubmit={submitForm}>
        <Field error={errors.name?.message} label="Имя клиента">
          <Input
            {...register("name")}
            aria-invalid={Boolean(errors.name)}
            placeholder="Например: Наталья К."
          />
        </Field>
        <label>
          <FieldLabel hint="Как обращаться в сообщениях. Пусто — возьмём первое слово или часть до «от …».">
            Имя для SMS
          </FieldLabel>
          <Input
            {...register("messageName")}
            placeholder="Например: Анастасия"
          />
        </label>
        <Field label="Телефон">
          <Input
            {...register("phone")}
            placeholder="+48 000 000 000"
          />
        </Field>
        <Field error={errors.email?.message} label="Email">
          <Input
            {...register("email")}
            aria-invalid={Boolean(errors.email)}
            inputMode="email"
            placeholder="client@example.com"
          />
        </Field>
        <Field label="Дата рождения">
          <Input
            {...register("birthday")}
            type="date"
          />
        </Field>
        <Field label="Instagram">
          <Input
            {...register("instagram")}
            placeholder="@username или ссылка на профиль"
          />
        </Field>
        <Field label="Telegram">
          <Input
            {...register("telegram")}
            placeholder="@username"
          />
        </Field>
        <div className="form-split">
          <Field error={errors.source?.message} label="Источник">
            <Select {...register("source")} aria-invalid={Boolean(errors.source)}>
              <option>Instagram</option>
              <option>Booksy</option>
              <option>Google</option>
              <option>Рекомендация</option>
              <option>Проходил мимо</option>
            </Select>
          </Field>
          <Field error={errors.preference?.message} label="Предпочтение">
            <Select {...register("preference")} aria-invalid={Boolean(errors.preference)}>
              {preferenceOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="form-split">
          <label>
            <FieldLabel hint="Какой шаблон использовать в автоматических SMS">
              Язык SMS
            </FieldLabel>
            <Select
              {...register("messageLanguage")}
              aria-invalid={Boolean(errors.messageLanguage)}
            >
              <option>Польский</option>
              <option>Русский</option>
              <option>Английский</option>
              <option>Украинский</option>
            </Select>
            <FieldError message={errors.messageLanguage?.message} />
          </label>
          <Field label="Теги">
            <Input
              {...register("tags")}
              placeholder="VIP, спорт, поляк"
            />
          </Field>
        </div>
        <Field label="Комментарий">
          <Textarea
            {...register("note")}
            placeholder="Аллергии, противопоказания, пожелания"
            rows="3"
          />
        </Field>
        <Button
          className="crm-primary-action"
          disabled={!isValid}
          size="lg"
          type="submit"
          variant="primary">
          {client ? "Сохранить клиента" : "Добавить клиента"}
        </Button>
      </form>
    </section>
  );
}

function FieldError({message}) {
  return (
    <small
      aria-hidden={message ? undefined : true}
      className={`field-error ${message ? "" : "is-empty"}`.trim()}>
      {message || "\u00A0"}
    </small>
  );
}

export default NewClientForm;
