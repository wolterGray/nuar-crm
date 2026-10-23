import {useCallback, useEffect, useMemo, useState} from "react";
import {createPortal} from "react-dom";
import {useModalScrollLock} from "../hooks/useModalScrollLock.js";
import {useBreakpoint} from "../hooks/useBreakpoint.js";
import {
  formatWaitlistDisplayDate,
  formatWaitlistDisplayTime,
  parseWaitlistEntryDetails,
} from "../utils/waitlist.js";
import {AppIcon, Badge, Button, IconButton} from "./ui/index.js";
import {formatMoney} from "../utils/formatters.jsx";

export default function WaitlistDetailDrawer({
  clientProfiles = [],
  entry = null,
  isOpen = false,
  onBook,
  onClose,
  onEdit,
  onMessage,
  onRemove,
  onRestore,
}) {
  useModalScrollLock(isOpen);
  const {isMobile} = useBreakpoint();
  const [copiedId, setCopiedId] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const details = useMemo(
    () => (entry ? parseWaitlistEntryDetails(entry, clientProfiles) : null),
    [entry, clientProfiles],
  );

  const cleanPhone = details?.clientPhone
    ? details.clientPhone.replace(/[^\d+]/g, "")
    : "";

  const formattedPhone = details?.clientPhone || "";

  const handleCopyId = useCallback(async () => {
    if (!details?.siteBookingRequestId) return;
    try {
      await navigator.clipboard.writeText(details.siteBookingRequestId);
      setCopiedId(true);
      window.setTimeout(() => setCopiedId(false), 2000);
    } catch {
      // ignore clipboard error
    }
  }, [details]);

  const handleContact = useCallback(() => {
    if (!details) return;
    if (details.linkedClient) {
      onMessage?.(details.rawEntry);
      return;
    }
    if (cleanPhone) {
      window.open(`https://wa.me/${cleanPhone.replace("+", "")}`, "_blank", "noopener,noreferrer");
      return;
    }
    if (details.clientEmail) {
      window.location.href = `mailto:${details.clientEmail}`;
    }
  }, [details, cleanPhone, onMessage]);

  const handleBookClick = useCallback(() => {
    if (!entry) return;
    onBook?.(entry);
    onClose?.();
  }, [entry, onBook, onClose]);

  const handleEditClick = useCallback(() => {
    if (!entry) return;
    setMenuOpen(false);
    onEdit?.(entry);
    onClose?.();
  }, [entry, onEdit, onClose]);

  const handleDeleteClick = useCallback(() => {
    if (!entry) return;
    setMenuOpen(false);
    setConfirmDelete(false);
    onRemove?.(entry);
    onClose?.();
  }, [entry, onRemove, onClose]);

  const handleRestoreClick = useCallback(() => {
    if (!entry) return;
    onRestore?.(entry.id);
    onClose?.();
  }, [entry, onRestore, onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        if (confirmDelete) {
          setConfirmDelete(false);
        } else if (menuOpen) {
          setMenuOpen(false);
        } else {
          onClose?.();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, menuOpen, confirmDelete, onClose]);

  if (!isOpen || !details) return null;

  const drawerElement = (
    <div
      className={`waitlist-drawer-backdrop mac-window-backdrop ${isMobile ? "is-mobile" : "is-desktop"}`}
      role="presentation"
      onClick={onClose}
    >
      <aside
        aria-label="Детали заявки"
        className={`waitlist-drawer mac-window-surface ${isMobile ? "waitlist-drawer-mobile" : "waitlist-drawer-desktop"}`}
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <header className="waitlist-drawer-header">
          <div className="waitlist-drawer-header-left">
            <div className="waitlist-drawer-title-row">
              <h2 className="waitlist-drawer-client-name">{details.clientName}</h2>
              <Badge size="sm" variant={details.statusBadge.variant}>
                {details.statusBadge.label}
              </Badge>
            </div>
            <div className="waitlist-drawer-source-row">
              <span className={`waitlist-source-pill waitlist-source-${details.source}`}>
                <AppIcon name={details.source === "site" ? "globe" : "user"} size="xs" />
                {details.sourceLabel}
              </span>
              {details.createdAt ? (
                <span className="waitlist-drawer-created">
                  Создана: {new Date(details.createdAt).toLocaleDateString("ru-RU", {day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"})}
                </span>
              ) : null}
            </div>
          </div>

          <div className="waitlist-drawer-header-actions">
            {/* Secondary actions dropdown */}
            <div className="waitlist-drawer-menu-wrap">
              <IconButton
                aria-expanded={menuOpen}
                aria-label="Опции заявки"
                className="waitlist-drawer-menu-btn"
                icon="moreVertical"
                size="sm"
                variant="ghost"
                onClick={() => setMenuOpen((prev) => !prev)}
              />

              {menuOpen ? (
                <>
                  <div className="waitlist-menu-backdrop" onClick={() => setMenuOpen(false)} />
                  <div className="waitlist-menu-dropdown" role="menu">
                    {!details.isDeleted ? (
                      <>
                        <button
                          className="waitlist-menu-item"
                          type="button"
                          onClick={handleEditClick}
                        >
                          <AppIcon name="edit" size="sm" />
                          <span>Редактировать пожелания</span>
                        </button>
                        <button
                          className="waitlist-menu-item text-danger"
                          type="button"
                          onClick={() => {
                            setMenuOpen(false);
                            setConfirmDelete(true);
                          }}
                        >
                          <AppIcon name="trash" size="sm" />
                          <span>Удалить заявку</span>
                        </button>
                      </>
                    ) : (
                      <button
                        className="waitlist-menu-item text-success"
                        type="button"
                        onClick={handleRestoreClick}
                      >
                        <AppIcon name="refreshCw" size="sm" />
                        <span>Восстановить в очередь</span>
                      </button>
                    )}
                  </div>
                </>
              ) : null}
            </div>

            <IconButton
              aria-label="Закрыть панель"
              className="waitlist-drawer-close"
              icon="x"
              size="sm"
              variant="ghost"
              onClick={onClose}
            />
          </div>
        </header>

        {/* Confirmation banner if delete requested */}
        {confirmDelete ? (
          <div className="waitlist-delete-confirm-banner">
            <div className="waitlist-delete-confirm-text">
              <strong>Удалить заявку из очереди?</strong>
              <p>Заявка будет перемещена в раздел «Удалённые» с возможностью восстановления.</p>
            </div>
            <div className="waitlist-delete-confirm-actions">
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                Отмена
              </Button>
              <Button size="sm" variant="danger" onClick={handleDeleteClick}>
                Удалить
              </Button>
            </div>
          </div>
        ) : null}

        {/* Scrollable Body */}
        <div className="waitlist-drawer-body">
          {/* Quick Contact Card */}
          <section className="waitlist-drawer-section waitlist-contact-card">
            <h3 className="waitlist-section-title">Контактные данные</h3>
            <div className="waitlist-contact-grid">
              <div className="waitlist-contact-row">
                <span className="waitlist-contact-label">
                  <AppIcon name="phone" size="sm" />
                  Телефон
                </span>
                {cleanPhone ? (
                  <div className="waitlist-contact-actions">
                    <a className="waitlist-contact-link font-medium" href={`tel:${cleanPhone}`}>
                      {formattedPhone}
                    </a>
                    <div className="waitlist-contact-pills">
                      <a
                        className="waitlist-action-pill"
                        href={`tel:${cleanPhone}`}
                        title="Позвонить"
                      >
                        <AppIcon name="phone" size="xs" />
                        <span>Звонок</span>
                      </a>
                      <a
                        className="waitlist-action-pill waitlist-pill-wa"
                        href={`https://wa.me/${cleanPhone.replace("+", "")}`}
                        rel="noopener noreferrer"
                        target="_blank"
                        title="Написать в WhatsApp"
                      >
                        <AppIcon name="messageSquare" size="xs" />
                        <span>WhatsApp</span>
                      </a>
                    </div>
                  </div>
                ) : (
                  <span className="waitlist-empty-val">Не указан</span>
                )}
              </div>

              <div className="waitlist-contact-row">
                <span className="waitlist-contact-label">
                  <AppIcon name="mail" size="sm" />
                  Email
                </span>
                {details.clientEmail ? (
                  <a
                    className="waitlist-contact-link text-truncate font-medium"
                    href={`mailto:${details.clientEmail}`}
                  >
                    {details.clientEmail}
                  </a>
                ) : (
                  <span className="waitlist-empty-val">Не указан</span>
                )}
              </div>
            </div>
          </section>

          {/* Booking Request Parameters */}
          <section className="waitlist-drawer-section">
            <h3 className="waitlist-section-title">Параметры записи</h3>
            <div className="waitlist-params-list">
              <div className="waitlist-param-item">
                <div className="waitlist-param-icon">
                  <AppIcon name="sparkles" size="sm" />
                </div>
                <div className="waitlist-param-content">
                  <span className="waitlist-param-label">Услуга</span>
                  <span className="waitlist-param-value">
                    {details.preferredService || "Любая услуга"}
                  </span>
                </div>
              </div>

              {details.bookedPrice ? (
                <div className="waitlist-param-item">
                  <div className="waitlist-param-icon">
                    <AppIcon name="banknote" size="sm" />
                  </div>
                  <div className="waitlist-param-content">
                    <span className="waitlist-param-label">Цена при бронировании</span>
                    <span className="waitlist-param-value font-medium">
                      {formatMoney(details.bookedPrice)}
                    </span>
                  </div>
                </div>
              ) : null}

              <div className="waitlist-param-item">
                <div className="waitlist-param-icon">
                  <AppIcon name="clock" size="sm" />
                </div>
                <div className="waitlist-param-content">
                  <span className="waitlist-param-label">Длительность</span>
                  <span className="waitlist-param-value">
                    {details.durationMinutes ? `${details.durationMinutes} мин` : "60 мин"}
                  </span>
                </div>
              </div>

              <div className="waitlist-param-item">
                <div className="waitlist-param-icon">
                  <AppIcon name="calendar" size="sm" />
                </div>
                <div className="waitlist-param-content">
                  <span className="waitlist-param-label">Дата и время</span>
                  <span className="waitlist-param-value font-medium">
                    {formatWaitlistDisplayDate(details.preferredDate)} · {formatWaitlistDisplayTime(details.preferredTimeFrom, details.preferredTimeTo)}
                  </span>
                </div>
              </div>

              <div className="waitlist-param-item">
                <div className="waitlist-param-icon">
                  <AppIcon name="user" size="sm" />
                </div>
                <div className="waitlist-param-content">
                  <span className="waitlist-param-label">Специалист</span>
                  <span className="waitlist-param-value">
                    {details.preferredMaster || "Любой мастер"}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Client Note / Wishes */}
          <section className="waitlist-drawer-section">
            <h3 className="waitlist-section-title">Пожелания клиента</h3>
            {details.clientComment ? (
              <div className="waitlist-comment-box">
                <AppIcon className="waitlist-comment-icon" name="messageSquare" size="sm" />
                <p className="waitlist-comment-text">{details.clientComment}</p>
              </div>
            ) : (
              <p className="waitlist-empty-comment">Клиент не оставил дополнительного комментария.</p>
            )}
          </section>

          {/* Technical Metadata */}
          {details.siteBookingRequestId ? (
            <section className="waitlist-drawer-section waitlist-meta-section">
              <span className="waitlist-section-title">Служебные данные</span>
              <div className="waitlist-tech-chip">
                <span>ID онлайн-заявки:</span>
                <code>{details.siteBookingRequestId}</code>
                <button
                  className="waitlist-copy-btn"
                  title="Скопировать ID"
                  type="button"
                  onClick={handleCopyId}
                >
                  <AppIcon name={copiedId ? "check" : "copy"} size="xs" />
                  <span>{copiedId ? "Скопировано" : "Копия"}</span>
                </button>
              </div>
            </section>
          ) : null}
        </div>

        {/* Sticky Footer Actions */}
        <footer className="waitlist-drawer-footer">
          {details.isDeleted ? (
            <Button
              className="waitlist-footer-restore"
              fullWidth
              leftIcon="refreshCw"
              size="lg"
              variant="primary"
              onClick={handleRestoreClick}
            >
              Восстановить в очередь
            </Button>
          ) : (
            <div className="waitlist-footer-buttons">
              <Button
                className="waitlist-footer-btn-secondary"
                leftIcon="messageSquare"
                size="md"
                variant="secondary"
                onClick={handleContact}
              >
                Связаться
              </Button>
              <Button
                className="waitlist-footer-btn-primary"
                leftIcon="calendarPlus"
                size="md"
                variant="primary"
                onClick={handleBookClick}
              >
                Записать
              </Button>
            </div>
          )}
        </footer>
      </aside>
    </div>
  );

  if (typeof document !== "undefined") {
    const portalTarget = document.querySelector(".crm-shell") ?? document.body;
    return createPortal(drawerElement, portalTarget);
  }

  return drawerElement;
}
