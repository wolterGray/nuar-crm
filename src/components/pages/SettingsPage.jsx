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
import {useBreakpoint} from "../../hooks/useBreakpoint.js";
import HintIcon, {FieldLabel} from "../HintIcon.jsx";
import PageHeader from "../PageHeader.jsx";
import InactiveFollowUpPanel from "../InactiveFollowUpPanel.jsx";
import ReviewRequestsPanel from "../ReviewRequestsPanel.jsx";
import SmsRemindersPanel from "../SmsRemindersPanel.jsx";
import TelegramDigestPanel from "../TelegramDigestPanel.jsx";

function SettingsMobileCollapsible({children, isMobile, title}) {
  if (!isMobile) {
    return children;
  }

  return (
    <details className="settings-mobile-collapsible">
      <summary>{title}</summary>
      <div className="settings-mobile-collapsible-body">{children}</div>
    </details>
  );
}

function SettingsPage({
  initialTab = "interface",
  pageTitle = "Настройки",
  pageDescription = "Управление интерфейсом, календарём и локальными данными",
  settings,
  reviewRequests = null,
  inactiveFollowUp = null,
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
  const {isMobile} = useBreakpoint();
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
      <PageHeader description={pageDescription} title={pageTitle} />
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
                <h2>
                  Интерфейс
                  <HintIcon>Название, оформление и основное меню</HintIcon>
                </h2>
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
                    <strong className="labeled-hint-row">
                      {themeOption.label}
                      <HintIcon>{themeOption.description}</HintIcon>
                    </strong>
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
                <span className="labeled-hint-row">
                  Компактный интерфейс
                  <HintIcon>Меньше вертикальных отступов и больше данных на экране</HintIcon>
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
                <h2>
                  Уведомления
                  <HintIcon>Какие события появляются в колокольчике</HintIcon>
                </h2>
              </div>
            </div>
            <div className="settings-options">
              <SettingsMobileCollapsible isMobile={isMobile} title="Колокольчик и пакеты">
              <label className="toggle-row">
                <input
                  name="notificationsEnabled"
                  type="checkbox"
                  defaultChecked={settings.notificationsEnabled ?? true}
                />
                <span className="labeled-hint-row">
                  Центр уведомлений
                  <HintIcon>Показывать рабочие напоминания в верхней панели</HintIcon>
                </span>
              </label>
              <label className="toggle-row">
                <input
                  name="packageBalanceAlertsEnabled"
                  type="checkbox"
                  defaultChecked={settings.packageBalanceAlertsEnabled ?? true}
                />
                <span className="labeled-hint-row">
                  Заканчивающиеся пакеты
                  <HintIcon>Напоминать, когда у клиента осталось мало сеансов</HintIcon>
                </span>
              </label>
              <label className="toggle-row">
                <input
                  name="certificateAlertsEnabled"
                  type="checkbox"
                  defaultChecked={settings.certificateAlertsEnabled ?? true}
                />
                <span className="labeled-hint-row">
                  Сертификаты
                  <HintIcon>Напоминать об истекающих сертификатах и низком остатке</HintIcon>
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
              </SettingsMobileCollapsible>
              <SettingsMobileCollapsible isMobile={isMobile} title="SMS, отзывы и follow-up">
              <label className="toggle-row">
                <input
                  name="smsRemindersEnabled"
                  type="checkbox"
                  defaultChecked={settings.smsRemindersEnabled ?? false}
                />
                <span className="labeled-hint-row">
                  SMS-напоминания о визитах
                  <HintIcon>
                    Автоматически отправлять SMS за 24 часа и за 2 часа. Тексты — во
                    вкладке «Шаблоны» (PL / RU / EN). Язык клиента — в карточке клиента.
                  </HintIcon>
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
                <span className="labeled-hint-row">
                  Автопроверка при открытой CRM
                  <HintIcon>Каждые N минут отправлять due-напоминания</HintIcon>
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
              <label className="toggle-row">
                <input
                  name="telegramDigestEnabled"
                  type="checkbox"
                  defaultChecked={settings.telegramDigestEnabled ?? false}
                />
                <span className="labeled-hint-row">
                  Telegram-дайджест
                  <HintIcon>
                    Ежедневная сводка в Telegram владельцу салона. Chat ID — во вкладке
                    «Интеграции» или разделе «Сайт», блок «Уведомления о заявках с сайта».
                  </HintIcon>
                </span>
              </label>
              <label>
                <FieldLabel hint="Часовой пояс: Europe/Warsaw">
                  Время отправки дайджеста
                </FieldLabel>
                <input
                  name="telegramDigestTime"
                  type="time"
                  defaultValue={settings.telegramDigestTime ?? "08:00"}
                />
              </label>
              <label className="toggle-row">
                <input
                  name="reviewRequestsEnabled"
                  type="checkbox"
                  defaultChecked={settings.reviewRequestsEnabled ?? false}
                />
                <span className="labeled-hint-row">
                  Запрос отзыва после визита
                  <HintIcon>Авто-SMS через N часов после завершённого визита</HintIcon>
                </span>
              </label>
              <label>
                Задержка после визита, часов
                <input
                  min="1"
                  name="reviewRequestDelayHours"
                  type="number"
                  defaultValue={settings.reviewRequestDelayHours ?? 2}
                />
              </label>
              <label>
                Ссылка Google Maps
                <input
                  name="reviewGoogleUrl"
                  defaultValue={settings.reviewGoogleUrl ?? ""}
                  placeholder="https://g.page/nuar/review"
                />
              </label>
              <label>
                Ссылка Booksy
                <input
                  name="reviewBooksyUrl"
                  defaultValue={settings.reviewBooksyUrl ?? ""}
                  placeholder="https://booksy.com/..."
                />
              </label>
              <label>
                Основная ссылка в SMS
                <input
                  name="reviewPrimaryUrl"
                  defaultValue={settings.reviewPrimaryUrl ?? ""}
                  placeholder="Если пусто — Google, затем Booksy"
                />
              </label>
              <label className="toggle-row">
                <input
                  name="reviewRequestAutoProcessEnabled"
                  type="checkbox"
                  defaultChecked={settings.reviewRequestAutoProcessEnabled ?? true}
                />
                <span className="labeled-hint-row">
                  Автопроверка запросов отзывов
                  <HintIcon>Каждые N минут отправлять due-запросы при открытой CRM</HintIcon>
                </span>
              </label>
              <label>
                Интервал автопроверки отзывов, мин
                <input
                  min="10"
                  name="reviewRequestAutoProcessMinutes"
                  type="number"
                  defaultValue={settings.reviewRequestAutoProcessMinutes ?? 15}
                />
              </label>
              <label className="toggle-row">
                <input
                  name="inactiveFollowUpEnabled"
                  type="checkbox"
                  defaultChecked={settings.inactiveFollowUpEnabled ?? false}
                />
                <span className="labeled-hint-row">
                  Follow-up неактивных клиентов
                  <HintIcon>Авто-SMS через 14, 30 и 60 дней без визита</HintIcon>
                </span>
              </label>
              <label className="toggle-row">
                <input
                  name="inactiveFollowUp14Enabled"
                  type="checkbox"
                  defaultChecked={settings.inactiveFollowUp14Enabled ?? true}
                />
                <span>SMS через 14 дней без визита</span>
              </label>
              <label className="toggle-row">
                <input
                  name="inactiveFollowUp30Enabled"
                  type="checkbox"
                  defaultChecked={settings.inactiveFollowUp30Enabled ?? true}
                />
                <span>SMS через 30 дней</span>
              </label>
              <label className="toggle-row">
                <input
                  name="inactiveFollowUp60Enabled"
                  type="checkbox"
                  defaultChecked={settings.inactiveFollowUp60Enabled ?? true}
                />
                <span>SMS через 60 дней</span>
              </label>
              <label className="toggle-row">
                <input
                  name="inactiveFollowUpAutoProcessEnabled"
                  type="checkbox"
                  defaultChecked={settings.inactiveFollowUpAutoProcessEnabled ?? true}
                />
                <span className="labeled-hint-row">
                  Автопроверка follow-up
                  <HintIcon>Каждые N минут при открытой CRM</HintIcon>
                </span>
              </label>
              <label>
                Интервал автопроверки follow-up, мин
                <input
                  min="30"
                  name="inactiveFollowUpAutoProcessMinutes"
                  type="number"
                  defaultValue={settings.inactiveFollowUpAutoProcessMinutes ?? 60}
                />
              </label>
              <label className="toggle-row">
                <input
                  name="waitlistEnabled"
                  type="checkbox"
                  defaultChecked={settings.waitlistEnabled ?? true}
                />
                <span className="labeled-hint-row">
                  Лист ожидания на отмены
                  <HintIcon>Предлагать клиентов из waitlist при освобождении слота</HintIcon>
                </span>
              </label>
              <label className="toggle-row">
                <input
                  name="forecastAlertsEnabled"
                  type="checkbox"
                  defaultChecked={settings.forecastAlertsEnabled ?? true}
                />
                <span className="labeled-hint-row">
                  Прогноз дохода
                  <HintIcon>Показывать сумму записей на сегодня и завтра</HintIcon>
                </span>
              </label>
              <label className="toggle-row">
                <input
                  name="alertAggregationEnabled"
                  type="checkbox"
                  defaultChecked={settings.alertAggregationEnabled ?? true}
                />
                <span className="labeled-hint-row">
                  Группировать похожие
                  <HintIcon>Сводить несколько задач, расходников или клиентов в одну строку</HintIcon>
                </span>
              </label>
              <label>
                <FieldLabel hint="Если «давно не были» больше этого числа — показывать одной группой">
                  Лимит клиентов в списке
                </FieldLabel>
                <input
                  min="3"
                  name="inactiveClientAlertLimit"
                  type="number"
                  defaultValue={settings.inactiveClientAlertLimit ?? 5}
                />
              </label>
              </SettingsMobileCollapsible>
              <SettingsMobileCollapsible isMobile={isMobile} title="Визиты и напоминания">
              <label className="toggle-row">
                <input
                  name="inactiveClientAlertsEnabled"
                  type="checkbox"
                  defaultChecked={settings.inactiveClientAlertsEnabled ?? true}
                />
                <span className="labeled-hint-row">
                  Клиенты, которых давно не было
                  <HintIcon>Отдельная секция для повторной связи с клиентами</HintIcon>
                </span>
              </label>
              <label className="toggle-row">
                <input
                  name="taskAlertsEnabled"
                  type="checkbox"
                  defaultChecked={settings.taskAlertsEnabled ?? true}
                />
                <span className="labeled-hint-row">
                  Просроченные задачи
                  <HintIcon>Напоминать о задачах со сроком сегодня и просроченных делах</HintIcon>
                </span>
              </label>
              <label className="toggle-row">
                <input
                  name="supplyAlertsEnabled"
                  type="checkbox"
                  defaultChecked={settings.supplyAlertsEnabled ?? true}
                />
                <span className="labeled-hint-row">
                  Остатки расходников
                  <HintIcon>Сообщать, когда запас достиг минимального значения</HintIcon>
                </span>
              </label>
              <label>
                <FieldLabel hint="Через сколько дней напоминать о клиенте">Порог отсутствия клиента</FieldLabel>
                <input
                  min="1"
                  name="inactiveClientDays"
                  type="number"
                  defaultValue={settings.inactiveClientDays ?? 14}
                />
              </label>
              <label className="toggle-row">
                <input
                  name="birthdayAlertsEnabled"
                  type="checkbox"
                  defaultChecked={settings.birthdayAlertsEnabled ?? true}
                />
                <span className="labeled-hint-row">
                  Дни рождения клиентов
                  <HintIcon>Показывать отдельную секцию для поздравлений</HintIcon>
                </span>
              </label>
              <label>
                <FieldLabel hint="За сколько дней добавить клиента в колокольчик">Напоминать о дне рождения заранее</FieldLabel>
                <input
                  min="1"
                  name="birthdayReminderDays"
                  type="number"
                  defaultValue={settings.birthdayReminderDays ?? 7}
                />
              </label>
              <label className="toggle-row">
                <input
                  name="todayVisitAlertsEnabled"
                  type="checkbox"
                  defaultChecked={settings.todayVisitAlertsEnabled ?? true}
                />
                <span className="labeled-hint-row">
                  Сегодняшние визиты
                  <HintIcon>Показывать записи календаря в колокольчике</HintIcon>
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
                <FieldLabel hint="Используется для режима «Только ближайшие»">
                  Горизонт ближайших визитов
                </FieldLabel>
                <select
                  name="upcomingVisitMinutes"
                  defaultValue={settings.upcomingVisitMinutes ?? 180}>
                  <option value="60">1 час</option>
                  <option value="120">2 часа</option>
                  <option value="180">3 часа</option>
                  <option value="360">6 часов</option>
                  <option value="720">12 часов</option>
                </select>
              </label>
              <label className="toggle-row">
                <input
                  name="smartVisitPopupsEnabled"
                  type="checkbox"
                  defaultChecked={settings.smartVisitPopupsEnabled ?? true}
                />
                <span className="labeled-hint-row">
                  Всплывающие напоминания
                  <HintIcon>Показывать плавную карточку перед ближайшим визитом</HintIcon>
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
              </SettingsMobileCollapsible>
              <SettingsMobileCollapsible isMobile={isMobile} title="Тихие часы">
              <label className="toggle-row">
                <input
                  name="quietHoursEnabled"
                  type="checkbox"
                  defaultChecked={settings.quietHoursEnabled ?? true}
                />
                <span className="labeled-hint-row">
                  Тихие часы
                  <HintIcon>Ночью показывать только срочные уведомления</HintIcon>
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
              </SettingsMobileCollapsible>
            </div>
          </section>

        <section
          className={`panel settings-panel settings-tab-panel ${
            activeTab === "calendar" ? "active" : ""
          }`}>
            <div className="settings-panel-heading">
              <CalendarClock size={18} />
              <div>
                <h2>
                  Календарь
                  <HintIcon>Рабочее время и детализация графика</HintIcon>
                </h2>
              </div>
            </div>
            <div className="settings-options settings-options-grid">
              <SettingsMobileCollapsible isMobile={isMobile} title="Рабочее время">
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
              </SettingsMobileCollapsible>
              <SettingsMobileCollapsible isMobile={isMobile} title="Отображение календаря">
              <label className="toggle-row">
                <input
                  name="calendarRemindersVisible"
                  type="checkbox"
                  defaultChecked={settings.calendarRemindersVisible ?? true}
                />
                <span className="labeled-hint-row">
                  Панель визитов дня
                  <HintIcon>Показывать справа от календаря по умолчанию</HintIcon>
                </span>
              </label>
              <label className="toggle-row">
                <input
                  name="calendarShowTasks"
                  type="checkbox"
                  defaultChecked={settings.calendarShowTasks ?? true}
                />
                <span className="labeled-hint-row">
                  Задачи в графике
                  <HintIcon>Показывать перерывы и внутренние задачи</HintIcon>
                </span>
              </label>
              <label className="toggle-row">
                <input
                  name="calendarNowLineVisible"
                  type="checkbox"
                  defaultChecked={settings.calendarNowLineVisible ?? true}
                />
                <span className="labeled-hint-row">
                  Линия текущего времени
                  <HintIcon>Показывать текущий момент на сегодняшнем графике</HintIcon>
                </span>
              </label>
              <label className="toggle-row">
                <input
                  name="calendarConflictWarnings"
                  type="checkbox"
                  defaultChecked={settings.calendarConflictWarnings ?? true}
                />
                <span className="labeled-hint-row">
                  Конфликты расписания
                  <HintIcon>Спрашивать подтверждение при пересечении записей</HintIcon>
                </span>
              </label>
              </SettingsMobileCollapsible>
            </div>
          </section>

        <section
          className={`panel settings-panel settings-tab-panel ${
            activeTab === "integrations" ? "active" : ""
          }`}>
            <SettingsMobileCollapsible isMobile={isMobile} title="Gmail OAuth">
            <div className="settings-panel-heading">
              <MailCheck size={18} />
              <div>
                <h2>
                  Gmail
                  <HintIcon>
                    Чтение писем Booksy и документов расходов. Заявки с nuarr.pl, CMS и
                    Telegram-уведомления о брони — в разделе «Сайт» в меню.
                  </HintIcon>
                </h2>
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
              </label>
            </div>
            </SettingsMobileCollapsible>
          </section>

        <section
          className={`panel settings-panel settings-tab-panel ${
            activeTab === "integrations" ? "active" : ""
          }`}>
          <SettingsMobileCollapsible isMobile={isMobile} title="SMS-напоминания">
          {smsReminders ? (
            <SmsRemindersPanel
              status={smsReminders.status}
              onPreview={smsReminders.runPreview}
              onProcess={smsReminders.runProcess}
              onRefreshStatus={smsReminders.refreshStatus}
            />
          ) : null}
          </SettingsMobileCollapsible>
          <SettingsMobileCollapsible isMobile={isMobile} title="Запросы отзывов">
          {reviewRequests ? (
            <ReviewRequestsPanel
              pushNotification={pushNotification}
              status={reviewRequests.status}
              onPreview={reviewRequests.runPreview}
              onProcess={reviewRequests.runProcess}
              onRefreshStatus={reviewRequests.refreshStatus}
            />
          ) : null}
          </SettingsMobileCollapsible>
          <SettingsMobileCollapsible isMobile={isMobile} title="Неактивные клиенты">
          {inactiveFollowUp ? (
            <InactiveFollowUpPanel
              pushNotification={pushNotification}
              status={inactiveFollowUp.status}
              onPreview={inactiveFollowUp.runPreview}
              onProcess={inactiveFollowUp.runProcess}
              onRefreshStatus={inactiveFollowUp.refreshStatus}
            />
          ) : null}
          </SettingsMobileCollapsible>
          <SettingsMobileCollapsible isMobile={isMobile} title="Telegram-дайджест">
          {telegramDigest ? (
            <TelegramDigestPanel
              pushNotification={pushNotification}
              status={telegramDigest.status}
              onPreview={telegramDigest.runPreview}
              onRefreshStatus={telegramDigest.refreshStatus}
              onSend={telegramDigest.runSend}
            />
          ) : null}
          </SettingsMobileCollapsible>
        </section>

        <section
          className={`panel settings-panel settings-tab-panel ${
            activeTab === "data" ? "active" : ""
          }`}>
          <div className="settings-panel-heading">
            <CloudUpload size={18} />
            <div>
              <h2>
                  Облако
                  <HintIcon>Синхронизация CRM через Supabase</HintIcon>
                </h2>
            </div>
          </div>
              <SettingsMobileCollapsible isMobile={isMobile} title="Синхронизация Supabase">
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
              </SettingsMobileCollapsible>
          </section>

        <section
          className={`panel settings-panel settings-tab-panel ${
            activeTab === "data" ? "active" : ""
          }`}>
          <div className="settings-panel-heading">
            <DatabaseBackup size={18} />
                <div>
                  <h2>
                  Данные
                  <HintIcon>Резервная копия локальной базы CRM</HintIcon>
                </h2>
                </div>
              </div>
              <SettingsMobileCollapsible isMobile={isMobile} title="Резервная копия">
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
              </SettingsMobileCollapsible>
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
