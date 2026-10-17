import { memo, useState, useCallback } from "react";
import AppIcon from "../../ui/AppIcon.jsx";
import Button from "../../ui/Button.jsx";
import IconButton from "../../ui/IconButton.jsx";
import Textarea from "../../ui/Textarea.jsx";
import ClientLoyaltyCard from "./ClientLoyaltyCard.jsx";
import ClientRowActions from "./ClientRowActions.jsx";
import { getCertificateBalanceLabel } from "../../../utils/certificates.js";

function ClientWorkspace({
  client,
  isMobile,
  onClose,
  onAddVisit,
  onEditClient,
  onDeleteClient,
  onUpdateClientNote,
  onMessageClient,
  handleRepeatVisit,
  handleAddToWaitlist,
  communicationLog = [],
  getClientInitials,
  formatMoney,
  formatAppointmentSummary,
}) {
  const [activeTab, setActiveTab] = useState("overview");
  const [visitHistoryFilter, setVisitHistoryFilter] = useState("all");
  const [copiedField, setCopiedField] = useState(null);
  const [noteSavedFeedback, setNoteSavedFeedback] = useState(false);
  const [openActionMenuId, setOpenActionMenuId] = useState(null);

  const copyToClipboard = useCallback((text, fieldKey) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 1500);
  }, []);

  const handleNoteBlur = useCallback((event) => {
    const nextNote = event.target.value.trim();
    const currentNote = String(client?.note || "").trim();
    if (nextNote !== currentNote) {
      onUpdateClientNote?.(client, nextNote);
      setNoteSavedFeedback(true);
      setTimeout(() => setNoteSavedFeedback(false), 2000);
    }
  }, [client, onUpdateClientNote]);

  if (!client) {
    return null;
  }

  const clientCommunications = communicationLog
    .filter(
      (entry) =>
        entry.clientId === client.id ||
        entry.clientName === client.name,
    )
    .slice(0, 10);

  const filteredAppointments = client.appointments.filter((appointment) => {
    if (visitHistoryFilter === "all") return true;
    if (visitHistoryFilter === "future") return appointment.status === "Запланирован";
    return appointment.status !== "Запланирован";
  });

  return (
    <div className="client-workspace-drawer flex flex-col h-full w-full min-h-0 bg-surface overflow-hidden">
      {/* 1. Sticky Drawer Header */}
      <div className="p-4 border-b border-border/70 shrink-0 bg-surface flex flex-col gap-3">
        {/* Row 1: Identity & Close Button */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="client-workspace-avatar shrink-0 grid place-items-center w-8 h-8 rounded-full text-xs font-bold bg-surface-2 border border-border text-textPrimary">
              {getClientInitials(client.name || client.phone)}
            </div>

            <div className="flex flex-col min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-textPrimary truncate" title={client.name}>
                  {client.name || client.phone || "Без имени"}
                </h2>

                {client.isVip && (
                  <span className="flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-bold text-amber-400 bg-amber-400/10">
                    <AppIcon name="crown" size="xs" />
                    VIP
                  </span>
                )}

                <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                  client.autoStatus === "Новый"
                    ? "text-blue-400 bg-blue-400/10"
                    : "text-emerald-400 bg-emerald-400/10"
                }`}>
                  {client.autoStatus}
                </span>

                {client.hasDebt && (
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold text-rose-400 bg-rose-400/10">
                    Долг: {formatMoney(client.totalDebt)}
                  </span>
                )}
              </div>

              {/* Contact sub-line */}
              <div className="flex items-center gap-3 text-xs text-textMuted mt-0.5">
                {client.phone ? (
                  <div className="flex items-center gap-1">
                    <a
                      className="text-textMuted hover:text-textPrimary transition-colors flex items-center gap-1"
                      href={`tel:${client.phone}`}>
                      <AppIcon name="phone" size="xs" />
                      <span>{client.phone}</span>
                    </a>
                    <button
                      aria-label="Скопировать телефон"
                      className="p-0.5 hover:text-textPrimary text-textFaint transition-colors"
                      type="button"
                      onClick={() => copyToClipboard(client.phone, "phone")}>
                      <AppIcon name={copiedField === "phone" ? "check" : "copy"} size="xs" />
                    </button>
                  </div>
                ) : (
                  <span className="text-textFaint">Телефон не указан</span>
                )}

                {client.telegram && (
                  <a
                    className="text-textMuted hover:text-sky-400 transition-colors flex items-center gap-1"
                    href={client.telegram.startsWith("http") ? client.telegram : `https://t.me/${client.telegram.replace("@", "")}`}
                    rel="noreferrer"
                    target="_blank">
                    <AppIcon name="send" size="xs" />
                    <span>{client.telegram}</span>
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Close button X */}
          <IconButton
            aria-label="Закрыть профиль"
            className="text-textMuted hover:text-textPrimary"
            icon="x"
            size="md"
            variant="ghost"
            onClick={onClose}
          />
        </div>

        {/* Row 2: Action buttons toolbar */}
        <div className="flex items-center gap-2 pt-1 overflow-x-auto scrollbar-none">
          <Button
            className="flex-1 shrink-0"
            leftIcon="calendarPlus"
            size="sm"
            variant="primary"
            onClick={() => onAddVisit?.({
              client: client.name,
              clientId: client.id,
              date: new Date().toISOString().slice(0, 10),
              kind: "visit",
            })}>
            <span>{isMobile ? "+ Визит" : "+ Новый визит"}</span>
          </Button>

          <Button
            className="shrink-0"
            leftIcon="message"
            size="sm"
            variant="secondary"
            onClick={() => onMessageClient?.(client)}>
            Написать
          </Button>

          <Button
            className="shrink-0"
            leftIcon="edit"
            size="sm"
            variant="secondary"
            onClick={() => onEditClient?.(client)}>
            Изменить
          </Button>

          <div className="shrink-0">
            <ClientRowActions
              client={client}
              handleAddToWaitlist={handleAddToWaitlist}
              handleMessageClient={onMessageClient}
              onDeleteClient={onDeleteClient}
              onEditClient={onEditClient}
              openClientMenuId={openActionMenuId}
              setOpenClientMenuId={setOpenActionMenuId}
            />
          </div>
        </div>

        {/* Row 3: Navigation Tabs */}
        <div className="flex items-center gap-1 border-t border-border/50 pt-2 overflow-x-auto scrollbar-none">
          <button
            type="button"
            className={`clients-ws-tab ${activeTab === "overview" ? "is-active" : ""}`}
            onClick={() => setActiveTab("overview")}>
            <AppIcon name="user" size="xs" />
            <span>Обзор</span>
          </button>

          <button
            type="button"
            className={`clients-ws-tab ${activeTab === "visits" ? "is-active" : ""}`}
            onClick={() => setActiveTab("visits")}>
            <AppIcon name="calendar" size="xs" />
            <span>Визиты</span>
            <span className="clients-ws-tab-badge">{client.appointments.length}</span>
          </button>

          <button
            type="button"
            className={`clients-ws-tab ${activeTab === "payments" ? "is-active" : ""}`}
            onClick={() => setActiveTab("payments")}>
            <AppIcon name="dollarSign" size="xs" />
            <span>Оплаты</span>
          </button>

          <button
            type="button"
            className={`clients-ws-tab ${activeTab === "packages" ? "is-active" : ""}`}
            onClick={() => setActiveTab("packages")}>
            <AppIcon name="package" size="xs" />
            <span>Пакеты</span>
            {(client.packagesCount > 0 || client.activeCertificates.length > 0) && (
              <span className="clients-ws-tab-badge is-highlight">
                {client.packagesCount + client.activeCertificates.length}
              </span>
            )}
          </button>

          <button
            type="button"
            className={`clients-ws-tab ${activeTab === "notes" ? "is-active" : ""}`}
            onClick={() => setActiveTab("notes")}>
            <AppIcon name="fileText" size="xs" />
            <span>Заметки</span>
            {client.hasNote && <span className="clients-ws-tab-dot" />}
          </button>

          <button
            type="button"
            className={`clients-ws-tab ${activeTab === "messages" ? "is-active" : ""}`}
            onClick={() => setActiveTab("messages")}>
            <AppIcon name="message" size="xs" />
            <span>Сообщения</span>
            {clientCommunications.length > 0 && (
              <span className="clients-ws-tab-badge">{clientCommunications.length}</span>
            )}
          </button>
        </div>
      </div>

      {/* 2. Scrollable Body Content */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {/* ===================== TAB 1: OVERVIEW ===================== */}
        {activeTab === "overview" && (
          <div className="space-y-3.5">
            {/* 2x2 Stats Grid */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-xl bg-surface-2 border border-border/70 flex flex-col justify-between">
                <span className="text-[10px] text-textMuted uppercase font-semibold tracking-wider">Всего визитов</span>
                <strong className="text-base font-bold text-textPrimary mt-1">
                  {client.visitsCount}
                </strong>
                <small className="text-[10px] text-textFaint">
                  {client.completedVisitsCount} завершено · {client.upcomingVisitsCount} план
                </small>
              </div>

              <div className="p-3 rounded-xl bg-surface-2 border border-border/70 flex flex-col justify-between">
                <span className="text-[10px] text-textMuted uppercase font-semibold tracking-wider">Общая сумма</span>
                <strong className="text-base font-bold text-textPrimary mt-1">
                  {formatMoney(client.totalIncome)}
                </strong>
                <small className="text-[10px] text-textFaint">выручка по клиенту</small>
              </div>

              <div className="p-3 rounded-xl bg-surface-2 border border-border/70 flex flex-col justify-between">
                <span className="text-[10px] text-textMuted uppercase font-semibold tracking-wider">Средний чек</span>
                <strong className="text-base font-bold text-textPrimary mt-1">
                  {formatMoney(client.averageCheck)}
                </strong>
                <small className="text-[10px] text-textFaint">за завершённый визит</small>
              </div>

              <div className="p-3 rounded-xl bg-surface-2 border border-border/70 flex flex-col justify-between">
                <span className="text-[10px] text-textMuted uppercase font-semibold tracking-wider">Последний визит</span>
                <strong className="text-base font-bold text-textPrimary mt-1 truncate">
                  {client.lastVisit}
                </strong>
                <small className="text-[10px] text-textFaint">
                  {client.daysAbsent === null ? "ещё не приходил" : `${client.daysAbsent} дн. назад`}
                </small>
              </div>
            </div>

            {/* Next appointment */}
            <div className="p-3 rounded-xl bg-surface-2 border border-border/70 flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-field flex items-center justify-center text-textMuted shrink-0">
                  <AppIcon name="calendar" size="xs" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] text-textMuted uppercase font-semibold tracking-wider">Следующая запись</span>
                  <strong className="text-xs font-semibold text-textPrimary truncate">
                    {formatAppointmentSummary(client.nextAppointment)}
                  </strong>
                  <span className="text-[11px] text-textMuted truncate">
                    {client.nextAppointment?.service || "Нет запланированных сеансов"}
                  </span>
                </div>
              </div>

              <Button
                size="sm"
                variant={client.nextAppointment ? "secondary" : "primary"}
                onClick={() => onAddVisit?.({
                  client: client.name,
                  clientId: client.id,
                  date: new Date().toISOString().slice(0, 10),
                  kind: "visit",
                })}>
                {client.nextAppointment ? "Ещё" : "+ Запись"}
              </Button>
            </div>

            {/* Contacts & Parameters: Compact grouped list */}
            <div className="p-3.5 rounded-xl bg-surface-2 border border-border/70 space-y-2.5">
              <span className="text-[11px] text-textMuted font-semibold uppercase tracking-wider block">Контакты и параметры</span>

              <div className="space-y-1 text-xs divide-y divide-border/30">
                <div className="flex items-center justify-between py-1">
                  <span className="text-textMuted text-[11px]">Телефон</span>
                  <strong className="text-textPrimary">{client.phone || "—"}</strong>
                </div>

                {client.email && (
                  <div className="flex items-center justify-between py-1">
                    <span className="text-textMuted text-[11px]">Email</span>
                    <strong className="text-textPrimary truncate max-w-[220px]">{client.email}</strong>
                  </div>
                )}

                {client.telegram && (
                  <div className="flex items-center justify-between py-1">
                    <span className="text-textMuted text-[11px]">Telegram</span>
                    <strong className="text-sky-400">{client.telegram}</strong>
                  </div>
                )}

                {client.instagram && (
                  <div className="flex items-center justify-between py-1">
                    <span className="text-textMuted text-[11px]">Instagram</span>
                    <strong className="text-textPrimary">{client.instagram}</strong>
                  </div>
                )}

                {client.birthday && (
                  <div className="flex items-center justify-between py-1">
                    <span className="text-textMuted text-[11px]">Дата рождения</span>
                    <div className="flex items-center gap-1.5">
                      <strong className="text-textPrimary">{client.birthday}</strong>
                      <span className="text-amber-400" title="Участвует в уведомлениях CRM">
                        <AppIcon name="cake" size="xs" />
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between py-1">
                  <span className="text-textMuted text-[11px]">Любимый мастер</span>
                  <strong className="text-textPrimary">{client.preference || "Любой мастер"}</strong>
                </div>

                <div className="flex items-center justify-between py-1">
                  <span className="text-textMuted text-[11px]">Язык сообщений</span>
                  <strong className="text-textPrimary">{client.messageLanguage || "Польский"}</strong>
                </div>

                <div className="flex items-center justify-between py-1">
                  <span className="text-textMuted text-[11px]">Любимая услуга</span>
                  <strong className="text-textPrimary truncate max-w-[220px]">{client.favoriteService || "—"}</strong>
                </div>

                {client.source && (
                  <div className="flex items-center justify-between py-1">
                    <span className="text-textMuted text-[11px]">Источник</span>
                    <strong className="text-textPrimary">{client.source}</strong>
                  </div>
                )}

                {client.tags && (
                  <div className="flex items-center justify-between py-1">
                    <span className="text-textMuted text-[11px]">Теги</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-field border border-border text-textMuted">
                      {client.tags}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Note Editor */}
            <div className="p-3.5 rounded-xl bg-surface-2 border border-border/70 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-textMuted font-semibold uppercase tracking-wider">Заметка о клиенте</span>
                {noteSavedFeedback && (
                  <span className="text-[10px] text-emerald-400 font-medium">Сохранено</span>
                )}
              </div>
              <Textarea
                key={`${client.id}-${client.note || ""}`}
                className="w-full min-h-20 p-2.5 rounded-lg border border-border bg-field text-textPrimary text-xs resize-y focus:outline-none focus:border-borderStrong transition-all"
                defaultValue={client.note || ""}
                placeholder="Заметки, пожелания, противопоказания..."
                rows={3}
                onBlur={handleNoteBlur}
              />
            </div>

            {/* Loyalty Card */}
            <ClientLoyaltyCard client={client} key={client.id} />
          </div>
        )}

        {/* ===================== TAB 2: VISITS ===================== */}
        {activeTab === "visits" && (
          <div className="space-y-3">
            {/* Sub-tabs: All / Future / Past */}
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-surface-2 border border-border">
                <button
                  type="button"
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                    visitHistoryFilter === "all" ? "bg-field text-textPrimary" : "text-textMuted hover:text-textPrimary"
                  }`}
                  onClick={() => setVisitHistoryFilter("all")}>
                  Все ({client.appointments.length})
                </button>
                <button
                  type="button"
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                    visitHistoryFilter === "future" ? "bg-field text-textPrimary" : "text-textMuted hover:text-textPrimary"
                  }`}
                  onClick={() => setVisitHistoryFilter("future")}>
                  Будущие ({client.upcomingVisitsCount})
                </button>
                <button
                  type="button"
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                    visitHistoryFilter === "past" ? "bg-field text-textPrimary" : "text-textMuted hover:text-textPrimary"
                  }`}
                  onClick={() => setVisitHistoryFilter("past")}>
                  Прошлые ({client.completedVisitsCount})
                </button>
              </div>

              <Button
                leftIcon="calendarPlus"
                size="sm"
                variant="primary"
                onClick={() => onAddVisit?.({
                  client: client.name,
                  clientId: client.id,
                  date: new Date().toISOString().slice(0, 10),
                  kind: "visit",
                })}>
                + Записать
              </Button>
            </div>

            {/* Appointments List for Drawer */}
            <div className="border border-border/70 rounded-xl overflow-hidden divide-y divide-border/40 bg-surface-2">
              {filteredAppointments.map((appointment) => (
                <div
                  key={appointment.id}
                  className="p-3 text-xs flex flex-col gap-1.5 hover:bg-field/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-textPrimary">
                      {appointment.date} {appointment.time !== "—" ? `· ${appointment.time}` : ""}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      appointment.status === "Окончен"
                        ? "text-emerald-400 bg-emerald-400/10"
                        : appointment.status === "Запланирован"
                          ? "text-sky-400 bg-sky-400/10"
                          : "text-rose-400 bg-rose-400/10"
                    }`}>
                      {appointment.status}
                    </span>
                  </div>

                  <div className="font-medium text-textPrimary truncate">
                    {appointment.service}
                  </div>

                  <div className="flex items-center justify-between text-textMuted text-[11px] pt-1">
                    <span>{appointment.master} · {appointment.payment}</span>
                    <div className="flex items-center gap-2">
                      <strong className="text-textPrimary font-semibold">
                        {appointment.total === null ? "После визита" : formatMoney(appointment.total)}
                      </strong>
                      <Button
                        leftIcon="rotateCcw"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRepeatVisit?.(client, appointment)}>
                        Повторить
                      </Button>
                    </div>
                  </div>
                </div>
              ))}

              {filteredAppointments.length === 0 && (
                <div className="p-8 text-center text-textMuted text-xs">
                  Визитов в этой категории не найдено.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================== TAB 3: PAYMENTS ===================== */}
        {activeTab === "payments" && (
          <div className="space-y-3.5">
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-xl bg-surface-2 border border-border/70">
                <span className="text-[10px] text-textMuted uppercase font-semibold tracking-wider">Всего оплачено</span>
                <strong className="block text-base font-bold text-textPrimary mt-1">
                  {formatMoney(client.totalIncome)}
                </strong>
              </div>

              <div className={`p-3 rounded-xl bg-surface-2 border ${
                client.hasDebt ? "border-rose-500/50 bg-rose-500/5" : "border-border/70"
              }`}>
                <span className="text-[10px] text-textMuted uppercase font-semibold tracking-wider">Текущий долг</span>
                <strong className={`block text-base font-bold mt-1 ${client.hasDebt ? "text-rose-400" : "text-textPrimary"}`}>
                  {client.hasDebt ? formatMoney(client.totalDebt) : "0 zł (нет долгов)"}
                </strong>
              </div>
            </div>

            {/* List of payments */}
            <div className="border border-border/70 rounded-xl overflow-hidden divide-y divide-border/40 bg-surface-2">
              {client.appointments
                .filter((app) => app.total !== null && app.total > 0)
                .map((appointment) => (
                  <div
                    key={appointment.id}
                    className="p-3 text-xs flex items-center justify-between gap-2 hover:bg-field/50 transition-colors">
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-textPrimary">{appointment.date}</span>
                      <span className="text-textMuted text-[11px] truncate">{appointment.service} · {appointment.payment}</span>
                    </div>
                    <strong className="text-textPrimary font-bold text-sm shrink-0">
                      {formatMoney(appointment.total)}
                    </strong>
                  </div>
                ))}

              {client.appointments.filter((app) => app.total !== null && app.total > 0).length === 0 && (
                <div className="p-8 text-center text-textMuted text-xs">
                  Оплат по клиенту пока не зафиксировано.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================== TAB 4: PACKAGES & CERTIFICATES ===================== */}
        {activeTab === "packages" && (
          <div className="space-y-3.5">
            {/* Active Packages */}
            <div className="space-y-2">
              <strong className="text-[11px] text-textMuted uppercase tracking-wider font-semibold block">
                Абонементы и пакеты ({client.activePackages.length})
              </strong>

              {client.activePackages.length > 0 ? (
                <div className="space-y-2">
                  {client.activePackages.map((pkg) => (
                    <div
                      key={pkg.id}
                      className="p-3 rounded-xl bg-surface-2 border border-border/70 flex flex-col gap-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <strong className="text-xs font-semibold text-textPrimary">{pkg.packageName || "Пакет"}</strong>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold text-emerald-400 bg-emerald-400/10">
                          Активен
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-textMuted pt-1.5 border-t border-border/30">
                        <span>Осталось сеансов:</span>
                        <strong className="text-textPrimary font-bold">
                          {pkg.remainingVisits} из {pkg.totalVisits || pkg.visitsCount || "—"}
                        </strong>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="p-3.5 text-center text-textMuted text-xs bg-surface-2 rounded-xl border border-border/60">
                  Активных пакетов нет.
                </p>
              )}
            </div>

            {/* Active Certificates */}
            <div className="space-y-2 pt-2">
              <strong className="text-[11px] text-textMuted uppercase tracking-wider font-semibold block">
                Сертификаты ({client.activeCertificates.length})
              </strong>

              {client.activeCertificates.length > 0 ? (
                <div className="space-y-2">
                  {client.activeCertificates.map((cert) => (
                    <div
                      key={cert.id}
                      className="p-3 rounded-xl bg-surface-2 border border-border/70 flex flex-col gap-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <strong className="text-xs font-semibold text-textPrimary font-mono">
                          {cert.code || "Сертификат"}
                        </strong>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold text-amber-400 bg-amber-400/10">
                          Действует
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-textMuted pt-1.5 border-t border-border/30">
                        <span>Остаток баланса:</span>
                        <strong className="text-textPrimary font-bold">
                          {getCertificateBalanceLabel(cert)}
                        </strong>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="p-3.5 text-center text-textMuted text-xs bg-surface-2 rounded-xl border border-border/60">
                  Активных сертификатов нет.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ===================== TAB 5: NOTES ===================== */}
        {activeTab === "notes" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <strong className="text-xs font-semibold text-textPrimary">Заметки и особенности клиента</strong>
                <p className="text-[11px] text-textMuted">Сохраняется автоматически при снятии фокуса</p>
              </div>
              {noteSavedFeedback && (
                <span className="text-xs text-emerald-400 font-medium">Сохранено!</span>
              )}
            </div>

            <Textarea
              key={`${client.id}-${client.note || ""}-tab`}
              className="w-full min-h-48 p-3.5 rounded-xl border border-border bg-surface-2 text-textPrimary text-xs resize-y focus:outline-none focus:border-borderStrong transition-all leading-relaxed"
              defaultValue={client.note || ""}
              placeholder="Персональные пожелания, любимые зоны массажа, противопоказания, детали разговоров..."
              rows={8}
              onBlur={handleNoteBlur}
            />
          </div>
        )}

        {/* ===================== TAB 6: MESSAGES ===================== */}
        {activeTab === "messages" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <strong className="text-xs font-semibold text-textPrimary">История коммуникаций</strong>
                <p className="text-[11px] text-textMuted">SMS, Telegram и напоминания</p>
              </div>

              <Button
                leftIcon="message"
                size="sm"
                variant="primary"
                onClick={() => onMessageClient?.(client)}>
                Написать
              </Button>
            </div>

            <div className="border border-border/70 rounded-xl overflow-hidden divide-y divide-border/40 bg-surface-2">
              {clientCommunications.map((entry) => (
                <div key={entry.id} className="p-3 flex items-center justify-between gap-2.5 text-xs">
                  <div className="flex flex-col gap-0.5">
                    <strong className="font-semibold text-textPrimary">{entry.channel}</strong>
                    <span className="text-textMuted text-[11px]">{entry.templateName}</span>
                  </div>
                  <span className="text-textFaint text-[10px]">
                    {new Date(entry.createdAt).toLocaleString("ru-RU", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))}

              {clientCommunications.length === 0 && (
                <div className="p-8 text-center text-textMuted text-xs">
                  История сообщений пуста. Нажмите «Написать» для отправки сообщения.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(ClientWorkspace);
