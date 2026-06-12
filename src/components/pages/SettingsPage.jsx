import {
  BellRing,
  CalendarClock,
  CloudUpload,
  DatabaseBackup,
  Download,
  MailCheck,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Upload,
} from "lucide-react";
import {useRef, useState} from "react";
import {COLOR_THEME_OPTIONS} from "../../constants/colorThemes.js";
import PageHeader from "../PageHeader.jsx";
import SiteAdminPanel from "../SiteAdminPanel.jsx";
import SmsRemindersPanel from "../SmsRemindersPanel.jsx";
import TelegramDigestPanel from "../TelegramDigestPanel.jsx";

function SettingsPage({
  initialTab = "interface",
  settings,
  smsReminders = null,
  telegramDigest = null,
  pushNotification,
  cloudConflict = null,
  cloudEnabled = false,
  cloudHydrated = false,
  cloudLoadError = "",
  cloudSyncing = false,
  lastCloudSyncAt = "",
  lastCloudSyncError = "",
  onApplyRemoteSnapshot,
  onForceCloudSave,
  onOverwriteRemoteSnapshot,
  onSubmit,
  onReset,
  onExportData,
  onImportData,
}) {
  const formRef = useRef(null);
  const [activeTab, setActiveTab] = useState(initialTab);
  const settingsTabs = [
    {id: "interface", label: "Интерфейс"},
    {id: "notifications", label: "Уведомления"},
    {id: "calendar", label: "Календарь"},
    {id: "integrations", label: "Интеграции"},
    {id: "data", label: "Данные"},
  ];
  const resetSettings = () => {
    formRef.current?.reset();
    onReset();
  };
  const formatCloudSyncTime = (value) => {
    if (!value) {
      return "ещё не сохранялось";
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? "ещё не сохранялось"
      : date.toLocaleString("ru-RU", {
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
  };
  const cloudStatusMessage = !cloudEnabled
    ? "Войдите в CRM, чтобы синхронизировать данные с Supabase."
    : cloudLoadError
      ? cloudLoadError
      : cloudConflict
        ? "Облако новее локальной базы. Выберите, какую версию оставить."
        : !cloudHydrated
          ? "Загрузка данных из облака..."
          : lastCloudSyncError
            ? lastCloudSyncError
            : "Изменения автоматически сохраняются в облако через ~1 секунду после правок.";

  return (
    <section className="settings-page">
      <PageHeader
        description="Управление интерфейсом, календарём и локальными данными"
        title="Настройки"
      />
      <div className="settings-tabs">
        {settingsTabs.map((tab) => (
          <button
            className={activeTab === tab.id ? "active" : ""}
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>
      <form
        className="settings-form settings-grid"
        key={`${settings.colorTheme}-${settings.compactMode}`}
        ref={formRef}
        onSubmit={onSubmit}>
        <section
          className={`panel settings-panel settings-tab-panel ${
            activeTab === "interface" ? "active" : ""
          }`}>
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
              Тема оформления
              <div className="color-theme-picker">
                {COLOR_THEME_OPTIONS.map((themeOption) => (
                  <label
                    className="color-theme-option"
                    key={themeOption.id}
                    title={themeOption.description}>
                    <input
                      defaultChecked={
                        (settings.colorTheme ?? "dark-gold") === themeOption.id
                      }
                      name="colorTheme"
                      type="radio"
                      value={themeOption.id}
                    />
                    <div className="color-theme-swatches">
                      {themeOption.preview.map((color) => (
                        <span key={color} style={{background: color}} />
                      ))}
                    </div>
                    <strong>{themeOption.label}</strong>
                    <small>{themeOption.description}</small>
                  </label>
                ))}
              </div>
            </label>
            <div className="settings-options">
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

        <section
          className={`panel settings-panel settings-tab-panel ${
            activeTab === "notifications" ? "active" : ""
          }`}>
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
                  name="packageBalanceAlertsEnabled"
                  type="checkbox"
                  defaultChecked={settings.packageBalanceAlertsEnabled ?? true}
                />
                <span>
                  Заканчивающиеся пакеты
                  <small>Напоминать, когда у клиента осталось мало сеансов</small>
                </span>
              </label>
              <label className="toggle-row">
                <input
                  name="certificateAlertsEnabled"
                  type="checkbox"
                  defaultChecked={settings.certificateAlertsEnabled ?? true}
                />
                <span>
                  Сертификаты
                  <small>Напоминать об истекающих сертификатах и низком остатке</small>
                </span>
              </label>
              <label>
                Напоминать об истечении за, дней
                <input
                  min="1"
                  name="certificateExpiryReminderDays"
                  type="number"
                  defaultValue={settings.certificateExpiryReminderDays ?? 30}
                />
              </label>
              <label>
                Низкий остаток сертификата, %
                <input
                  max="100"
                  min="1"
                  name="certificateLowBalancePercent"
                  type="number"
                  defaultValue={settings.certificateLowBalancePercent ?? 20}
                />
              </label>
              <label className="toggle-row">
                <input
                  name="smsRemindersEnabled"
                  type="checkbox"
                  defaultChecked={settings.smsRemindersEnabled ?? false}
                />
                <span>
                  SMS-напоминания о визитах
                  <small>Автоматически отправлять SMS за 24 часа и за 2 часа</small>
                </span>
              </label>
              <label className="toggle-row">
                <input
                  name="smsReminder24hEnabled"
                  type="checkbox"
                  defaultChecked={settings.smsReminder24hEnabled ?? true}
                />
                <span>Напоминание за 24 часа</span>
              </label>
              <label className="toggle-row">
                <input
                  name="smsReminder2hEnabled"
                  type="checkbox"
                  defaultChecked={settings.smsReminder2hEnabled ?? true}
                />
                <span>Напоминание за 2 часа</span>
              </label>
              <label className="toggle-row">
                <input
                  name="smsAutoProcessEnabled"
                  type="checkbox"
                  defaultChecked={settings.smsAutoProcessEnabled ?? true}
                />
                <span>
                  Автопроверка при открытой CRM
                  <small>Каждые N минут отправлять due-напоминания</small>
                </span>
              </label>
              <label>
                Интервал автопроверки, мин
                <input
                  min="5"
                  name="smsAutoProcessMinutes"
                  type="number"
                  defaultValue={settings.smsAutoProcessMinutes ?? 10}
                />
              </label>
              <label>
                Имя отправителя SMS
                <input
                  name="smsSenderName"
                  defaultValue={settings.smsSenderName ?? "NUAR"}
                  placeholder="NUAR"
                />
              </label>
              <label>
                Шаблон SMS за 24 часа
                <textarea
                  name="smsReminder24hTemplate"
                  defaultValue={settings.smsReminder24hTemplate ?? ""}
                  rows="3"
                />
                <small>{`Плейсхолдеры: {name}, {date}, {time}, {service}, {master}, {studio}`}</small>
              </label>
              <label>
                Шаблон SMS за 2 часа
                <textarea
                  name="smsReminder2hTemplate"
                  defaultValue={settings.smsReminder2hTemplate ?? ""}
                  rows="3"
                />
              </label>
              <label className="toggle-row">
                <input
                  name="telegramDigestEnabled"
                  type="checkbox"
                  defaultChecked={settings.telegramDigestEnabled ?? false}
                />
                <span>
                  Telegram-дайджест
                  <small>Ежедневная сводка в Telegram владельцу салона</small>
                </span>
              </label>
              <label>
                Время отправки дайджеста
                <input
                  name="telegramDigestTime"
                  type="time"
                  defaultValue={settings.telegramDigestTime ?? "08:00"}
                />
                <small>Часовой пояс: Europe/Warsaw</small>
              </label>
              <label>
                Telegram Chat ID
                <input
                  name="telegramChatId"
                  defaultValue={settings.telegramChatId ?? ""}
                  placeholder="123456789"
                />
                <small>Можно задать в Supabase Secret TELEGRAM_CHAT_ID вместо этого поля</small>
              </label>
              <label className="toggle-row">
                <input
                  name="forecastAlertsEnabled"
                  type="checkbox"
                  defaultChecked={settings.forecastAlertsEnabled ?? true}
                />
                <span>
                  Прогноз дохода
                  <small>Показывать сумму записей на сегодня и завтра</small>
                </span>
              </label>
              <label className="toggle-row">
                <input
                  name="alertAggregationEnabled"
                  type="checkbox"
                  defaultChecked={settings.alertAggregationEnabled ?? true}
                />
                <span>
                  Группировать похожие
                  <small>Сводить несколько задач, расходников или клиентов в одну строку</small>
                </span>
              </label>
              <label>
                Лимит клиентов в списке
                <input
                  min="3"
                  name="inactiveClientAlertLimit"
                  type="number"
                  defaultValue={settings.inactiveClientAlertLimit ?? 5}
                />
                <small>Если «давно не были» больше этого числа — показывать одной группой</small>
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
              <label className="toggle-row">
                <input
                  name="quietHoursEnabled"
                  type="checkbox"
                  defaultChecked={settings.quietHoursEnabled ?? true}
                />
                <span>
                  Тихие часы
                  <small>Ночью показывать только срочные уведомления</small>
                </span>
              </label>
              <div className="form-split">
                <label>
                  Начало тихих часов
                  <input
                    name="quietHoursStart"
                    type="time"
                    step="3600"
                    defaultValue={settings.quietHoursStart ?? "22:00"}
                  />
                </label>
                <label>
                  Конец тихих часов
                  <input
                    name="quietHoursEnd"
                    type="time"
                    step="3600"
                    defaultValue={settings.quietHoursEnd ?? "08:00"}
                  />
                </label>
              </div>
            </div>
          </section>

        <section
          className={`panel settings-panel settings-tab-panel ${
            activeTab === "calendar" ? "active" : ""
          }`}>
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

        <section
          className={`panel settings-panel settings-tab-panel ${
            activeTab === "integrations" ? "active" : ""
          }`}>
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

        <section
          className={`panel settings-panel settings-tab-panel ${
            activeTab === "integrations" ? "active" : ""
          }`}>
          <SiteAdminPanel compact />
          {smsReminders ? (
            <SmsRemindersPanel
              status={smsReminders.status}
              onPreview={smsReminders.runPreview}
              onProcess={smsReminders.runProcess}
              onRefreshStatus={smsReminders.refreshStatus}
            />
          ) : null}
          {telegramDigest ? (
            <TelegramDigestPanel
              pushNotification={pushNotification}
              status={telegramDigest.status}
              onPreview={telegramDigest.runPreview}
              onRefreshStatus={telegramDigest.refreshStatus}
              onSend={telegramDigest.runSend}
            />
          ) : null}
        </section>

        <section
          className={`panel settings-panel settings-tab-panel ${
            activeTab === "data" ? "active" : ""
          }`}>
          <div className="settings-panel-heading">
            <CloudUpload size={18} />
            <div>
              <h2>Облако</h2>
              <p>Синхронизация CRM через Supabase</p>
            </div>
          </div>
              <div className="settings-options settings-cloud-panel">
                <div className="settings-cloud-status">
                  <span>Последнее сохранение</span>
                  <strong>{formatCloudSyncTime(lastCloudSyncAt)}</strong>
                  <small
                    className={
                      cloudLoadError || lastCloudSyncError || cloudConflict
                        ? "error"
                        : ""
                    }>
                    {cloudStatusMessage}
                  </small>
                </div>
                {cloudConflict && (
                  <div className="settings-cloud-conflict">
                    <p>
                      В облаке более свежая версия (
                      {formatCloudSyncTime(cloudConflict.remoteUpdatedAt)}). Если
                      сохранить локальные данные сейчас, изменения с другого
                      устройства будут потеряны.
                    </p>
                    <div className="settings-data-actions">
                      <button
                        className="secondary-button"
                        disabled={cloudSyncing}
                        type="button"
                        onClick={onApplyRemoteSnapshot}>
                        Загрузить из облака
                      </button>
                      <button
                        className="submit-button"
                        disabled={cloudSyncing}
                        type="button"
                        onClick={onOverwriteRemoteSnapshot}>
                        Сохранить локальные в облако
                      </button>
                    </div>
                  </div>
                )}
                <div className="settings-data-actions">
                  <button
                    className="secondary-button"
                    disabled={
                      !cloudEnabled || !cloudHydrated || cloudSyncing || cloudConflict
                    }
                    type="button"
                    onClick={onForceCloudSave}>
                    <CloudUpload size={16} />
                    {cloudSyncing ? "Сохранение..." : "Принудительно сохранить сейчас"}
                  </button>
                </div>
            </div>
          </section>

        <section
          className={`panel settings-panel settings-tab-panel ${
            activeTab === "data" ? "active" : ""
          }`}>
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
