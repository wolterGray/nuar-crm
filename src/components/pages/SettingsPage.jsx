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
import clsx from "clsx";
import {useCallback, useMemo, useRef, useState} from "react";
import {COLOR_THEME_OPTIONS} from "../../constants/colorThemes.js";
import {useBreakpoint} from "../../hooks/useBreakpoint.js";
import {resolveColorTheme} from "../../utils/colorTheme.js";
import {buildIntegrationHealth} from "../../utils/integrationHealth.js";
import HintIcon, {FieldLabel} from "../HintIcon.jsx";
import InactiveFollowUpPanel from "../InactiveFollowUpPanel.jsx";
import ReviewRequestsPanel from "../ReviewRequestsPanel.jsx";
import SmsRemindersPanel from "../SmsRemindersPanel.jsx";
import TelegramDigestPanel from "../TelegramDigestPanel.jsx";
import SettingsToggle from "../SettingsToggle.jsx";
import {Button, Card, Input, PageHeader, Select} from "../ui/index.js";

function SettingsMobileSection({children, isMobile, title}) {
  if (!isMobile) {
    return children;
  }

  return (
    <section className="flex flex-col gap-4 p-4 border border-border/60 bg-surface/50 rounded-card mb-4">
      <h3 className="m-0 text-text-main text-sm font-semibold tracking-tight border-b border-border-soft pb-2">{title}</h3>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function IntegrationHealthPanel({actions = {}, report}) {
  const overallState =
    report.summary.warning > 0 ? "warning" : report.summary.ok > 0 ? "ok" : "off";
  const overallLabel =
    overallState === "warning"
      ? "Нужно внимание"
      : overallState === "ok"
        ? "Автоматизации работают"
        : "Автоматизации выключены";

  return (
    <div className={`p-5 border rounded-card bg-surface flex flex-col gap-5 ${
      overallState === "warning" ? "border-amber-500/20" : overallState === "ok" ? "border-emerald-500/20" : "border-border"
    }`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="block text-text-faint text-xs">Авто-контроль</span>
          <strong className="block text-text-main text-base font-bold mt-0.5">{overallLabel}</strong>
        </div>
        <div className="flex items-center flex-wrap gap-4">
          <div className="flex items-center gap-3 bg-field px-3 py-1.5 rounded-control border border-border">
            <span className="text-text-muted text-xs font-semibold">
              <b className="text-emerald-400 mr-1">{report.summary.ok}</b> OK
            </span>
            <span className="text-text-muted text-xs font-semibold">
              <b className="text-amber-400 mr-1">{report.summary.warning}</b> Внимание
            </span>
            <span className="text-text-muted text-xs font-semibold">
              <b className="text-text-faint mr-1">{report.summary.off}</b> Выкл
            </span>
          </div>
          <Button
            variant="secondary"
            disabled={actions.refreshingAll}
            onClick={() => actions.onRefreshAll?.()}>
            {actions.refreshingAll ? "Проверяю..." : "Проверить всё"}
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {report.items.map((item) => {
          const itemActions = actions.itemActions?.[item.id] ?? [];

          return (
            <article key={item.id} className={`p-4 border rounded-control bg-field flex flex-col sm:flex-row sm:items-start justify-between gap-4 transition-all ${
              item.state === "warning" ? "border-amber-500/20 hover:border-amber-500/30" : item.state === "ok" ? "border-emerald-500/10 hover:border-emerald-500/20" : "border-border/60"
            }`}>
              <div className="flex gap-3">
                <span className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${
                  item.state === "warning" ? "bg-amber-400" : item.state === "ok" ? "bg-emerald-400" : "bg-text-faint"
                }`} />
                <div>
                  <strong className="block text-text-main text-sm font-semibold">{item.name}</strong>
                  <small className="block text-text-muted text-xs mt-0.5">{item.message}</small>
                  {item.diagnostic && <p className="m-0 mt-2 text-text-faint text-xs leading-normal">{item.diagnostic}</p>}
                </div>
              </div>
              <div className="flex flex-col sm:items-end gap-2 shrink-0">
                <em className="text-text-faint text-[10px] not-italic font-medium">{item.lastRunLabel}</em>
                {itemActions.length ? (
                  <div className="flex items-center gap-2 mt-1">
                    {itemActions.map((action) => (
                      <Button
                        variant={action.primary ? "primary" : "secondary"}
                        size="sm"
                        disabled={action.disabled}
                        key={action.label}
                        onClick={action.onClick}>
                        {action.label}
                      </Button>
                    ))}
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
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
  const [integrationDiagnosticsRunning, setIntegrationDiagnosticsRunning] = useState(false);
  const showDevMockControls = import.meta.env.DEV;
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
  const handleMockToggle = (e) => {
    const enabled = e.target.checked;
    localStorage.setItem('mockMode', enabled);
    window.location.reload();
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
  const runIntegrationDiagnostics = useCallback(async () => {
    const refreshers = [
      telegramDigest?.refreshStatus,
      smsReminders?.refreshStatus,
      reviewRequests?.refreshStatus,
      inactiveFollowUp?.refreshStatus,
    ].filter(Boolean);

    if (!refreshers.length || integrationDiagnosticsRunning) {
      return;
    }

    setIntegrationDiagnosticsRunning(true);

    try {
      const results = await Promise.allSettled(refreshers.map((refresh) => refresh()));
      const failedCount = results.filter((result) => result.status === "rejected").length;

      pushNotification?.({
        title: failedCount ? "Диагностика завершена с ошибками" : "Диагностика завершена",
        message: failedCount
          ? `Не обновились статусы: ${failedCount}`
          : "Статусы интеграций обновлены",
      });
    } finally {
      setIntegrationDiagnosticsRunning(false);
    }
  }, [
    inactiveFollowUp,
    integrationDiagnosticsRunning,
    pushNotification,
    reviewRequests,
    smsReminders,
    telegramDigest,
  ]);
  const runIntegrationPreview = useCallback(
    async (title, preview) => {
      try {
        const result = await preview?.();
        const count = Array.isArray(result) ? result.length : String(result ?? "").length;

        pushNotification?.({
          title: `${title}: предпросмотр готов`,
          message: Array.isArray(result)
            ? `Найдено элементов: ${count}`
            : "Сообщение собрано без отправки",
        });
      } catch (error) {
        pushNotification?.({
          title: `${title}: предпросмотр не выполнен`,
          message: error?.message || "Проверьте настройки интеграции",
        });
      }
    },
    [pushNotification],
  );
  const integrationHealthActions = useMemo(
    () => ({
      itemActions: {
        "inactive-follow-up": [
          {
            disabled: inactiveFollowUp?.status?.loading,
            label: "Обновить",
            onClick: () => inactiveFollowUp?.refreshStatus?.(),
          },
          {
            label: "Предпросмотр",
            onClick: () =>
              runIntegrationPreview("Follow-up", inactiveFollowUp?.runPreview),
          },
          {
            disabled:
              inactiveFollowUp?.status?.loading || !inactiveFollowUp?.status?.configured,
            label: "Отправить",
            onClick: () => inactiveFollowUp?.runProcess?.(),
            primary: true,
          },
        ],
        "review-requests": [
          {
            disabled: reviewRequests?.status?.loading,
            label: "Обновить",
            onClick: () => reviewRequests?.refreshStatus?.(),
          },
          {
            label: "Предпросмотр",
            onClick: () =>
              runIntegrationPreview("Запросы отзывов", reviewRequests?.runPreview),
          },
          {
            disabled: reviewRequests?.status?.loading || !reviewRequests?.status?.configured,
            label: "Отправить",
            onClick: () => reviewRequests?.runProcess?.(),
            primary: true,
          },
        ],
        "sms-reminders": [
          {
            disabled: smsReminders?.status?.loading,
            label: "Обновить",
            onClick: () => smsReminders?.refreshStatus?.(),
          },
          {
            label: "Предпросмотр",
            onClick: () => runIntegrationPreview("SMS reminders", smsReminders?.runPreview),
          },
          {
            disabled: smsReminders?.status?.loading || !smsReminders?.status?.configured,
            label: "Отправить",
            onClick: () => smsReminders?.runProcess?.(),
            primary: true,
          },
        ],
        "telegram-digest": [
          {
            disabled: telegramDigest?.status?.loading,
            label: "Обновить",
            onClick: () => telegramDigest?.refreshStatus?.(),
          },
          {
            label: "Предпросмотр",
            onClick: () =>
              runIntegrationPreview("Telegram digest", telegramDigest?.runPreview),
          },
          {
            disabled: telegramDigest?.status?.loading || !telegramDigest?.status?.configured,
            label: "Отправить",
            onClick: () => telegramDigest?.runSend?.(),
            primary: true,
          },
        ],
      },
      onRefreshAll: runIntegrationDiagnostics,
      refreshingAll: integrationDiagnosticsRunning,
    }),
    [
      inactiveFollowUp,
      integrationDiagnosticsRunning,
      reviewRequests,
      runIntegrationDiagnostics,
      runIntegrationPreview,
      smsReminders,
      telegramDigest,
    ],
  );

  const settingsTabsRow = (
    <div className="flex overflow-x-auto gap-1 border-b border-border pb-px mb-6 scrollbar-none">
      {settingsTabs.map((tab) => (
        <button
          className={clsx(
            "px-4 py-2.5 text-sm font-medium border-b-2 border-transparent text-text-muted hover:text-text-main transition-all whitespace-nowrap cursor-pointer focus:outline-none",
            activeTab === tab.id && "border-accent text-accent"
          )}
          key={tab.id}
          type="button"
          onClick={() => setActiveTab(tab.id)}>
          {isMobile ? tab.mobileLabel : tab.label}
        </button>
      ))}
    </div>
  );

  const saveBar = (
    <div className="sticky bottom-0 z-40 flex justify-end gap-3 p-4 border-t border-border bg-surface/90 backdrop-blur-md -mx-6 -mb-6 mt-6">
      <Button variant="secondary" onClick={resetSettings} className="flex items-center gap-2 cursor-pointer">
        <RotateCcw size={17} />
        Сбросить
      </Button>
      <Button variant="primary" type="submit" className="flex items-center gap-2 font-bold cursor-pointer">
        <Save size={17} />
        Сохранить настройки
      </Button>
    </div>
  );

  return (
    <section className="flex flex-col h-full min-h-0 overflow-hidden">
      <PageHeader
        collapsedMeta={
          settingsTabs.find((tab) => tab.id === activeTab)?.label ?? "Интерфейс"
        }
        collapsible={isMobile}
        actions={
          isMobile ? (
            <>
              <div className="grid grid-cols-4 gap-2 mb-4">
                <article className="p-3 border border-border bg-surface/50 rounded-control flex flex-col gap-1 text-center">
                  <span className="text-[10px] text-text-faint uppercase font-bold">Колокол</span>
                  <strong className="text-text-main text-xs font-semibold">{settings.notificationsEnabled ?? true ? "Вкл" : "Выкл"}</strong>
                </article>
                <article className="p-3 border border-border bg-surface/50 rounded-control flex flex-col gap-1 text-center">
                  <span className="text-[10px] text-text-faint uppercase font-bold">SMS</span>
                  <strong className="text-text-main text-xs font-semibold">{settings.smsRemindersEnabled ? "Вкл" : "Выкл"}</strong>
                </article>
                <article className="p-3 border border-border bg-surface/50 rounded-control flex flex-col gap-1 text-center">
                  <span className="text-[10px] text-text-faint uppercase font-bold">Облако</span>
                  <strong className="text-text-main text-xs font-semibold">{cloudKpiLabel}</strong>
                </article>
                <article className="p-3 border border-border bg-surface/50 rounded-control flex flex-col gap-1 text-center">
                  <span className="text-[10px] text-text-faint uppercase font-bold">Компакт</span>
                  <strong className="text-text-main text-xs font-semibold">{settings.compactMode ?? true ? "Вкл" : "Выкл"}</strong>
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
        className="flex-1 min-h-0 flex flex-col overflow-hidden"
        key={`${settings.colorTheme}-${settings.compactMode}`}
        ref={formRef}
        onSubmit={onSubmit}>
        <div className="flex-1 overflow-y-auto pr-1 pb-4 flex flex-col gap-6">
          <Card
            className={clsx(
              "p-6 flex flex-col gap-4 transition-all duration-150",
              activeTab === "interface" ? "block" : "hidden"
            )}>
            <div className="flex items-center gap-3 border-b border-border-soft pb-4 mb-2">
              <SlidersHorizontal size={18} className="text-accent" />
              <div>
                <h2 className="m-0 text-text-main text-base font-bold flex items-center gap-2">
                  Интерфейс
                  <HintIcon>Название, оформление и основное меню</HintIcon>
                </h2>
              </div>
            </div>
            <label className="flex flex-col gap-1.5 text-text-muted text-xs font-medium">
              Название студии
              <Input
                name="studioName"
                defaultValue={settings.studioName}
                placeholder="NUAR"
                className="mt-1"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-text-muted text-xs font-medium">
              Владелец
              <Input
                name="ownerName"
                defaultValue={settings.ownerName}
                placeholder="Влад"
                className="mt-1"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-text-muted text-xs font-medium">
              Тема оформления
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-1">
                {COLOR_THEME_OPTIONS.map((themeOption) => (
                  <label
                    className="relative p-4 border border-border rounded-control bg-field cursor-pointer transition-all hover:bg-surface-soft flex flex-col gap-3 group"
                    key={themeOption.id}
                    title={themeOption.description}>
                    <input
                      defaultChecked={
                        selectedColorTheme.id === themeOption.id
                      }
                      name="colorTheme"
                      type="radio"
                      value={themeOption.id}
                      className="absolute top-4 right-4 accent-accent"
                    />
                    <div className="flex gap-1.5">
                      {themeOption.preview.map((color) => (
                        <span key={color} className="flex-1 h-7 rounded-sm border border-black/10 shadow-sm" style={{background: color}} />
                      ))}
                    </div>
                    <strong className="block text-text-main text-xs font-semibold group-hover:text-accent transition-colors leading-tight">
                      {themeOption.label}
                    </strong>
                  </label>
                ))}
              </div>
            </label>
            <div className="pt-2">
              <SettingsToggle defaultChecked={settings.compactMode ?? true} name="compactMode">
                <span className="labeled-hint-row labeled-hint-row-nowrap">
                  Компактный интерфейс
                  <HintIcon>Меньше вертикальных отступов и больше данных на экране</HintIcon>
                </span>
              </SettingsToggle>
              {showDevMockControls ? (
                <SettingsToggle defaultChecked={localStorage.getItem('mockMode') === 'true'} name="mockModeToggle" onChange={handleMockToggle}>
                  <span className="labeled-hint-row labeled-hint-row-nowrap">
                    Mock data mode
                    <HintIcon>Использовать локальные данные вместо Supabase (dev only)</HintIcon>
                  </span>
                </SettingsToggle>
              ) : null}
            </div>
          </Card>

          <Card
            className={clsx(
              "p-6 flex flex-col gap-4 transition-all duration-150",
              activeTab === "notifications" ? "block" : "hidden"
            )}>
            <div className="flex items-center gap-3 border-b border-border-soft pb-4 mb-2">
              <BellRing size={18} className="text-accent" />
              <div>
                <h2 className="m-0 text-text-main text-base font-bold flex items-center gap-2">
                  Уведомления
                  <HintIcon>Какие события появляются в колокольчике</HintIcon>
                </h2>
              </div>
            </div>
            <div className="flex flex-col gap-6">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="flex flex-col gap-1.5 text-text-muted text-xs font-medium">
                    Напоминать об истечении за, дней
                    <Input
                      min="1"
                      name="certificateExpiryReminderDays"
                      type="number"
                      defaultValue={settings.certificateExpiryReminderDays ?? 30}
                      className="mt-1"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-text-muted text-xs font-medium">
                    Низкий остаток сертификата, %
                    <Input
                      max="100"
                      min="1"
                      name="certificateLowBalancePercent"
                      type="number"
                      defaultValue={settings.certificateLowBalancePercent ?? 20}
                      className="mt-1"
                    />
                  </label>
                </div>
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1 pl-4 border-l border-border/40">
                  <SettingsToggle defaultChecked={settings.smsReminder24hEnabled ?? true} name="smsReminder24hEnabled">
                    <span className="labeled-hint-row labeled-hint-row-nowrap">Напоминание за 24 часа</span>
                  </SettingsToggle>
                  <SettingsToggle defaultChecked={settings.smsReminder2hEnabled ?? true} name="smsReminder2hEnabled">
                    <span className="labeled-hint-row labeled-hint-row-nowrap">Напоминание за 2 часа</span>
                  </SettingsToggle>
                  <SettingsToggle defaultChecked={settings.smsAutoProcessEnabled ?? true} name="smsAutoProcessEnabled">
                    <span className="labeled-hint-row labeled-hint-row-nowrap">
                      Автопроверка
                    </span>
                  </SettingsToggle>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="flex flex-col gap-1.5 text-text-muted text-xs font-medium">
                    Интервал автопроверки, мин
                    <Input
                      min="5"
                      name="smsAutoProcessMinutes"
                      type="number"
                      defaultValue={settings.smsAutoProcessMinutes ?? 10}
                      className="mt-1"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-text-muted text-xs font-medium">
                    Имя отправителя SMS
                    <Input
                      name="smsSenderName"
                      defaultValue={settings.smsSenderName ?? "NUAR"}
                      placeholder="NUAR"
                      className="mt-1"
                    />
                  </label>
                </div>
                <div className="border-t border-border-soft/60 my-2" />
                <SettingsToggle defaultChecked={settings.telegramDigestEnabled ?? false} name="telegramDigestEnabled">
                  <span className="labeled-hint-row labeled-hint-row-nowrap">
                    Telegram-дайджест
                    <HintIcon>
                      Ежедневная сводка в Telegram владельцу салона.
                    </HintIcon>
                  </span>
                </SettingsToggle>
                <label className="flex flex-col gap-1.5 text-text-muted text-xs font-medium">
                  <FieldLabel hint="Часовой пояс: Europe/Warsaw">
                    Время отправки дайджеста
                  </FieldLabel>
                  <Input
                    name="telegramDigestTime"
                    type="time"
                    defaultValue={settings.telegramDigestTime ?? "08:00"}
                    className="mt-1"
                  />
                </label>
                <div className="border-t border-border-soft/60 my-2" />
                <SettingsToggle defaultChecked={settings.reviewRequestsEnabled ?? false} name="reviewRequestsEnabled">
                  <span className="labeled-hint-row labeled-hint-row-nowrap">
                    Запрос отзыва после визита
                    <HintIcon>Авто-SMS через N часов после завершённого визита</HintIcon>
                  </span>
                </SettingsToggle>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="flex flex-col gap-1.5 text-text-muted text-xs font-medium">
                    Задержка после визита, часов
                    <Input
                      min="1"
                      name="reviewRequestDelayHours"
                      type="number"
                      defaultValue={settings.reviewRequestDelayHours ?? 2}
                      className="mt-1"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-text-muted text-xs font-medium">
                    Интервал автопроверки отзывов, мин
                    <Input
                      min="10"
                      name="reviewRequestAutoProcessMinutes"
                      type="number"
                      defaultValue={settings.reviewRequestAutoProcessMinutes ?? 15}
                      className="mt-1"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <label className="flex flex-col gap-1.5 text-text-muted text-xs font-medium">
                    Ссылка Google Maps
                    <Input
                      name="reviewGoogleUrl"
                      defaultValue={settings.reviewGoogleUrl ?? ""}
                      placeholder="https://g.page/nuar/review"
                      className="mt-1"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-text-muted text-xs font-medium">
                    Ссылка Booksy
                    <Input
                      name="reviewBooksyUrl"
                      defaultValue={settings.reviewBooksyUrl ?? ""}
                      placeholder="https://booksy.com/..."
                      className="mt-1"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-text-muted text-xs font-medium">
                    Основная ссылка в SMS
                    <Input
                      name="reviewPrimaryUrl"
                      defaultValue={settings.reviewPrimaryUrl ?? ""}
                      placeholder="Если пусто — Google, затем Booksy"
                      className="mt-1"
                    />
                  </label>
                </div>
                <SettingsToggle defaultChecked={settings.reviewRequestAutoProcessEnabled ?? true} name="reviewRequestAutoProcessEnabled">
                  <span className="labeled-hint-row labeled-hint-row-nowrap">
                    Автопроверка запросов отзывов
                  </span>
                </SettingsToggle>
                <div className="border-t border-border-soft/60 my-2" />
                <SettingsToggle defaultChecked={settings.inactiveFollowUpEnabled ?? false} name="inactiveFollowUpEnabled">
                  <span className="labeled-hint-row labeled-hint-row-nowrap">
                    Follow-up неактивных клиентов
                    <HintIcon>Авто-SMS через 14, 30 и 60 дней без визита</HintIcon>
                  </span>
                </SettingsToggle>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1 pl-4 border-l border-border/40">
                  <SettingsToggle defaultChecked={settings.inactiveFollowUp14Enabled ?? true} name="inactiveFollowUp14Enabled">
                    <span className="labeled-hint-row labeled-hint-row-nowrap">SMS через 14 дней</span>
                  </SettingsToggle>
                  <SettingsToggle defaultChecked={settings.inactiveFollowUp30Enabled ?? true} name="inactiveFollowUp30Enabled">
                    <span className="labeled-hint-row labeled-hint-row-nowrap">SMS через 30 дней</span>
                  </SettingsToggle>
                  <SettingsToggle defaultChecked={settings.inactiveFollowUp60Enabled ?? true} name="inactiveFollowUp60Enabled">
                    <span className="labeled-hint-row labeled-hint-row-nowrap">SMS через 60 дней</span>
                  </SettingsToggle>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <SettingsToggle defaultChecked={settings.inactiveFollowUpAutoProcessEnabled ?? true} name="inactiveFollowUpAutoProcessEnabled">
                    <span className="labeled-hint-row labeled-hint-row-nowrap">
                      Автопроверка follow-up
                    </span>
                  </SettingsToggle>
                  <label className="flex flex-col gap-1.5 text-text-muted text-xs font-medium">
                    Интервал автопроверки follow-up, мин
                    <Input
                      min="30"
                      name="inactiveFollowUpAutoProcessMinutes"
                      type="number"
                      defaultValue={settings.inactiveFollowUpAutoProcessMinutes ?? 60}
                      className="mt-1"
                    />
                  </label>
                </div>
              </SettingsMobileSection>

              <SettingsMobileSection isMobile={isMobile} title="Визиты и напоминания">
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
                <SettingsToggle defaultChecked={settings.inactiveClientAlertsEnabled ?? true} name="inactiveClientAlertsEnabled">
                  <span className="labeled-hint-row labeled-hint-row-nowrap">
                    Клиенты, которых давно не было
                  </span>
                </SettingsToggle>
                <SettingsToggle defaultChecked={settings.taskAlertsEnabled ?? true} name="taskAlertsEnabled">
                  <span className="labeled-hint-row labeled-hint-row-nowrap">
                    Просроченные задачи
                  </span>
                </SettingsToggle>
                <SettingsToggle defaultChecked={settings.supplyAlertsEnabled ?? true} name="supplyAlertsEnabled">
                  <span className="labeled-hint-row labeled-hint-row-nowrap">
                    Остатки расходников
                  </span>
                </SettingsToggle>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="flex flex-col gap-1.5 text-text-muted text-xs font-medium">
                    <FieldLabel hint="Если «давно не были» больше этого числа — показывать одной группой">
                      Лимит клиентов в списке
                    </FieldLabel>
                    <Input
                      min="3"
                      name="inactiveClientAlertLimit"
                      type="number"
                      defaultValue={settings.inactiveClientAlertLimit ?? 5}
                      className="mt-1"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-text-muted text-xs font-medium">
                    <FieldLabel hint="Через сколько дней напоминать о клиенте">Порог отсутствия клиента</FieldLabel>
                    <Input
                      min="1"
                      name="inactiveClientDays"
                      type="number"
                      defaultValue={settings.inactiveClientDays ?? 14}
                      className="mt-1"
                    />
                  </label>
                </div>
                <div className="border-t border-border-soft/60 my-2" />
                <SettingsToggle defaultChecked={settings.birthdayAlertsEnabled ?? true} name="birthdayAlertsEnabled">
                  <span className="labeled-hint-row labeled-hint-row-nowrap">
                    Дни рождения клиентов
                  </span>
                </SettingsToggle>
                <label className="flex flex-col gap-1.5 text-text-muted text-xs font-medium">
                  <FieldLabel hint="За сколько дней добавить клиента в колокольчик">Напоминать о дне рождения заранее</FieldLabel>
                  <Input
                    min="1"
                    name="birthdayReminderDays"
                    type="number"
                    defaultValue={settings.birthdayReminderDays ?? 7}
                    className="mt-1"
                  />
                </label>
                <div className="border-t border-border-soft/60 my-2" />
                <SettingsToggle defaultChecked={settings.todayVisitAlertsEnabled ?? true} name="todayVisitAlertsEnabled">
                  <span className="labeled-hint-row labeled-hint-row-nowrap">
                    Сегодняшние визиты в колокольчике
                  </span>
                </SettingsToggle>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <label className="flex flex-col gap-1.5 text-text-muted text-xs font-medium">
                    Какие визиты показывать
                    <Select
                      name="todayVisitAlertMode"
                      defaultValue={
                        settings.todayVisitAlertMode === "upcoming"
                          ? "upcoming"
                          : "remaining"
                      }
                      className="mt-1"
                    >
                      <option value="remaining">Только оставшиеся</option>
                      <option value="upcoming">Только ближайшие</option>
                    </Select>
                  </label>
                  <label className="flex flex-col gap-1.5 text-text-muted text-xs font-medium">
                    <FieldLabel hint="Используется для режима «Только ближайшие»">
                      Горизонт ближайших визитов
                    </FieldLabel>
                    <Select
                      name="upcomingVisitMinutes"
                      defaultValue={settings.upcomingVisitMinutes ?? 180}
                      className="mt-1"
                    >
                      <option value="60">1 час</option>
                      <option value="120">2 часа</option>
                      <option value="180">3 часа</option>
                      <option value="360">6 часов</option>
                      <option value="720">12 часов</option>
                    </Select>
                  </label>
                  <label className="flex flex-col gap-1.5 text-text-muted text-xs font-medium">
                    Когда показать карточку визита
                    <Select
                      name="smartVisitPopupMinutes"
                      defaultValue={settings.smartVisitPopupMinutes ?? 15}
                      className="mt-1"
                    >
                      <option value="5">За 5 минут</option>
                      <option value="10">За 10 минут</option>
                      <option value="15">За 15 минут</option>
                      <option value="30">За 30 минут</option>
                      <option value="60">За 1 час</option>
                    </Select>
                  </label>
                </div>
                <SettingsToggle defaultChecked={settings.smartVisitPopupsEnabled ?? true} name="smartVisitPopupsEnabled">
                  <span className="labeled-hint-row labeled-hint-row-nowrap">
                    Всплывающие напоминания
                  </span>
                </SettingsToggle>
              </SettingsMobileSection>

              <SettingsMobileSection isMobile={isMobile} title="Тихие часы">
                <SettingsToggle defaultChecked={settings.quietHoursEnabled ?? true} name="quietHoursEnabled">
                  <span className="labeled-hint-row labeled-hint-row-nowrap">
                    Тихие часы
                    <HintIcon>Ночью показывать только срочные уведомления</HintIcon>
                  </span>
                </SettingsToggle>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="flex flex-col gap-1.5 text-text-muted text-xs font-medium">
                    Начало тихих часов
                    <Input
                      name="quietHoursStart"
                      type="time"
                      step="3600"
                      defaultValue={settings.quietHoursStart ?? "22:00"}
                      className="mt-1"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-text-muted text-xs font-medium">
                    Конец тихих часов
                    <Input
                      name="quietHoursEnd"
                      type="time"
                      step="3600"
                      defaultValue={settings.quietHoursEnd ?? "08:00"}
                      className="mt-1"
                    />
                  </label>
                </div>
              </SettingsMobileSection>
            </div>
          </Card>

          <Card
            className={clsx(
              "p-6 flex flex-col gap-4 transition-all duration-150",
              activeTab === "calendar" ? "block" : "hidden"
            )}>
            <div className="flex items-center gap-3 border-b border-border-soft pb-4 mb-2">
              <CalendarClock size={18} className="text-accent" />
              <div>
                <h2 className="m-0 text-text-main text-base font-bold flex items-center gap-2">
                  Календарь
                  <HintIcon>Рабочее время и детализация графика</HintIcon>
                </h2>
              </div>
            </div>
            <div className="flex flex-col gap-6">
              <SettingsMobileSection isMobile={isMobile} title="Рабочее время">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <label className="flex flex-col gap-1.5 text-text-muted text-xs font-medium">
                    Начало рабочего дня
                    <Input
                      name="workdayStart"
                      type="time"
                      step="3600"
                      defaultValue={settings.workdayStart ?? "08:00"}
                      className="mt-1"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-text-muted text-xs font-medium">
                    Конец рабочего дня
                    <Input
                      name="workdayEnd"
                      type="time"
                      step="3600"
                      defaultValue={settings.workdayEnd ?? "22:00"}
                      className="mt-1"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-text-muted text-xs font-medium">
                    Шаг временной сетки
                    <Select
                      name="calendarSlotMinutes"
                      defaultValue={settings.calendarSlotMinutes ?? 15}
                      className="mt-1"
                    >
                      <option value="15">15 минут</option>
                      <option value="30">30 минут</option>
                      <option value="60">60 минут</option>
                    </Select>
                  </label>
                </div>
              </SettingsMobileSection>
              <SettingsMobileSection isMobile={isMobile} title="Отображение календаря">
                <div className="flex flex-col gap-4">
                  <SettingsToggle defaultChecked={settings.calendarRemindersVisible ?? true} name="calendarRemindersVisible">
                    <span className="labeled-hint-row labeled-hint-row-nowrap">
                      Панель визитов дня
                    </span>
                  </SettingsToggle>
                  <SettingsToggle defaultChecked={settings.calendarShowTasks ?? true} name="calendarShowTasks">
                    <span className="labeled-hint-row labeled-hint-row-nowrap">
                      Задачи в графике
                    </span>
                  </SettingsToggle>
                  <SettingsToggle defaultChecked={settings.calendarNowLineVisible ?? true} name="calendarNowLineVisible">
                    <span className="labeled-hint-row labeled-hint-row-nowrap">
                      Линия текущего времени
                    </span>
                  </SettingsToggle>
                  <SettingsToggle defaultChecked={settings.calendarConflictWarnings ?? true} name="calendarConflictWarnings">
                    <span className="labeled-hint-row labeled-hint-row-nowrap">
                      Конфликты расписания
                    </span>
                  </SettingsToggle>
                </div>
              </SettingsMobileSection>
            </div>
          </Card>

          <div
            className={clsx(
              "flex flex-col gap-6 transition-all duration-150",
              activeTab === "integrations" ? "flex" : "hidden"
            )}>
            <Card className="p-6 flex flex-col gap-4">
              <div className="flex items-center gap-3 border-b border-border-soft pb-4 mb-2">
                <Activity size={18} className="text-accent" />
                <div>
                  <h2 className="m-0 text-text-main text-base font-bold flex items-center gap-2">
                    Здоровье интеграций
                    <HintIcon> cron-задачи, токены и последний запуск автоматизаций</HintIcon>
                  </h2>
                </div>
              </div>
              <IntegrationHealthPanel
                actions={integrationHealthActions}
                report={integrationHealth}
              />
            </Card>

            <Card className="p-6 flex flex-col gap-4">
              <div className="flex items-center gap-3 border-b border-border-soft pb-4 mb-2">
                <MailCheck size={18} className="text-accent" />
                <div>
                  <h2 className="m-0 text-text-main text-base font-bold flex items-center gap-2">
                    Gmail
                    <HintIcon>Чтение писем Booksy и документов расходов</HintIcon>
                  </h2>
                </div>
              </div>
              <label className="flex flex-col gap-1.5 text-text-muted text-xs font-medium">
                Google OAuth Client ID
                <Input
                  name="gmailClientId"
                  defaultValue={settings.gmailClientId ?? ""}
                  placeholder="...apps.googleusercontent.com"
                  className="mt-1"
                />
              </label>
            </Card>

            {smsReminders && (
              <Card className="p-6">
                <SmsRemindersPanel
                  status={smsReminders.status}
                  onPreview={smsReminders.runPreview}
                  onProcess={smsReminders.runProcess}
                  onRefreshStatus={smsReminders.refreshStatus}
                />
              </Card>
            )}

            {reviewRequests && (
              <Card className="p-6">
                <ReviewRequestsPanel
                  pushNotification={pushNotification}
                  status={reviewRequests.status}
                  onPreview={reviewRequests.runPreview}
                  onProcess={reviewRequests.runProcess}
                  onRefreshStatus={reviewRequests.refreshStatus}
                />
              </Card>
            )}

            {inactiveFollowUp && (
              <Card className="p-6">
                <InactiveFollowUpPanel
                  pushNotification={pushNotification}
                  status={inactiveFollowUp.status}
                  onPreview={inactiveFollowUp.runPreview}
                  onProcess={inactiveFollowUp.runProcess}
                  onRefreshStatus={inactiveFollowUp.refreshStatus}
                />
              </Card>
            )}

            {telegramDigest && (
              <Card className="p-6">
                <TelegramDigestPanel
                  pushNotification={pushNotification}
                  status={telegramDigest.status}
                  onPreview={telegramDigest.runPreview}
                  onRefreshStatus={telegramDigest.refreshStatus}
                  onSend={telegramDigest.runSend}
                />
              </Card>
            )}
          </div>

          <div
            className={clsx(
              "flex flex-col gap-6 transition-all duration-150",
              activeTab === "data" ? "flex" : "hidden"
            )}>
            <Card className="p-6 flex flex-col gap-4">
              <div className="flex items-center gap-3 border-b border-border-soft pb-4 mb-2">
                <CloudUpload size={18} className="text-accent" />
                <div>
                  <h2 className="m-0 text-text-main text-base font-bold flex items-center gap-2">
                    Облако
                    <HintIcon>Синхронизация CRM через Supabase</HintIcon>
                  </h2>
                </div>
              </div>
              <div className="p-4 border border-border rounded-control bg-field flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-text-faint text-xs">Последнее сохранение</span>
                  <strong className="text-text-main text-sm font-semibold">{formatCloudSyncTime(lastCloudSyncAt)}</strong>
                  <small className={clsx("text-xs leading-normal mt-1 block", (cloudLoadError || lastCloudSyncError || cloudConflict) ? "text-red-400 font-medium" : "text-text-muted")}>
                    {cloudStatusMessage}
                  </small>
                </div>
                {cloudConflict && (
                  <div className="mt-2 p-3 border border-red-500/20 bg-red-500/5 rounded-control flex flex-col gap-3">
                    <p className="m-0 text-red-300 text-xs leading-normal">
                      В облаке более свежая версия ({formatCloudSyncTime(cloudConflict.remoteUpdatedAt)}). Если сохранить локальные данные сейчас, изменения с другого устройства будут потеряны.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={cloudSyncing}
                        onClick={onApplyRemoteSnapshot}>
                        Загрузить из облака
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={cloudSyncing}
                        onClick={onOverwriteRemoteSnapshot}>
                        Сохранить локальные в облако
                      </Button>
                    </div>
                  </div>
                )}
                <div className="mt-2">
                  <Button
                    variant="secondary"
                    disabled={!cloudEnabled || !cloudHydrated || cloudSyncing || cloudConflict}
                    onClick={onForceCloudSave}
                    className="flex items-center gap-2"
                  >
                    <CloudUpload size={16} />
                    {cloudSyncing ? "Сохранение..." : "Принудительно сохранить сейчас"}
                  </Button>
                </div>
              </div>
            </Card>

            <Card className="p-6 flex flex-col gap-4">
              <div className="flex items-center gap-3 border-b border-border-soft pb-4 mb-2">
                <DatabaseBackup size={18} className="text-accent" />
                <div>
                  <h2 className="m-0 text-text-main text-base font-bold flex items-center gap-2">
                    Данные
                    <HintIcon>Резервная копия локальной базы CRM</HintIcon>
                  </h2>
                </div>
              </div>
              <div className="p-4 border border-border rounded-control bg-field flex flex-col gap-4">
                <p className="m-0 text-text-muted text-sm leading-normal">
                  Сохраняйте копию после важных изменений. В файл входят визиты, клиенты, календарь, сотрудники, пакеты, услуги, задачи, расходники и настройки.
                </p>
                <div className="flex gap-3">
                  <Button variant="secondary" onClick={onExportData} className="flex items-center gap-2 cursor-pointer">
                    <Download size={16} />
                    Скачать копию
                  </Button>
                  <label className="inline-flex items-center justify-center min-h-[40px] px-3.5 gap-2 border border-border rounded-control text-text-main bg-field text-sm font-medium hover:bg-surface-soft transition-colors cursor-pointer">
                    <Upload size={16} />
                    Восстановить
                    <input
                      accept="application/json,.json"
                      type="file"
                      className="hidden"
                      onChange={onImportData}
                    />
                  </label>
                </div>
              </div>
            </Card>
          </div>
        </div>
        {saveBar}
      </form>
    </section>
  );
}

export default SettingsPage;
