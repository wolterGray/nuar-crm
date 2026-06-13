import {UserPlus} from "lucide-react";
import {zodResolver} from "@hookform/resolvers/zod";
import {useEffect} from "react";
import {useForm} from "react-hook-form";
import {z} from "zod";
import {FieldLabel} from "./HintIcon.jsx";

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
  status: z.string().min(1, "Укажите статус"),
  tags: z.string().optional(),
  note: z.string().optional(),
});

function NewClientForm({client, onSubmit}) {
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
      preference: client?.preference ?? "Любой мастер",
      status: client?.status ?? "Активный",
      tags: client?.tags ?? "",
      note: client?.note ?? "",
    },
    mode: "onChange",
    resolver: zodResolver(clientFormSchema),
  });
  useEffect(() => {
    trigger();
  }, [trigger]);
  const submitForm = (event) => {
    const form = event.currentTarget;
    handleSubmit(() => onSubmit(form))(event);
  };

  return (
    <section className="panel new-client-panel">
      <div className="form-title">
        <UserPlus size={18} />
        <h2>{client ? "Редактировать клиента" : "Новый клиент"}</h2>
      </div>
      <form noValidate onSubmit={submitForm}>
        <label>
          Имя клиента
          <input
            {...register("name")}
            aria-invalid={Boolean(errors.name)}
            placeholder="Например: Наталья К."
          />
          <FieldError message={errors.name?.message} />
        </label>
        <label>
          <FieldLabel hint="Как обращаться в сообщениях. Пусто — возьмём первое слово или часть до «от …».">
            Имя для SMS
          </FieldLabel>
          <input
            {...register("messageName")}
            placeholder="Например: Анастасия"
          />
        </label>
        <label>
          Телефон
          <input
            {...register("phone")}
            placeholder="+48 000 000 000"
          />
        </label>
        <label>
          Email
          <input
            {...register("email")}
            aria-invalid={Boolean(errors.email)}
            inputMode="email"
            placeholder="client@example.com"
          />
          <FieldError message={errors.email?.message} />
        </label>
        <label>
          Дата рождения
          <input
            {...register("birthday")}
            type="date"
          />
        </label>
        <label>
          Instagram
          <input
            {...register("instagram")}
            placeholder="@username или ссылка на профиль"
          />
        </label>
        <label>
          Telegram
          <input
            {...register("telegram")}
            placeholder="@username"
          />
        </label>
        <div className="form-split">
          <label>
            Источник
            <select {...register("source")} aria-invalid={Boolean(errors.source)}>
              <option>Instagram</option>
              <option>Booksy</option>
              <option>Google</option>
              <option>Рекомендация</option>
              <option>Проходил мимо</option>
            </select>
            <FieldError message={errors.source?.message} />
          </label>
          <label>
            Предпочтение
            <select {...register("preference")} aria-invalid={Boolean(errors.preference)}>
              <option>Любой мастер</option>
              <option>Ольга</option>
              <option>Максим</option>
              <option>Новая мастер</option>
            </select>
            <FieldError message={errors.preference?.message} />
          </label>
        </div>
        <div className="form-split">
          <label>
            <FieldLabel hint="Какой шаблон использовать в автоматических SMS">
              Язык SMS
            </FieldLabel>
            <select
              {...register("messageLanguage")}
              aria-invalid={Boolean(errors.messageLanguage)}
            >
              <option>Польский</option>
              <option>Русский</option>
              <option>Английский</option>
              <option>Украинский</option>
            </select>
            <FieldError message={errors.messageLanguage?.message} />
          </label>
          <label>
            Статус клиента
            <select {...register("status")} aria-invalid={Boolean(errors.status)}>
              <option>Активный</option>
              <option>VIP</option>
              <option>Новый</option>
              <option>Пауза</option>
              <option>Не беспокоить</option>
            </select>
            <FieldError message={errors.status?.message} />
          </label>
          <label>
            Теги
            <input
              {...register("tags")}
              placeholder="VIP, спорт, поляк"
            />
          </label>
        </div>
        <label>
          Комментарий
          <textarea
            {...register("note")}
            placeholder="Аллергии, противопоказания, пожелания"
            rows="3"
          />
        </label>
        <button className="submit-button" disabled={!isValid} type="submit">
          {client ? "Сохранить клиента" : "Добавить клиента"}
        </button>
      </form>
    </section>
  );
}

function FieldError({message}) {
  if (!message) {
    return null;
  }

  return (
    <small className="field-error">
      {message}
    </small>
  );
}

export default NewClientForm;
