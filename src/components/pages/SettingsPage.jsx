import {
  BellRing,
  CalendarClock,
  DatabaseBackup,
  Download,
  MailCheck,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Upload,
} from "lucide-react";
import {useRef} from "react";
import {PageNotificationsSlot} from "../PageNotifications.jsx";

function SettingsPage({
  settings,
  onSubmit,
  onReset,
  onExportData,
  onImportData,
}) {
  const formRef = useRef(null);
  const resetSettings = () => {
    formRef.current?.reset();
    onReset();
  };

  return (
    <section className="settings-page">
      <div className="employees-toolbar settings-toolbar">
        <div className="title-notifications-flex">
          <div>
            <h2>Настройки</h2>
            <p>Управление интерфейсом, календарём и локальными данными</p>
          </div>
          <PageNotificationsSlot />
        </div>
      </div>
      <form
        className="settings-form settings-grid"
        key={`${settings.accentColor}-${settings.theme}-${settings.compactMode}`}
        ref={formRef}
        onSubmit={onSubmit}>
        <section className="panel settings-panel">
          <div className="settings-panel-heading">
            <SlidersHorizontal size={18} />
            <div>
              <h2>Интерфейс</h2>
              <p>Название, оформление и основное меню</p>
            </div>
          </div>
          <label>
            Название студии
            <input
              name="studioName"
              defaultValue={settings.studioName}
              placeholder="NUAR"
            />
          </label>
          <label>
            Владелец
            <input
              name="ownerName"
              defaultValue={settings.ownerName}
              placeholder="Влад"
            />
          </label>
          <label>
            Акцент
            <input
              className="color-input"
              name="accentColor"
              type="color"
              defaultValue={settings.accentColor}
            />
          </label>
          <div className="settings-options">
            <label>
              Тема
              <select name="theme" defaultValue={settings.theme ?? "light"}>
                <option value="light">Светлая</option>
                <option value="dark">Темная</option>
              </select>
            </label>
            <label className="toggle-row">
              <input
                name="compactMode"
                type="checkbox"
                defaultChecked={settings.compactMode ?? true}
              />
              <span>
                Компактный интерфейс
                <small>
                  Меньше вертикальных отступов и больше данных на экране
                </small>
              </span>
            </label>
          </div>
        </section>

        <section className="panel settings-panel">
          <div className="settings-panel-heading">
            <BellRing size={18} />
            <div>
              <h2>Уведомления</h2>
              <p>Какие события появляются в колокольчике</p>
            </div>
          </div>
          <div className="settings-options">
            <label className="toggle-row">
              <input
                name="notificationsEnabled"
                type="checkbox"
                defaultChecked={settings.notificationsEnabled ?? true}
              />
              <span>
                Центр уведомлений
                <small>Показывать рабочие напоминания в верхней панели</small>
              </span>
            </label>
            <label className="toggle-row">
              <input
                name="inactiveClientAlertsEnabled"
                type="checkbox"
                defaultChecked={settings.inactiveClientAlertsEnabled ?? true}
              />
              <span>
                Клиенты, которых давно не было
                <small>Отдельная секция для повторной связи с клиентами</small>
              </span>
            </label>
            <label className="toggle-row">
              <input
                name="taskAlertsEnabled"
                type="checkbox"
                defaultChecked={settings.taskAlertsEnabled ?? true}
              />
              <span>
                Просроченные задачи
                <small>
                  Напоминать о задачах со сроком сегодня и просроченных делах
                </small>
              </span>
            </label>
            <label className="toggle-row">
              <input
                name="supplyAlertsEnabled"
                type="checkbox"
                defaultChecked={settings.supplyAlertsEnabled ?? true}
              />
              <span>
                Остатки расходников
                <small>
                  Сообщать, когда запас достиг минимального значения
                </small>
              </span>
            </label>
            <label>
              Порог отсутствия клиента
              <input
                min="1"
                name="inactiveClientDays"
                type="number"
                defaultValue={settings.inactiveClientDays ?? 14}
              />
              <small>Через сколько дней напоминать о клиенте</small>
            </label>
            <label className="toggle-row">
              <input
                name="birthdayAlertsEnabled"
                type="checkbox"
                defaultChecked={settings.birthdayAlertsEnabled ?? true}
              />
              <span>
                Дни рождения клиентов
                <small>Показывать отдельную секцию для поздравлений</small>
              </span>
            </label>
            <label>
              Напоминать о дне рождения заранее
              <input
                min="1"
                name="birthdayReminderDays"
                type="number"
                defaultValue={settings.birthdayReminderDays ?? 7}
              />
              <small>За сколько дней добавить клиента в колокольчик</small>
            </label>
            <label className="toggle-row">
              <input
                name="todayVisitAlertsEnabled"
                type="checkbox"
                defaultChecked={settings.todayVisitAlertsEnabled ?? true}
              />
              <span>
                Сегодняшние визиты
                <small>Показывать записи календаря в колокольчике</small>
              </span>
            </label>
            <label>
              Какие визиты показывать
              <select
                name="todayVisitAlertMode"
                defaultValue={
                  settings.todayVisitAlertMode === "upcoming"
                    ? "upcoming"
                    : "remaining"
                }>
                <option value="remaining">Только оставшиеся</option>
                <option value="upcoming">Только ближайшие</option>
              </select>
            </label>
            <label>
              Горизонт ближайших визитов
              <select
                name="upcomingVisitMinutes"
                defaultValue={settings.upcomingVisitMinutes ?? 180}>
                <option value="60">1 час</option>
                <option value="120">2 часа</option>
                <option value="180">3 часа</option>
                <option value="360">6 часов</option>
                <option value="720">12 часов</option>
              </select>
              <small>Используется для режима «Только ближайшие»</small>
            </label>
            <label className="toggle-row">
              <input
                name="smartVisitPopupsEnabled"
                type="checkbox"
                defaultChecked={settings.smartVisitPopupsEnabled ?? true}
              />
              <span>
                Всплывающие напоминания
                <small>
                  Показывать плавную карточку перед ближайшим визитом
                </small>
              </span>
            </label>
            <label>
              Когда показать карточку
              <select
                name="smartVisitPopupMinutes"
                defaultValue={settings.smartVisitPopupMinutes ?? 15}>
                <option value="5">За 5 минут</option>
                <option value="10">За 10 минут</option>
                <option value="15">За 15 минут</option>
                <option value="30">За 30 минут</option>
                <option value="60">За 1 час</option>
              </select>
            </label>
          </div>
        </section>

        <section className="panel settings-panel">
          <div className="settings-panel-heading">
            <CalendarClock size={18} />
            <div>
              <h2>Календарь</h2>
              <p>Рабочее время и детализация графика</p>
            </div>
          </div>
          <div className="settings-options settings-options-grid">
            <label>
              Начало рабочего дня
              <input
                name="workdayStart"
                type="time"
                step="3600"
                defaultValue={settings.workdayStart ?? "08:00"}
              />
            </label>
            <label>
              Конец рабочего дня
              <input
                name="workdayEnd"
                type="time"
                step="3600"
                defaultValue={settings.workdayEnd ?? "22:00"}
              />
            </label>
            <label>
              Шаг временной сетки
              <select
                name="calendarSlotMinutes"
                defaultValue={settings.calendarSlotMinutes ?? 15}>
                <option value="15">15 минут</option>
                <option value="30">30 минут</option>
                <option value="60">60 минут</option>
              </select>
            </label>
            <label className="toggle-row">
              <input
                name="calendarRemindersVisible"
                type="checkbox"
                defaultChecked={settings.calendarRemindersVisible ?? true}
              />
              <span>
                Панель визитов дня
                <small>Показывать справа от календаря по умолчанию</small>
              </span>
            </label>
            <label className="toggle-row">
              <input
                name="calendarShowTasks"
                type="checkbox"
                defaultChecked={settings.calendarShowTasks ?? true}
              />
              <span>
                Задачи в графике
                <small>Показывать перерывы и внутренние задачи</small>
              </span>
            </label>
            <label className="toggle-row">
              <input
                name="calendarNowLineVisible"
                type="checkbox"
                defaultChecked={settings.calendarNowLineVisible ?? true}
              />
              <span>
                Линия текущего времени
                <small>Показывать текущий момент на сегодняшнем графике</small>
              </span>
            </label>
            <label className="toggle-row">
              <input
                name="calendarConflictWarnings"
                type="checkbox"
                defaultChecked={settings.calendarConflictWarnings ?? true}
              />
              <span>
                Конфликты расписания
                <small>Спрашивать подтверждение при пересечении записей</small>
              </span>
            </label>
          </div>
        </section>

        <section className="panel settings-panel">
          <div className="settings-panel-heading">
            <MailCheck size={18} />
            <div>
              <h2>Gmail</h2>
              <p>Чтение писем Booksy и документов расходов</p>
            </div>
          </div>
          <div className="settings-options">
            <label>
              Google OAuth Client ID
              <input
                name="gmailClientId"
                defaultValue={settings.gmailClientId ?? ""}
                placeholder="...apps.googleusercontent.com"
              />
              <small>
                CRM получает доступ только для чтения писем после входа через
                Google
              </small>
            </label>
          </div>
        </section>

        <section className="panel settings-panel">
          <div className="settings-panel-heading">
            <DatabaseBackup size={18} />
            <div>
              <h2>Данные</h2>
              <p>Резервная копия локальной базы CRM</p>
            </div>
          </div>
          <div className="settings-options">
            <p>
              Сохраняйте копию после важных изменений. В файл входят визиты,
              клиенты, календарь, сотрудники, пакеты, услуги, задачи, расходники
              и настройки.
            </p>
            <div className="settings-data-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={onExportData}>
                <Download size={16} />
                Скачать копию
              </button>
              <label className="secondary-button settings-import-button">
                <Upload size={16} />
                Восстановить
                <input
                  accept="application/json,.json"
                  type="file"
                  onChange={onImportData}
                />
              </label>
            </div>
          </div>
        </section>

        <div className="settings-actions settings-save-bar settings-grid-full">
          <button
            className="secondary-button"
            type="button"
            onClick={resetSettings}>
            <RotateCcw size={17} />
            Сбросить
          </button>
          <button className="submit-button" type="submit">
            <Save size={17} />
            Сохранить настройки
          </button>
        </div>
      </form>
    </section>
  );
}

export default SettingsPage;
