import {
  BellRing,
  CalendarClock,
  Activity,
  CloudUpload,
  DatabaseBackup,
  Download,
  MailCheck,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Upload,
} from "lucide-react";
import {useMemo, useRef, useState} from "react";
import {COLOR_THEME_OPTIONS} from "../../constants/colorThemes.js";
import {useBreakpoint} from "../../hooks/useBreakpoint.js";
import {resolveColorTheme} from "../../utils/colorTheme.js";
import {buildIntegrationHealth} from "../../utils/integrationHealth.js";
import HintIcon, {FieldLabel} from "../HintIcon.jsx";
import PageHeader from "../PageHeader.jsx";
import InactiveFollowUpPanel from "../InactiveFollowUpPanel.jsx";
import ReviewRequestsPanel from "../ReviewRequestsPanel.jsx";
import SmsRemindersPanel from "../SmsRemindersPanel.jsx";
import TelegramDigestPanel from "../TelegramDigestPanel.jsx";

import SettingsToggle from "../SettingsToggle.jsx";

function SettingsMobileSection({children, isMobile, title}) {
  if (!isMobile) {
    return children;
  }

  return (
    <section className="settings-mobile-section">
      <h3 className="settings-mobile-section-title">{title}</h3>
      <div className="settings-mobile-section-body">{children}</div>
    </section>
  );
}

function IntegrationHealthPanel({report}) {
  const overallState =
    report.summary.warning > 0 ? "warning" : report.summary.ok > 0 ? "ok" : "off";
  const overallLabel =
    overallState === "warning"
      ? "Нужно внимание"
      : overallState === "ok"
        ? "Автоматизации работают"
        : "Автоматизации выключены";

  return (
    <div className={`integration-health-panel is-${overallState}`}>
      <div className="integration-health-head">
        <div>
          <span>Авто-контроль</span>
          <strong>{overallLabel}</strong>
        </div>
        <div className="integration-health-summary">
          <b>{report.summary.ok}</b>
          <small>OK</small>
          <b>{report.summary.warning}</b>
          <small>Внимание</small>
          <b>{report.summary.off}</b>
          <small>Выкл</small>
        </div>
      </div>
      <div className="integration-health-list">
        {report.items.map((item) => (
          <article className={`integration-health-item is-${item.state}`} key={item.id}>
            <span className="integration-health-dot" />
            <div>
              <strong>{item.name}</strong>
              <small>{item.message}</small>
            </div>
            <em>{item.lastRunLabel}</em>
          </article>
        ))}
      </div>
    </div>
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
  const selectedColorTheme = resolveColorTheme(settings);
  const formRef = useRef(null);
  const [activeTab, setActiveTab] = useState(initialTab);
  const settingsTabs = [
    {id: "interface", label: "Интерфейс", mobileLabel: "UI"},
    {id: "notifications", label: "Уведомления", mobileLabel: "Уведом."},
    {id: "calendar", label: "Календарь", mobileLabel: "Календ."},
    {id: "integrations", label: "Интеграции", mobileLabel: "Интегр."},
    {id: "data", label: "Данные", mobileLabel: "Данные"},
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
  const cloudKpiLabel =
    !cloudEnabled
      ? "—"
      : cloudConflict || cloudLoadError || lastCloudSyncError
        ? "!"
        : cloudHydrated
          ? "OK"
          : "...";
  const integrationHealth = useMemo(
    () =>
      buildIntegrationHealth({
        inactiveFollowUp,
        reviewRequests,
        settings,
        smsReminders,
        telegramDigest,
      }),
    [inactiveFollowUp, reviewRequests, settings, smsReminders, telegramDigest],
  );

  const settingsTabsRow = (
    <div className="settings-tabs settings-page-tabs">
      {settingsTabs.map((tab) => (
        <button
          className={activeTab === tab.id ? "active" : ""}
          key={tab.id}
          type="button"
          onClick={() => setActiveTab(tab.id)}>
          {isMobile ? tab.mobileLabel : tab.label}
        </button>
      ))}
    </div>
  );

  const saveBar = (
    <div className="settings-actions settings-save-bar settings-grid-full">
      <button className="secondary-button" type="button" onClick={resetSettings}>
        <RotateCcw size={17} />
        Сбросить
      </button>
      <button className="submit-button" type="submit">
        <Save size={17} />
        Сохранить настройки
      </button>
    </div>
  );

  return (
    <section className={`settings-page ${isMobile ? "settings-page-mobile" : ""}`}>
      <PageHeader
        collapsedMeta={
          settingsTabs.find((tab) => tab.id === activeTab)?.label ?? "Интерфейс"
        }
        collapsible={isMobile}
        actions={
          isMobile ? (
            <>
              <div className="settings-page-summary">
                <article className="settings-page-summary-card is-active">
                  <span>Колокол</span>
                  <strong>{settings.notificationsEnabled ?? true ? "Вкл" : "Выкл"}</strong>
                </article>
                <article className="settings-page-summary-card">
                  <span>SMS</span>
                  <strong>{settings.smsRemindersEnabled ? "Вкл" : "Выкл"}</strong>
                </article>
                <article className="settings-page-summary-card">
                  <span>Облако</span>
                  <strong>{cloudKpiLabel}</strong>
                </article>
                <article className="settings-page-summary-card">
                  <span>Компакт</span>
                  <strong>{settings.compactMode ?? true ? "Вкл" : "Выкл"}</strong>
                </article>
              </div>
              {settingsTabsRow}
            </>
          ) : undefined
        }
        description={pageDescription}
        title={pageTitle}
      />
      {!isMobile ? settingsTabsRow : null}
      <form
        className={`settings-form settings-grid${isMobile ? " settings-page-form" : ""}`}
        key={`${settings.colorTheme}-${settings.compactMode}`}
        ref={formRef}
        onSubmit={onSubmit}>
        <div className="settings-scroll">
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
                        selectedColorTheme.id === themeOption.id
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
            <SettingsToggle defaultChecked={settings.compactMode ?? true} name="compactMode">
              <span className="labeled-hint-row labeled-hint-row-nowrap">
                Компактный интерфейс
                <HintIcon>Меньше вертикальных отступов и больше данных на экране</HintIcon>
              </span>
            </SettingsToggle>
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
              <SettingsMobileSection isMobile={isMobile} title="Колокольчик и пакеты">
              <SettingsToggle defaultChecked={settings.notificationsEnabled ?? true} name="notificationsEnabled">
                <span className="labeled-hint-row labeled-hint-row-nowrap">
                  Центр уведомлений
                  <HintIcon>Показывать рабочие напоминания в верхней панели</HintIcon>
                </span>
              </SettingsToggle>
              <SettingsToggle defaultChecked={settings.packageBalanceAlertsEnabled ?? true} name="packageBalanceAlertsEnabled">
                <span className="labeled-hint-row labeled-hint-row-nowrap">
                  Заканчивающиеся пакеты
                  <HintIcon>Напоминать, когда у клиента осталось мало сеансов</HintIcon>
                </span>
              </SettingsToggle>
              <SettingsToggle defaultChecked={settings.certificateAlertsEnabled ?? true} name="certificateAlertsEnabled">
                <span className="labeled-hint-row labeled-hint-row-nowrap">
                  Сертификаты
                  <HintIcon>Напоминать об истекающих сертификатах и низком остатке</HintIcon>
                </span>
              </SettingsToggle>
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
              </SettingsMobileSection>
              <SettingsMobileSection isMobile={isMobile} title="SMS, отзывы и follow-up">
              <SettingsToggle defaultChecked={settings.smsRemindersEnabled ?? false} name="smsRemindersEnabled">
                <span className="labeled-hint-row labeled-hint-row-nowrap">
                  SMS-напоминания о визитах
                  <HintIcon>
                    Автоматически отправлять SMS за 24 часа и за 2 часа. Тексты — во
                    вкладке «Шаблоны» (PL / RU / EN). Язык клиента — в карточке клиента.
                  </HintIcon>
                </span>
              </SettingsToggle>
              <SettingsToggle defaultChecked={settings.smsReminder24hEnabled ?? true} name="smsReminder24hEnabled">
                <span className="labeled-hint-row labeled-hint-row-nowrap">Напоминание за 24 часа</span>
              </SettingsToggle>
              <SettingsToggle defaultChecked={settings.smsReminder2hEnabled ?? true} name="smsReminder2hEnabled">
                <span className="labeled-hint-row labeled-hint-row-nowrap">Напоминание за 2 часа</span>
              </SettingsToggle>
              <SettingsToggle defaultChecked={settings.smsAutoProcessEnabled ?? true} name="smsAutoProcessEnabled">
                <span className="labeled-hint-row labeled-hint-row-nowrap">
                  Автопроверка при открытой CRM
                  <HintIcon>Каждые N минут отправлять due-напоминания</HintIcon>
                </span>
              </SettingsToggle>
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
              <SettingsToggle defaultChecked={settings.telegramDigestEnabled ?? false} name="telegramDigestEnabled">
                <span className="labeled-hint-row labeled-hint-row-nowrap">
                  Telegram-дайджест
                  <HintIcon>
                    Ежедневная сводка в Telegram владельцу салона. Chat ID — во вкладке
                    «Интеграции» или разделе «Сайт», блок «Уведомления о заявках с сайта».
                  </HintIcon>
                </span>
              </SettingsToggle>
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
              <SettingsToggle defaultChecked={settings.reviewRequestsEnabled ?? false} name="reviewRequestsEnabled">
                <span className="labeled-hint-row labeled-hint-row-nowrap">
                  Запрос отзыва после визита
                  <HintIcon>Авто-SMS через N часов после завершённого визита</HintIcon>
                </span>
              </SettingsToggle>
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
              <SettingsToggle defaultChecked={settings.reviewRequestAutoProcessEnabled ?? true} name="reviewRequestAutoProcessEnabled">
                <span className="labeled-hint-row labeled-hint-row-nowrap">
                  Автопроверка запросов отзывов
                  <HintIcon>Каждые N минут отправлять due-запросы при открытой CRM</HintIcon>
                </span>
              </SettingsToggle>
              <label>
                Интервал автопроверки отзывов, мин
                <input
                  min="10"
                  name="reviewRequestAutoProcessMinutes"
                  type="number"
                  defaultValue={settings.reviewRequestAutoProcessMinutes ?? 15}
                />
              </label>
              <SettingsToggle defaultChecked={settings.inactiveFollowUpEnabled ?? false} name="inactiveFollowUpEnabled">
                <span className="labeled-hint-row labeled-hint-row-nowrap">
                  Follow-up неактивных клиентов
                  <HintIcon>Авто-SMS через 14, 30 и 60 дней без визита</HintIcon>
                </span>
              </SettingsToggle>
              <SettingsToggle defaultChecked={settings.inactiveFollowUp14Enabled ?? true} name="inactiveFollowUp14Enabled">
                <span className="labeled-hint-row labeled-hint-row-nowrap">SMS через 14 дней без визита</span>
              </SettingsToggle>
              <SettingsToggle defaultChecked={settings.inactiveFollowUp30Enabled ?? true} name="inactiveFollowUp30Enabled">
                <span className="labeled-hint-row labeled-hint-row-nowrap">SMS через 30 дней</span>
              </SettingsToggle>
              <SettingsToggle defaultChecked={settings.inactiveFollowUp60Enabled ?? true} name="inactiveFollowUp60Enabled">
                <span className="labeled-hint-row labeled-hint-row-nowrap">SMS через 60 дней</span>
              </SettingsToggle>
              <SettingsToggle defaultChecked={settings.inactiveFollowUpAutoProcessEnabled ?? true} name="inactiveFollowUpAutoProcessEnabled">
                <span className="labeled-hint-row labeled-hint-row-nowrap">
                  Автопроверка follow-up
                  <HintIcon>Каждые N минут при открытой CRM</HintIcon>
                </span>
              </SettingsToggle>
              <label>
                Интервал автопроверки follow-up, мин
                <input
                  min="30"
                  name="inactiveFollowUpAutoProcessMinutes"
                  type="number"
                  defaultValue={settings.inactiveFollowUpAutoProcessMinutes ?? 60}
                />
              </label>
              <SettingsToggle defaultChecked={settings.waitlistEnabled ?? true} name="waitlistEnabled">
                <span className="labeled-hint-row labeled-hint-row-nowrap">
                  Лист ожидания на отмены
                  <HintIcon>Предлагать клиентов из waitlist при освобождении слота</HintIcon>
                </span>
              </SettingsToggle>
              <SettingsToggle defaultChecked={settings.forecastAlertsEnabled ?? true} name="forecastAlertsEnabled">
                <span className="labeled-hint-row labeled-hint-row-nowrap">
                  Прогноз дохода
                  <HintIcon>Показывать сумму записей на сегодня и завтра</HintIcon>
                </span>
              </SettingsToggle>
              <SettingsToggle defaultChecked={settings.alertAggregationEnabled ?? true} name="alertAggregationEnabled">
                <span className="labeled-hint-row labeled-hint-row-nowrap">
                  Группировать похожие
                  <HintIcon>Сводить несколько задач, расходников или клиентов в одну строку</HintIcon>
                </span>
              </SettingsToggle>
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
              </SettingsMobileSection>
              <SettingsMobileSection isMobile={isMobile} title="Визиты и напоминания">
              <SettingsToggle defaultChecked={settings.inactiveClientAlertsEnabled ?? true} name="inactiveClientAlertsEnabled">
                <span className="labeled-hint-row labeled-hint-row-nowrap">
                  Клиенты, которых давно не было
                  <HintIcon>Отдельная секция для повторной связи с клиентами</HintIcon>
                </span>
              </SettingsToggle>
              <SettingsToggle defaultChecked={settings.taskAlertsEnabled ?? true} name="taskAlertsEnabled">
                <span className="labeled-hint-row labeled-hint-row-nowrap">
                  Просроченные задачи
                  <HintIcon>Напоминать о задачах со сроком сегодня и просроченных делах</HintIcon>
                </span>
              </SettingsToggle>
              <SettingsToggle defaultChecked={settings.supplyAlertsEnabled ?? true} name="supplyAlertsEnabled">
                <span className="labeled-hint-row labeled-hint-row-nowrap">
                  Остатки расходников
                  <HintIcon>Сообщать, когда запас достиг минимального значения</HintIcon>
                </span>
              </SettingsToggle>
              <label>
                <FieldLabel hint="Через сколько дней напоминать о клиенте">Порог отсутствия клиента</FieldLabel>
                <input
                  min="1"
                  name="inactiveClientDays"
                  type="number"
                  defaultValue={settings.inactiveClientDays ?? 14}
                />
              </label>
              <SettingsToggle defaultChecked={settings.birthdayAlertsEnabled ?? true} name="birthdayAlertsEnabled">
                <span className="labeled-hint-row labeled-hint-row-nowrap">
                  Дни рождения клиентов
                  <HintIcon>Показывать отдельную секцию для поздравлений</HintIcon>
                </span>
              </SettingsToggle>
              <label>
                <FieldLabel hint="За сколько дней добавить клиента в колокольчик">Напоминать о дне рождения заранее</FieldLabel>
                <input
                  min="1"
                  name="birthdayReminderDays"
                  type="number"
                  defaultValue={settings.birthdayReminderDays ?? 7}
                />
              </label>
              <SettingsToggle defaultChecked={settings.todayVisitAlertsEnabled ?? true} name="todayVisitAlertsEnabled">
                <span className="labeled-hint-row labeled-hint-row-nowrap">
                  Сегодняшние визиты
                  <HintIcon>Показывать записи календаря в колокольчике</HintIcon>
                </span>
              </SettingsToggle>
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
              <SettingsToggle defaultChecked={settings.smartVisitPopupsEnabled ?? true} name="smartVisitPopupsEnabled">
                <span className="labeled-hint-row labeled-hint-row-nowrap">
                  Всплывающие напоминания
                  <HintIcon>Показывать плавную карточку перед ближайшим визитом</HintIcon>
                </span>
              </SettingsToggle>
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
              </SettingsMobileSection>
              <SettingsMobileSection isMobile={isMobile} title="Тихие часы">
              <SettingsToggle defaultChecked={settings.quietHoursEnabled ?? true} name="quietHoursEnabled">
                <span className="labeled-hint-row labeled-hint-row-nowrap">
                  Тихие часы
                  <HintIcon>Ночью показывать только срочные уведомления</HintIcon>
                </span>
              </SettingsToggle>
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
              </SettingsMobileSection>
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
              <SettingsMobileSection isMobile={isMobile} title="Рабочее время">
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
              </SettingsMobileSection>
              <SettingsMobileSection isMobile={isMobile} title="Отображение календаря">
              <SettingsToggle defaultChecked={settings.calendarRemindersVisible ?? true} name="calendarRemindersVisible">
                <span className="labeled-hint-row labeled-hint-row-nowrap">
                  Панель визитов дня
                  <HintIcon>Показывать справа от календаря по умолчанию</HintIcon>
                </span>
              </SettingsToggle>
              <SettingsToggle defaultChecked={settings.calendarShowTasks ?? true} name="calendarShowTasks">
                <span className="labeled-hint-row labeled-hint-row-nowrap">
                  Задачи в графике
                  <HintIcon>Показывать перерывы и внутренние задачи</HintIcon>
                </span>
              </SettingsToggle>
              <SettingsToggle defaultChecked={settings.calendarNowLineVisible ?? true} name="calendarNowLineVisible">
                <span className="labeled-hint-row labeled-hint-row-nowrap">
                  Линия текущего времени
                  <HintIcon>Показывать текущий момент на сегодняшнем графике</HintIcon>
                </span>
              </SettingsToggle>
              <SettingsToggle defaultChecked={settings.calendarConflictWarnings ?? true} name="calendarConflictWarnings">
                <span className="labeled-hint-row labeled-hint-row-nowrap">
                  Конфликты расписания
                  <HintIcon>Спрашивать подтверждение при пересечении записей</HintIcon>
                </span>
              </SettingsToggle>
              </SettingsMobileSection>
            </div>
          </section>

        <section
          className={`panel settings-panel settings-tab-panel ${
            activeTab === "integrations" ? "active" : ""
          }`}>
            <SettingsMobileSection isMobile={isMobile} title="Авто-контроль">
            <div className="settings-panel-heading">
              <Activity size={18} />
              <div>
                <h2>
                  Здоровье интеграций
                  <HintIcon>
                    Быстрый контроль cron-задач, токенов и последнего запуска автоматизаций
                  </HintIcon>
                </h2>
              </div>
            </div>
            <IntegrationHealthPanel report={integrationHealth} />
            </SettingsMobileSection>
            <SettingsMobileSection isMobile={isMobile} title="Gmail OAuth">
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
            </SettingsMobileSection>
          </section>

        <section
          className={`panel settings-panel settings-tab-panel ${
            activeTab === "integrations" ? "active" : ""
          }`}>
          <SettingsMobileSection isMobile={isMobile} title="SMS-напоминания">
          {smsReminders ? (
            <SmsRemindersPanel
              status={smsReminders.status}
              onPreview={smsReminders.runPreview}
              onProcess={smsReminders.runProcess}
              onRefreshStatus={smsReminders.refreshStatus}
            />
          ) : null}
          </SettingsMobileSection>
          <SettingsMobileSection isMobile={isMobile} title="Запросы отзывов">
          {reviewRequests ? (
            <ReviewRequestsPanel
              pushNotification={pushNotification}
              status={reviewRequests.status}
              onPreview={reviewRequests.runPreview}
              onProcess={reviewRequests.runProcess}
              onRefreshStatus={reviewRequests.refreshStatus}
            />
          ) : null}
          </SettingsMobileSection>
          <SettingsMobileSection isMobile={isMobile} title="Неактивные клиенты">
          {inactiveFollowUp ? (
            <InactiveFollowUpPanel
              pushNotification={pushNotification}
              status={inactiveFollowUp.status}
              onPreview={inactiveFollowUp.runPreview}
              onProcess={inactiveFollowUp.runProcess}
              onRefreshStatus={inactiveFollowUp.refreshStatus}
            />
          ) : null}
          </SettingsMobileSection>
          <SettingsMobileSection isMobile={isMobile} title="Telegram-дайджест">
          {telegramDigest ? (
            <TelegramDigestPanel
              pushNotification={pushNotification}
              status={telegramDigest.status}
              onPreview={telegramDigest.runPreview}
              onRefreshStatus={telegramDigest.refreshStatus}
              onSend={telegramDigest.runSend}
            />
          ) : null}
          </SettingsMobileSection>
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
              <SettingsMobileSection isMobile={isMobile} title="Синхронизация Supabase">
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
              </SettingsMobileSection>
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
              <SettingsMobileSection isMobile={isMobile} title="Резервная копия">
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
              </SettingsMobileSection>
          </section>

        </div>
        {saveBar}
      </form>
    </section>
  );
}

export default SettingsPage;
