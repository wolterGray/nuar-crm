import clsx from "clsx";
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {changePassword} from "../../api/auth.js";
import {
  createUser,
  disableUser,
  enableUser,
  fetchUsers,
  resetUserPassword,
  updateUser,
} from "../../api/users.js";
import {COLOR_THEME_OPTIONS} from "../../constants/colorThemes.js";
import {useBreakpoint} from "../../hooks/useBreakpoint.js";
import {useRowActionMenu} from "../../hooks/useRowActionMenu.js";
import {applyColorTheme, resolveColorTheme} from "../../utils/colorTheme.js";
import {buildIntegrationHealth} from "../../utils/integrationHealth.js";
import {
  generateStrongPassword,
  validatePasswordStrength,
} from "../../utils/passwordStrength.js";
import RowActionMenuPortal from "../RowActionMenuPortal.jsx";
import UserAccessDrawer from "../users/UserAccessDrawer.jsx";
import {
  USER_ROLE_OPTIONS,
  ROLE_BADGE_VARIANTS,
  ROLE_LABELS,
} from "../../constants/userRoles.js";
import HintIcon, {FieldLabel} from "../HintIcon.jsx";
import InactiveFollowUpPanel from "../InactiveFollowUpPanel.jsx";
import PushNotificationsPanel from "../PushNotificationsPanel.jsx";
import ReviewRequestsPanel from "../ReviewRequestsPanel.jsx";
import SettingsToggle from "../SettingsToggle.jsx";
import SmsRemindersPanel from "../SmsRemindersPanel.jsx";
import TelegramDigestPanel from "../TelegramDigestPanel.jsx";
import "./SettingsPage.css";
import {
  AppIcon,
  Badge,
  Button,
  Card,
  Dialog,
  DialogBackdrop,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  IconButton,
  Input,
  PageHeader,
  SearchControl,
  Select,
  TabButton,
  Tabs,
} from "../ui/index.js";
import {
  PERMISSIONS,
  hasPermission,
} from "../../utils/permissions.js";

function SettingsMobileSection({children, isMobile, title}) {
  if (!isMobile) {
    return children;
  }

  return (
    <section className="settings-mobile-section flex flex-col gap-3 p-3.5 border border-border/60 bg-surface/50 rounded-card mb-3">
      <h3 className="m-0 text-text-main text-sm font-semibold tracking-tight border-b border-border-soft pb-2">{title}</h3>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function StatusBadge({tone = "neutral", children}) {
  const toneClass =
    tone === "success"
      ? "border-accentSuccess/40 bg-accentSuccess/10 text-accentSuccess"
      : tone === "warning"
        ? "border-accentWarning/40 bg-accentWarning/10 text-accentWarning"
        : tone === "error"
          ? "border-accentError/40 bg-accentError/10 text-accentError"
          : "border-border-soft bg-surface text-text-muted";

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap",
        toneClass,
      )}
    >
      {children}
    </span>
  );
}

function IntegrationHealthPanel({actions = {}, report}) {
  const overallState =
    report.summary.warning > 0 ? "warning" : report.summary.ok > 0 ? "ok" : "off";
  const overallLabel =
    overallState === "warning"
      ? "Требуется проверка параметров"
      : overallState === "ok"
        ? "Активные каналы работают"
        : "Автоматические каналы выключены";

  return (
    <div className={clsx("integration-health-panel p-3.5 border border-border-soft rounded-control bg-surface flex flex-col gap-3", `is-${overallState}`)}>
      <div className="integration-health-overview flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <span className="block text-text-faint text-[11px]">Сводка состояния</span>
          <strong className="block text-text-main text-sm font-bold mt-0.5">{overallLabel}</strong>
        </div>
        <div className="integration-health-actions flex items-center flex-wrap gap-2.5">
          <div className="integration-health-counts flex items-center gap-3 bg-field px-2.5 py-1 rounded-control border border-border-soft">
            <span className="text-text-muted text-xs font-semibold">
              <b className="settings-state-count is-ok mr-1">{report.summary.ok}</b> OK
            </span>
            <span className="text-text-muted text-xs font-semibold">
              <b className="settings-state-count is-warning mr-1">{report.summary.warning}</b> Внимание
            </span>
            <span className="text-text-muted text-xs font-semibold">
              <b className="text-text-faint mr-1">{report.summary.off}</b> Выкл
            </span>
          </div>
          <Button
            size="sm"
            type="button"
            variant="secondary"
            disabled={actions.refreshingAll}
            onClick={() => actions.onRefreshAll?.()}
          >
            {actions.refreshingAll ? "Проверяю..." : "Обновить статусы"}
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {report.items.map((item) => {
          const itemActions = actions.itemActions?.[item.id] ?? [];

          return (
            <article
              key={item.id}
              className={clsx(
                "integration-health-item p-3 border border-border-soft rounded-control bg-field flex flex-col sm:flex-row sm:items-center justify-between gap-3",
                `is-${item.state}`,
              )}
            >
              <div className="flex gap-2.5 items-start">
                <span className={clsx("settings-state-dot w-2 h-2 rounded-full mt-1.5 shrink-0", `is-${item.state}`)} />
                <div>
                  <strong className="block text-text-main text-[13px] font-semibold">{item.name}</strong>
                  <small className="block text-text-muted text-xs mt-0.5">{item.message}</small>
                  {item.diagnostic && (
                    <p className="m-0 mt-1 text-text-faint text-[11px] leading-snug">{item.diagnostic}</p>
                  )}
                </div>
              </div>
              <div className="integration-health-item-actions flex flex-col sm:items-end gap-1.5 shrink-0">
                <em className="text-text-faint text-[11px] not-italic font-medium">{item.lastRunLabel}</em>
                {itemActions.length ? (
                  <div className="flex items-center gap-1.5">
                    {itemActions.map((action) => (
                      <Button
                        variant={action.primary ? "primary" : "secondary"}
                        size="sm"
                        type="button"
                        disabled={action.disabled}
                        key={action.label}
                        onClick={action.onClick}
                      >
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


const formatUserDate = (value) => {
  if (!value) return "Никогда";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Никогда";

  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getUserInitials = (name = "", email = "") => {
  const cleanName = String(name || "").trim();
  if (cleanName) {
    const parts = cleanName.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return cleanName.slice(0, 2).toUpperCase();
  }
  const cleanEmail = String(email || "").trim();
  if (cleanEmail) {
    return cleanEmail.slice(0, 2).toUpperCase();
  }
  return "NU";
};

function UserRowActionsMenu({
  user,
  isOwner,
  authUser,
  openMenuId,
  setOpenMenuId,
  onEdit,
  onOpenPermissions,
  onResetPassword,
  onToggleStatus,
}) {
  const isOpen = openMenuId === user.id;
  const { menuRef, menuStyle, triggerRef } = useRowActionMenu({
    isOpen,
    setOpenMenuId,
  });

  const isOwnerProtected = !isOwner && user.role === "owner";
  const isEditingSelf = String(authUser?.id) === String(user.id);
  const customPermCount = Object.keys(user.permissions || {}).length;

  const handleAction = (e, callback) => {
    e.preventDefault();
    e.stopPropagation();
    setOpenMenuId(null);
    window.setTimeout(() => callback(user), 0);
  };

  return (
    <div
      className="relative flex items-center justify-end"
      onClick={(e) => e.stopPropagation()}
    >
      <IconButton
        ref={triggerRef}
        aria-expanded={isOpen}
        icon="ellipsis"
        label="Действия"
        size="sm"
        variant="ghost"
        disabled={isOwnerProtected}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpenMenuId(isOpen ? null : user.id);
        }}
      />

      <RowActionMenuPortal
        isOpen={isOpen}
        menuRef={menuRef}
        menuStyle={menuStyle}
      >
        <div
          className="crm-user-menu"
          role="menu"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="crm-user-menu-item"
            role="menuitem"
            type="button"
            disabled={isOwnerProtected}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => handleAction(e, onEdit)}
          >
            <AppIcon name="pencil" size="xs" />
            <span>Редактировать</span>
          </button>

          <button
            className="crm-user-menu-item"
            role="menuitem"
            type="button"
            disabled={isOwnerProtected}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => handleAction(e, onOpenPermissions)}
          >
            <AppIcon name="shield" size="xs" />
            <span>Права доступа</span>
            {customPermCount > 0 ? (
              <span className="ml-auto rounded-full bg-accent/20 px-1.5 py-0.2 text-[10px] text-accent font-bold">
                {customPermCount}
              </span>
            ) : null}
          </button>

          <button
            className="crm-user-menu-item"
            role="menuitem"
            type="button"
            disabled={!user.isActive || isOwnerProtected}
            title={!user.isActive ? "Пользователь отключён" : ""}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => handleAction(e, onResetPassword)}
          >
            <AppIcon name="key" size="xs" />
            <span>Сбросить пароль</span>
          </button>

          <div className="crm-user-menu-divider" />

          <button
            className={clsx(
              "crm-user-menu-item",
              user.isActive ? "is-danger" : "is-success",
            )}
            role="menuitem"
            type="button"
            disabled={isOwnerProtected || isEditingSelf}
            title={isEditingSelf ? "Нельзя отключить собственный аккаунт" : ""}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => handleAction(e, onToggleStatus)}
          >
            <AppIcon name={user.isActive ? "userX" : "userCheck"} size="xs" />
            <span>{user.isActive ? "Отключить доступ" : "Включить доступ"}</span>
          </button>
        </div>
      </RowActionMenuPortal>
    </div>
  );
}

function CreateEmployeeDialog({
  open,
  onClose,
  allowedRoleOptions,
  employees,
  onSubmit,
  submitting,
  pushNotification,
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("staff");
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState(() => generateStrongPassword());
  const [showPassword, setShowPassword] = useState(true);
  const [copied, setCopied] = useState(false);

  const passwordStrength = useMemo(() => {
    return validatePasswordStrength(password, { email, role });
  }, [password, email, role]);

  const canSubmit = useMemo(() => {
    if (submitting) return false;
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes("@")) return false;
    if (!password || !passwordStrength.isValid) return false;
    return true;
  }, [email, password, passwordStrength.isValid, submitting]);

  const handleGeneratePassword = () => {
    const next = generateStrongPassword({ email });
    setPassword(next);
    setShowPassword(true);
    setCopied(false);
  };

  const handleCopyPassword = async () => {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      pushNotification?.({
        title: "Пароль скопирован",
        message: "Не забудьте нажать «Создать сотрудника»",
        persist: false,
      });
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      pushNotification?.({
        title: "Скопируйте пароль вручную",
        message: password,
        persist: false,
      });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      email: email.trim().toLowerCase(),
      name: name.trim(),
      role,
      employeeId: employeeId ? Number(employeeId) : null,
      deliveryMethod: "manual_temp",
      temporaryPassword: password.trim(),
    });
  };

  return (
    <Dialog open={open}>
      <DialogBackdrop>
        <DialogContent className="max-w-lg p-5 bg-surface border-border rounded-modal shadow-modal flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader className="border-b border-border-soft pb-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-control bg-accent/15 border border-accent/30 flex items-center justify-center shrink-0 text-accent">
                  <AppIcon name="userPlus" size="md" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-text-main m-0">
                    Добавить сотрудника
                  </DialogTitle>
                  <DialogDescription className="text-xs text-text-muted mt-0.5 m-0">
                    Укажите данные для входа и начальный пароль сотрудника
                  </DialogDescription>
                </div>
              </div>
              <IconButton
                icon="x"
                label="Закрыть"
                size="sm"
                variant="ghost"
                onClick={onClose}
              />
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-text-muted text-xs font-medium">
                Email для входа <span className="text-accent">*</span>
                <Input
                  autoComplete="off"
                  placeholder="master@nuarr.pl"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>

              <label className="flex flex-col gap-1 text-text-muted text-xs font-medium">
                Имя сотрудника
                <Input
                  autoComplete="off"
                  placeholder="Например, Натали"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-text-muted text-xs font-medium">
                Роль в CRM
                <Select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  {allowedRoleOptions.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </Select>
              </label>

              <label className="flex flex-col gap-1 text-text-muted text-xs font-medium">
                Привязка к мастеру
                <Select
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                >
                  <option value="">— Без привязки —</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} {emp.role ? `(${emp.role})` : ""}
                    </option>
                  ))}
                </Select>
              </label>
            </div>

            {role === "staff" && !employeeId && (
              <div className="rounded-control border border-accentWarning/30 bg-accentWarning/10 p-3 text-xs text-text-main flex items-start gap-2.5">
                <AppIcon name="alertTriangle" size="sm" className="text-accentWarning shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>Не выбран мастер.</strong> Привяжите учётную запись к сотруднику, чтобы открыть личный календарь и визиты.
                </div>
              </div>
            )}

            {role === "staff" && employeeId && (
              <div className="rounded-control border border-border-soft bg-surface-2/60 p-3 text-xs text-text-muted leading-relaxed">
                Сотрудник сможет работать со своими записями, клиентами, услугами и личными расчётами.
              </div>
            )}

            <div className="p-3.5 bg-surface-2 rounded-control border border-border flex flex-col gap-3 mt-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-text-main text-xs font-semibold">
                  Пароль для входа сотрудника
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="secondary"
                    type="button"
                    onClick={handleGeneratePassword}
                    className="flex items-center gap-1.5"
                  >
                    <AppIcon name="refreshCw" size="xs" />
                    <span>Сгенерировать</span>
                  </Button>
                  <Button
                    size="sm"
                    variant={copied ? "success" : "secondary"}
                    type="button"
                    onClick={handleCopyPassword}
                    disabled={!password}
                    className="flex items-center gap-1.5"
                  >
                    <AppIcon name={copied ? "check" : "copy"} size="xs" />
                    <span>{copied ? "Скопировано!" : "Скопировать"}</span>
                  </Button>
                </div>
              </div>

              <div className="relative flex items-center">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  autoComplete="new-password"
                  placeholder="Минимум 12 символов"
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setCopied(false);
                  }}
                  className="pr-10 font-mono text-sm tracking-wide"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 text-text-muted hover:text-text-main bg-transparent border-0 cursor-pointer p-1"
                  tabIndex="-1"
                  aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                >
                  <AppIcon name={showPassword ? "eyeOff" : "eye"} size="xs" />
                </button>
              </div>

              {password && passwordStrength.failures.length > 0 ? (
                <div className="rounded-control border border-accentError/30 bg-accentError/10 p-2.5 text-[11px] text-accentError flex flex-col gap-0.5">
                  {passwordStrength.failures.map((f, i) => (
                    <span key={i}>• {f}</span>
                  ))}
                </div>
              ) : (
                <span className="text-[11px] text-accentSuccess flex items-center gap-1.5 font-medium">
                  <AppIcon name="check" size="xs" />
                  Надёжный пароль готов к сохранению
                </span>
              )}
            </div>

            <DialogFooter className="border-t border-border-soft pt-3 mt-1 flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                type="button"
                disabled={submitting}
                onClick={onClose}
              >
                Отмена
              </Button>
              <Button
                variant="primary"
                type="submit"
                loading={submitting}
                disabled={!canSubmit}
                leftIcon={<AppIcon name="userPlus" size="sm" />}
              >
                Создать сотрудника
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </DialogBackdrop>
    </Dialog>
  );
}


function TemporaryPasswordDisplayDialog({ data, open, onClose, pushNotification }) {
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!data || !open) return null;

  const handleCopy = async () => {
    if (!data.temporaryPassword) return;
    try {
      await navigator.clipboard.writeText(data.temporaryPassword);
      setCopied(true);
      pushNotification?.({
        title: "Пароль скопирован",
        message: "Передайте его сотруднику по защищённому каналу",
        persist: false,
      });
      setTimeout(() => setCopied(false), 3000);
    } catch {
      pushNotification?.({
        title: "Скопируйте пароль вручную",
        message: data.temporaryPassword,
        persist: false,
      });
    }
  };

  return (
    <Dialog open={open}>
      <DialogBackdrop>
        <DialogContent className="max-w-md p-5 bg-surface border-border rounded-modal shadow-modal flex flex-col gap-4">
          <DialogHeader className="border-b border-border-soft pb-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-control bg-accentSuccess/15 border border-accentSuccess/30 flex items-center justify-center shrink-0 text-accentSuccess">
                  <AppIcon name="lock" size="md" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-text-main m-0">
                    Временный пароль
                  </DialogTitle>
                  <DialogDescription className="text-xs text-text-muted mt-0.5 m-0">
                    {data.user?.name ? `${data.user.name} • ` : ""}{data.user?.email}
                  </DialogDescription>
                </div>
              </div>
              <IconButton
                icon="x"
                label="Закрыть"
                size="sm"
                variant="ghost"
                onClick={onClose}
              />
            </div>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <div className="rounded-control border border-accentWarning/30 bg-accentWarning/10 p-3 text-xs text-text-main flex items-start gap-2.5">
              <AppIcon name="alertTriangle" size="sm" className="text-accentWarning shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong className="font-semibold block text-accentWarning">Пароль установлен!</strong>
                Скопируйте и передайте его сотруднику по безопасному каналу (личным сообщением).
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-text-muted text-xs font-medium">Установленный пароль:</span>
              <div className="flex items-center gap-2 bg-field p-2.5 rounded-control border border-border">
                <input
                  type={showPassword ? "text" : "password"}
                  readOnly
                  value={data.temporaryPassword || ""}
                  className="w-full bg-transparent border-0 font-mono text-sm font-bold text-text-main tracking-wider focus:outline-none select-all"
                  onFocus={(e) => e.target.select()}
                />
                <IconButton
                  icon={showPassword ? "eyeOff" : "eye"}
                  label={showPassword ? "Скрыть" : "Показать"}
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowPassword((v) => !v)}
                />
                <Button
                  size="sm"
                  variant={copied ? "success" : "secondary"}
                  type="button"
                  onClick={handleCopy}
                  className="shrink-0 flex items-center gap-1.5"
                >
                  <AppIcon name={copied ? "check" : "copy"} size="xs" />
                  <span>{copied ? "Скопировано!" : "Скопировать"}</span>
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-border-soft pt-3 flex items-center justify-end">
            <Button
              variant="primary"
              type="button"
              onClick={onClose}
            >
              Готово, пароль сохранён
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogBackdrop>
    </Dialog>
  );
}

function ResetLinkDisplayDialog({ data, open, onClose, pushNotification }) {
  const [copied, setCopied] = useState(false);

  if (!data || !open) return null;

  const handleCopy = async () => {
    if (!data.url) return;
    try {
      await navigator.clipboard.writeText(data.url);
      setCopied(true);
      pushNotification?.({
        title: "Ссылка скопирована",
        message: "Отправьте её сотруднику для задания пароля",
        persist: false,
      });
      setTimeout(() => setCopied(false), 3000);
    } catch {
      pushNotification?.({
        title: "Скопируйте ссылку вручную",
        message: data.url,
        persist: false,
      });
    }
  };

  return (
    <Dialog open={open}>
      <DialogBackdrop>
        <DialogContent className="max-w-md p-5 bg-surface border-border rounded-modal shadow-modal flex flex-col gap-4">
          <DialogHeader className="border-b border-border-soft pb-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-control bg-accentInfo/15 border border-accentInfo/30 flex items-center justify-center shrink-0 text-accentInfo">
                  <AppIcon name="link" size="md" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-text-main m-0">
                    Ссылка для установки пароля
                  </DialogTitle>
                  <DialogDescription className="text-xs text-text-muted mt-0.5 m-0">
                    {data.email}
                  </DialogDescription>
                </div>
              </div>
              <IconButton
                icon="x"
                label="Закрыть"
                size="sm"
                variant="ghost"
                onClick={onClose}
              />
            </div>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <p className="m-0 text-xs text-text-muted leading-relaxed">
              {data.emailSent
                ? "Письмо успешно отправлено на почту сотрудника. При необходимости вы можете скопировать одноразовую ссылку вручную:"
                : "Почтовый сервер (SMTP) не подключён. Скопируйте одноразовую ссылку и отправьте её сотруднику в Telegram или мессенджер:"}
            </p>

            <div className="flex flex-col gap-1.5">
              <input
                readOnly
                className="w-full rounded-control border border-border bg-field p-2.5 text-xs font-mono text-text-main select-all focus:outline-none"
                value={data.url}
                onFocus={(e) => e.target.select()}
              />
            </div>
          </div>

          <DialogFooter className="border-t border-border-soft pt-3 flex items-center justify-end gap-2">
            <Button
              variant="secondary"
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5"
            >
              <AppIcon name={copied ? "check" : "copy"} size="xs" />
              <span>{copied ? "Скопировано!" : "Скопировать ссылку"}</span>
            </Button>
            <Button
              variant="primary"
              type="button"
              onClick={onClose}
            >
              Готово
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogBackdrop>
    </Dialog>
  );
}


function DisableUserDialog({
  user,
  open,
  onClose,
  onConfirm,
  submitting,
}) {
  if (!user || !open) return null;

  return (
    <Dialog open={open}>
      <DialogBackdrop>
        <DialogContent className="max-w-md p-5 bg-surface border-border rounded-modal shadow-modal flex flex-col gap-4">
          <DialogHeader className="border-b border-border-soft pb-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-control bg-accentError/15 border border-accentError/30 flex items-center justify-center shrink-0 text-accentError">
                  <AppIcon name="userX" size="md" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-text-main m-0">
                    Отключить доступ сотрудника?
                  </DialogTitle>
                  <DialogDescription className="text-xs text-text-muted mt-0.5 m-0">
                    {user.name ? `${user.name} (${user.email})` : user.email}
                  </DialogDescription>
                </div>
              </div>
              <IconButton
                icon="x"
                label="Закрыть"
                size="sm"
                variant="ghost"
                onClick={onClose}
              />
            </div>
          </DialogHeader>

          <div className="flex flex-col gap-2.5 text-xs text-text-muted leading-relaxed">
            <p className="m-0">
              Сотрудник больше не сможет войти в систему. Все текущие активные сессии и токены будут немедленно аннулированы.
            </p>
            <p className="m-0">
              Данные визитов, клиентов и история сотрудника останутся в сохранности. Вы сможете восстановить доступ в любой момент.
            </p>
          </div>

          <DialogFooter className="border-t border-border-soft pt-3 flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              type="button"
              disabled={submitting}
              onClick={onClose}
            >
              Отмена
            </Button>
            <Button
              variant="danger"
              type="button"
              loading={submitting}
              onClick={() => onConfirm(user)}
            >
              Отключить доступ
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogBackdrop>
    </Dialog>
  );
}

function UserAccessPanel({authUser, pushNotification}) {
  const [employees, setEmployees] = useState([]);
  const [permissionGroups, setPermissionGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [rows, setRows] = useState([]);
  const [smtpConfigured, setSmtpConfigured] = useState(false);

  // Responsive Breakpoint
  const {isMobile} = useBreakpoint();

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Action Menu & Drawer State
  const [openMenuUserId, setOpenMenuUserId] = useState(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [activeDrawer, setActiveDrawer] = useState(null); // { type: 'edit' | 'permissions' | 'reset-password', userId } | null
  const [disablingUser, setDisablingUser] = useState(null);
  const [tempPasswordModalData, setTempPasswordModalData] = useState(null);
  const [resetLinkModalData, setResetLinkModalData] = useState(null);

  // Submitting States
  const [submittingAction, setSubmittingAction] = useState(false);

  const activeDrawerUser = useMemo(() => {
    if (!activeDrawer?.userId) return null;
    return rows.find((u) => String(u.id) === String(activeDrawer.userId)) || null;
  }, [rows, activeDrawer]);

  const canManageAccess = hasPermission(authUser, PERMISSIONS.USERS_MANAGE);
  const isOwner = authUser?.role === "owner" || authUser?.id === "local-admin";
  const allowedRoleOptions = isOwner
    ? USER_ROLE_OPTIONS
    : USER_ROLE_OPTIONS.filter((role) => role.value !== "owner");

  const loadUsers = useCallback(async () => {
    if (!canManageAccess) {
      setRows([]);
      setLoadError("Управление доступами доступно владельцу и администратору студии.");
      return;
    }

    setLoading(true);
    setLoadError("");
    try {
      const payload = await fetchUsers();
      setRows(payload.users || []);
      setEmployees(payload.employees || []);
      setPermissionGroups(payload.permissionGroups || []);
      setSmtpConfigured(Boolean(payload.smtpConfigured));
    } catch (error) {
      const message = error?.message || "Не удалось загрузить список пользователей";
      setLoadError(message);
      pushNotification?.({
        title: "Доступы не загружены",
        message,
      });
    } finally {
      setLoading(false);
    }
  }, [canManageAccess, pushNotification]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadUsers();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadUsers]);

  const patchRow = (id, patch) => {
    setRows((current) =>
      current.map((user) => (user.id === id ? {...user, ...patch} : user)),
    );
  };

  // Add Employee Handler
  const handleCreateEmployee = async (formData) => {
    setSubmittingAction(true);
    try {
      const payload = await createUser(formData);
      setRows((current) => [...current, payload.user]);
      setIsAddModalOpen(false);

      if (payload.temporaryPassword) {
        setTempPasswordModalData({
          user: payload.user,
          temporaryPassword: payload.temporaryPassword,
        });
        pushNotification?.({
          title: "Сотрудник создан",
          message: "Скопируйте сгенерированный временный пароль",
        });
      } else if (payload.resetUrl) {
        setResetLinkModalData({
          email: payload.user.email,
          url: payload.resetUrl,
          emailSent: Boolean(payload.resetEmailSent),
          smtpConfigured: Boolean(payload.smtpConfigured),
        });
        pushNotification?.({
          title: "Сотрудник создан",
          message: payload.resetEmailSent
            ? `Письмо со ссылкой отправлено на ${payload.user.email}`
            : "Скопируйте ссылку для передачи сотруднику",
        });
      } else {
        pushNotification?.({
          title: "Сотрудник создан",
          message: `${payload.user.email} успешно добавлен в систему`,
        });
      }
    } catch (error) {
      pushNotification?.({
        title: "Ошибка создания сотрудника",
        message: error?.message || "Не удалось создать пользователя",
      });
    } finally {
      setSubmittingAction(false);
    }
  };

  // Edit User Handler
  const handleEditUser = async (user, fields) => {
    setSubmittingAction(true);
    try {
      const payload = await updateUser(user.id, {
        email: fields.email || user.email,
        employeeId: fields.employeeId,
        isActive: user.isActive,
        name: fields.name,
        role: fields.role,
      });
      patchRow(user.id, payload.user);
      setActiveDrawer(null);
      pushNotification?.({
        title: "Данные обновлены",
        message: `${payload.user.email} (${ROLE_LABELS[payload.user.role] || payload.user.role})`,
      });
    } catch (error) {
      pushNotification?.({
        title: "Ошибка обновления",
        message: error?.message || "Не удалось обновить пользователя",
      });
    } finally {
      setSubmittingAction(false);
    }
  };

  // Reset Password Handler
  const handleResetPassword = async (user, payload) => {
    setSubmittingAction(true);
    try {
      const res = await resetUserPassword(user.id, payload);
      setActiveDrawer(null);

      if (res.user) {
        patchRow(user.id, res.user);
      }

      if (res.temporaryPassword) {
        setTempPasswordModalData({
          user: res.user || user,
          temporaryPassword: res.temporaryPassword,
        });
        pushNotification?.({
          title: "Пароль обновлён",
          message: "Новый пароль успешно сохранён",
        });
      } else if (res.resetUrl) {
        setResetLinkModalData({
          email: user.email,
          url: res.resetUrl,
          emailSent: Boolean(res.resetEmailSent),
          smtpConfigured: Boolean(res.smtpConfigured),
        });
        pushNotification?.({
          title: "Ссылка создана",
          message: res.resetEmailSent
            ? `Письмо для сброса отправлено на ${user.email}`
            : "Скопируйте ссылку для сброса пароля",
        });
      } else {
        pushNotification?.({
          title: "Пароль обновлён",
          message: "Новый пароль установлен. Предыдущие сессии завершены.",
        });
      }
    } catch (error) {
      pushNotification?.({
        title: "Не удалось сбросить пароль",
        message: error?.message || "Ошибка сброса пароля",
      });
    } finally {
      setSubmittingAction(false);
    }
  };

  // Save Permissions Handler
  const handleSavePermissions = async (user, permsDraft) => {
    setSubmittingAction(true);
    try {
      const payload = await updateUser(user.id, {
        email: user.email,
        employeeId: user.employeeId ? Number(user.employeeId) : null,
        isActive: user.isActive,
        name: user.name,
        permissions: permsDraft,
        role: user.role,
      });
      patchRow(user.id, payload.user);
      setActiveDrawer(null);
      pushNotification?.({
        title: "Права доступа сохранены",
        message: `${payload.user.email} (${ROLE_LABELS[payload.user.role] || payload.user.role})`,
      });
    } catch (error) {
      pushNotification?.({
        title: "Не удалось сохранить права",
        message: error?.message || "Ошибка обновления прав доступа",
      });
    } finally {
      setSubmittingAction(false);
    }
  };

  // Toggle Status Handler
  const handleToggleStatus = (user) => {
    if (user.isActive) {
      setDisablingUser(user);
    } else {
      void handleEnableUser(user);
    }
  };

  const handleEnableUser = async (user) => {
    setSubmittingAction(true);
    try {
      const payload = await enableUser(user.id);
      patchRow(user.id, payload.user);
      pushNotification?.({
        title: "Доступ включён",
        message: payload.user.email,
      });
    } catch (error) {
      pushNotification?.({
        title: "Ошибка",
        message: error?.message || "Не удалось включить доступ",
      });
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleConfirmDisable = async (user) => {
    setSubmittingAction(true);
    try {
      const payload = await disableUser(user.id);
      patchRow(user.id, payload.user);
      setDisablingUser(null);
      pushNotification?.({
        title: "Доступ отключён",
        message: payload.user.email,
      });
    } catch (error) {
      pushNotification?.({
        title: "Ошибка",
        message: error?.message || "Нельзя отключить последнего владельца",
      });
    } finally {
      setSubmittingAction(false);
    }
  };

  // Filtered users calculation
  const filteredUsers = useMemo(() => {
    return rows.filter((u) => {
      if (statusFilter === "active" && !u.isActive) return false;
      if (statusFilter === "disabled" && u.isActive) return false;
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = (u.name || "").toLowerCase().includes(q);
        const emailMatch = (u.email || "").toLowerCase().includes(q);
        const masterMatch = (u.employeeName || "").toLowerCase().includes(q);
        if (!nameMatch && !emailMatch && !masterMatch) return false;
      }
      return true;
    });
  }, [rows, searchQuery, roleFilter, statusFilter]);

  const activeCount = rows.filter((r) => r.isActive).length;

  return (
    <Card className="crm-users-panel p-4 sm:p-5">
      {/* 1. Header */}
      <div className="crm-users-header">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-control bg-accent/15 border border-accent/30 flex items-center justify-center shrink-0 text-accent">
            <AppIcon name="shield" size="md" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="m-0 text-text-main text-[15px] font-bold">
                Управление доступом
              </h2>
              <Badge variant="neutral" size="sm">
                Активных: {activeCount} из {rows.length}
              </Badge>
            </div>
            <p className="m-0 mt-0.5 text-text-muted text-xs">
              Учётные записи, роли, пароли и детальные права доступа к CRM.
            </p>
          </div>
        </div>

        {canManageAccess && (
          <Button
            variant="primary"
            type="button"
            className="flex items-center gap-1.5"
            leftIcon={<AppIcon name="userPlus" size="sm" />}
            onClick={() => setIsAddModalOpen(true)}
          >
            + Добавить сотрудника
          </Button>
        )}
      </div>

      {!canManageAccess ? (
        <div className="rounded-control border border-border bg-field p-3.5 text-xs text-text-muted">
          Вы вошли с ролью «{ROLE_LABELS[authUser?.role] || authUser?.role}». Управление сотрудниками и ролями доступно владельцу и администратору студии.
        </div>
      ) : (
        <>
          {/* 2. Filters & Search Toolbar */}
          <div className="crm-users-toolbar">
            <div className="crm-users-search-wrap">
              <SearchControl
                placeholder="Поиск по имени или email…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClear={() => setSearchQuery("")}
              />
            </div>

            <div className="crm-users-filter-select">
              <Select
                aria-label="Фильтр по роли"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="all">Все роли</option>
                <option value="owner">Владелец</option>
                <option value="admin">Администратор</option>
                <option value="manager">Управляющий</option>
                <option value="staff">Сотрудник</option>
                <option value="readonly">Только чтение</option>
              </Select>
            </div>

            <div className="crm-users-filter-select">
              <Select
                aria-label="Фильтр по статусу"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">Все статусы</option>
                <option value="active">Активные</option>
                <option value="disabled">Отключённые</option>
              </Select>
            </div>

            <div className="crm-users-counter">
              Показано: {filteredUsers.length} из {rows.length}
            </div>
          </div>

          {/* 3. Content: Table or Cards */}
          {loading ? (
            <div className="rounded-control border border-border bg-field p-6 text-center text-xs text-text-muted flex items-center justify-center gap-2">
              <AppIcon name="loader" size="sm" className="animate-spin text-accent" />
              <span>Загрузка списка сотрудников…</span>
            </div>
          ) : loadError ? (
            <div className="rounded-control border border-accentError/40 bg-field p-4 text-xs text-accentError flex items-center justify-between gap-3">
              <span>{loadError}</span>
              <Button size="sm" type="button" variant="secondary" onClick={loadUsers}>
                Повторить
              </Button>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="rounded-control border border-border bg-field p-8 text-center text-xs text-text-muted flex flex-col items-center justify-center gap-2.5">
              <AppIcon name="users" size="lg" className="text-text-faint" />
              <strong className="text-text-main text-sm">
                {rows.length === 0 ? "Сотрудников пока нет" : "Ничего не найдено"}
              </strong>
              <p className="m-0 text-text-faint max-w-sm">
                {rows.length === 0
                  ? "Добавьте первого сотрудника, нажав на кнопку «+ Добавить сотрудника» вверху."
                  : "Попробуйте изменить параметры поиска или сбросить фильтры."}
              </p>
              {rows.length > 0 && (searchQuery || roleFilter !== "all" || statusFilter !== "all") && (
                <Button
                  size="sm"
                  variant="secondary"
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setRoleFilter("all");
                    setStatusFilter("all");
                  }}
                >
                  Сбросить фильтры
                </Button>
              )}
            </div>
          ) : isMobile ? (
            /* Mobile Cards View */
            <div className="crm-users-cards">
                  {filteredUsers.map((user) => {
                    const masterName = user.employeeName || (user.employeeId ? employees.find((e) => e.id === user.employeeId)?.name : null);
                    return (
                      <article
                        key={user.id}
                        className={clsx(
                          "crm-user-card cursor-pointer",
                          !user.isActive && "is-disabled",
                        )}
                        onClick={() => {
                          if (!isOwner && user.role === "owner") return;
                          setActiveDrawer({ type: "edit", userId: user.id });
                        }}
                      >
                        <div className="crm-user-card-header">
                          <div className="crm-user-identity">
                            <div className="crm-user-avatar">
                              {getUserInitials(user.name, user.email)}
                            </div>
                            <div className="crm-user-names">
                              <span className="crm-user-name" title={user.name || user.email}>
                                {user.name || "Без имени"}
                              </span>
                              <span className="crm-user-email" title={user.email}>
                                {user.email}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant={ROLE_BADGE_VARIANTS[user.role] || "neutral"}>
                              {ROLE_LABELS[user.role] || user.role}
                            </Badge>
                            <UserRowActionsMenu
                              user={user}
                              isOwner={isOwner}
                              authUser={authUser}
                              openMenuId={openMenuUserId}
                              setOpenMenuId={setOpenMenuUserId}
                              onEdit={(u) => setActiveDrawer({ type: "edit", userId: u.id })}
                              onOpenPermissions={(u) => setActiveDrawer({ type: "permissions", userId: u.id })}
                              onResetPassword={(u) => setActiveDrawer({ type: "reset-password", userId: u.id })}
                              onToggleStatus={(u) => handleToggleStatus(u)}
                            />
                          </div>
                        </div>

                        <div className="crm-user-card-body">
                          <div className="crm-user-card-row">
                            <span className="text-text-muted">Мастер:</span>
                            <span className="text-text-main font-medium">
                              {masterName || "—"}
                            </span>
                          </div>
                          <div className="crm-user-card-row">
                            <span className="text-text-muted">Статус:</span>
                            <Badge variant={user.isActive ? "success" : "disabled"} size="sm">
                              {user.isActive ? "Активен" : "Отключён"}
                            </Badge>
                          </div>
                          <div className="crm-user-card-row">
                            <span className="text-text-muted">Последний вход:</span>
                            <span className="text-text-faint">
                              {formatUserDate(user.lastLoginAt)}
                            </span>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                /* Desktop Table View */
                <div className="crm-users-table-wrap">
                  <div className="crm-users-table-header">
                    <div>Сотрудник</div>
                    <div>Роль</div>
                    <div>Мастер</div>
                    <div>Статус</div>
                    <div>Последний вход</div>
                    <div className="text-right"></div>
                  </div>

                  {filteredUsers.map((user) => {
                    const masterName = user.employeeName || (user.employeeId ? employees.find((e) => e.id === user.employeeId)?.name : null);
                    return (
                      <div
                        key={user.id}
                        className={clsx(
                          "crm-users-table-row cursor-pointer",
                          !user.isActive && "is-disabled",
                        )}
                        onClick={() => {
                          if (!isOwner && user.role === "owner") return;
                          setActiveDrawer({ type: "edit", userId: user.id });
                        }}
                      >
                        {/* Identity */}
                        <div className="crm-user-identity">
                          <div className="crm-user-avatar">
                            {getUserInitials(user.name, user.email)}
                          </div>
                          <div className="crm-user-names">
                            <span className="crm-user-name" title={user.name || user.email}>
                              {user.name || "Без имени"}
                            </span>
                            <span className="crm-user-email" title={user.email}>
                              {user.email}
                            </span>
                          </div>
                        </div>

                        {/* Role Badge */}
                        <div>
                          <Badge variant={ROLE_BADGE_VARIANTS[user.role] || "neutral"}>
                            {ROLE_LABELS[user.role] || user.role}
                          </Badge>
                        </div>

                        {/* Master Binding */}
                        <div className="text-xs text-text-main truncate">
                          {masterName ? (
                            <span className="inline-flex items-center gap-1.5">
                              <AppIcon name="userCheck" size="xs" className="text-text-muted" />
                              <span className="truncate">{masterName}</span>
                            </span>
                          ) : (
                            <span className="text-text-faint">—</span>
                          )}
                        </div>

                        {/* Status */}
                        <div>
                          <Badge variant={user.isActive ? "success" : "disabled"} size="sm">
                            {user.isActive ? "Активен" : "Отключён"}
                          </Badge>
                        </div>

                        {/* Last Login */}
                        <div className="text-[11.5px] text-text-muted truncate">
                          {formatUserDate(user.lastLoginAt)}
                        </div>

                        {/* Actions Menu */}
                        <div className="flex justify-end">
                          <UserRowActionsMenu
                            user={user}
                            isOwner={isOwner}
                            authUser={authUser}
                            openMenuId={openMenuUserId}
                            setOpenMenuId={setOpenMenuUserId}
                            onEdit={(u) => setActiveDrawer({ type: "edit", userId: u.id })}
                            onOpenPermissions={(u) => setActiveDrawer({ type: "permissions", userId: u.id })}
                            onResetPassword={(u) => setActiveDrawer({ type: "reset-password", userId: u.id })}
                            onToggleStatus={(u) => handleToggleStatus(u)}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

          {/* Modals & Dialogs */}
          <CreateEmployeeDialog
            key={isAddModalOpen ? "add-emp-open" : "add-emp-closed"}
            open={isAddModalOpen}
            onClose={() => setIsAddModalOpen(false)}
            allowedRoleOptions={allowedRoleOptions}
            employees={employees}
            onSubmit={handleCreateEmployee}
            submitting={submittingAction}
            pushNotification={pushNotification}
          />

          <UserAccessDrawer
            activeDrawer={activeDrawer}
            user={activeDrawerUser}
            onClose={() => setActiveDrawer(null)}
            onChangeMode={(nextMode) =>
              setActiveDrawer((prev) => (prev ? { ...prev, type: nextMode } : null))
            }
            allowedRoleOptions={allowedRoleOptions}
            employees={employees}
            permissionGroups={permissionGroups}
            smtpConfigured={smtpConfigured}
            isOwner={isOwner}
            submitting={submittingAction}
            onSaveEdit={handleEditUser}
            onSavePermissions={handleSavePermissions}
            onResetPassword={handleResetPassword}
            pushNotification={pushNotification}
          />

          <TemporaryPasswordDisplayDialog
            key={tempPasswordModalData ? `temp-${tempPasswordModalData.user?.id || "u"}` : "temp-closed"}
            data={tempPasswordModalData}
            open={Boolean(tempPasswordModalData)}
            onClose={() => setTempPasswordModalData(null)}
            pushNotification={pushNotification}
          />

          <ResetLinkDisplayDialog
            key={resetLinkModalData ? `link-${resetLinkModalData.email}` : "link-closed"}
            data={resetLinkModalData}
            open={Boolean(resetLinkModalData)}
            onClose={() => setResetLinkModalData(null)}
            pushNotification={pushNotification}
          />

          <DisableUserDialog
            user={disablingUser}
            open={Boolean(disablingUser)}
            onClose={() => setDisablingUser(null)}
            onConfirm={handleConfirmDisable}
            submitting={submittingAction}
          />
        </>
      )}

    </Card>
  );
}

function StaffAccountCard({ authUser, employees = [] }) {
  const linkedMaster = authUser?.employeeId
    ? employees.find((e) => Number(e.id) === Number(authUser.employeeId)) || null
    : null;

  const role = String(authUser?.role || "").toLowerCase();
  const roleLabel =
    role === "staff"
      ? "Мастер / Специалист"
      : role === "readonly"
        ? "Только просмотр"
        : role === "manager"
          ? "Менеджер"
          : role || "Сотрудник";

  return (
    <Card className="p-4 sm:p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 border-b border-border-soft pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-accent font-bold text-sm">
            {(authUser?.name || authUser?.email || "U").slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h2 className="m-0 text-text-main text-[15px] font-bold">
              {authUser?.name || "Личный профиль"}
            </h2>
            <p className="m-0 mt-0.5 text-text-muted text-xs">
              {authUser?.email || "Данные сессии недоступны"}
            </p>
          </div>
        </div>
        <Badge variant="info" size="sm">
          {roleLabel}
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-control border border-border-soft bg-field px-3.5 py-2.5 flex flex-col gap-0.5">
          <span className="text-text-faint text-[11px] uppercase tracking-wider font-medium">
            Email для входа
          </span>
          <strong className="text-text-main text-xs font-semibold truncate">
            {authUser?.email || "—"}
          </strong>
        </div>

        <div className="rounded-control border border-border-soft bg-field px-3.5 py-2.5 flex flex-col gap-0.5">
          <span className="text-text-faint text-[11px] uppercase tracking-wider font-medium">
            Роль в системе
          </span>
          <strong className="text-text-main text-xs font-semibold">
            {roleLabel}
          </strong>
        </div>

        <div className="rounded-control border border-border-soft bg-field px-3.5 py-2.5 flex flex-col gap-0.5">
          <span className="text-text-faint text-[11px] uppercase tracking-wider font-medium">
            Привязанный мастер в календаре
          </span>
          <strong className="text-text-main text-xs font-semibold">
            {linkedMaster
              ? `${linkedMaster.name}${linkedMaster.role ? ` · ${linkedMaster.role}` : ""}`
              : authUser?.employeeId
                ? `ID #${authUser.employeeId}`
                : "Не привязан"}
          </strong>
        </div>
      </div>
    </Card>
  );
}

function StaffPasswordCard({ pushNotification }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Заполните все поля пароля");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Новый пароль и подтверждение не совпадают");
      return;
    }

    const strength = validatePasswordStrength(newPassword);
    if (!strength.isValid) {
      setError(strength.failures?.[0] || strength.errors?.[0] || "Пароль недостаточно надёжен");
      return;
    }

    setLoading(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess(true);
      pushNotification?.({
        title: "Пароль обновлён",
        message: "Ваш новый пароль успешно сохранён.",
      });
    } catch (err) {
      setError(err?.message || "Не удалось изменить пароль");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-4 sm:p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2.5 border-b border-border-soft pb-3">
        <AppIcon name="lock" size="md" className="text-accent" />
        <div>
          <h2 className="m-0 text-text-main text-[15px] font-bold">Смена пароля</h2>
          <p className="m-0 mt-0.5 text-text-muted text-xs">
            Используйте сложный пароль не менее 10 символов (буквы, цифры и спецсимвол).
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 max-w-md">
        <label className="flex flex-col gap-1.5 text-text-muted text-xs font-medium">
          <span>Текущий пароль</span>
          <Input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Введите текущий пароль"
            disabled={loading}
          />
        </label>

        <label className="flex flex-col gap-1.5 text-text-muted text-xs font-medium">
          <span>Новый пароль</span>
          <Input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Минимум 10 символов"
            disabled={loading}
          />
        </label>

        <label className="flex flex-col gap-1.5 text-text-muted text-xs font-medium">
          <span>Подтвердите новый пароль</span>
          <Input
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Повторите новый пароль"
            disabled={loading}
          />
        </label>

        {error ? (
          <div className="text-xs font-medium text-accentError bg-accentError/10 border border-accentError/20 rounded-control px-3 py-2">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="text-xs font-medium text-accentSuccess bg-accentSuccess/10 border border-accentSuccess/20 rounded-control px-3 py-2">
            Пароль успешно изменён!
          </div>
        ) : null}

        <div className="pt-1">
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={loading}
          >
            <AppIcon name="save" size="sm" />
            {loading ? "Сохранение..." : "Обновить пароль"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function StaffDisplayCard({ settings, onSubmit, onReset }) {
  const selectedColorTheme = resolveColorTheme(settings);
  const formRef = useRef(null);

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="flex flex-col gap-4"
    >
      <Card className="p-4 sm:p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2.5 border-b border-border-soft pb-3">
          <AppIcon name="sliders" size="md" className="text-accent" />
          <div>
            <h2 className="m-0 text-text-main text-[15px] font-bold">Оформление интерфейса</h2>
            <p className="m-0 mt-0.5 text-text-muted text-xs">
              Цветовая схема и плотность интерфейса на вашем устройстве.
            </p>
          </div>
        </div>

        <fieldset className="flex flex-col gap-1.5 text-text-muted text-xs font-medium border-0 p-0 m-0">
          <legend className="mb-1 text-text-muted text-xs font-medium">Тема оформления</legend>
          <div className="color-theme-picker">
            {COLOR_THEME_OPTIONS.map((themeOption) => (
              <label
                className="color-theme-option"
                key={themeOption.id}
                title={themeOption.description}
              >
                <input
                  defaultChecked={selectedColorTheme.id === themeOption.id}
                  name="colorTheme"
                  onChange={() => applyColorTheme({colorTheme: themeOption.id})}
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
        </fieldset>

        <div className="rounded-control border border-border-soft bg-field px-3.5 py-2.5 flex items-center justify-between gap-3">
          <SettingsToggle defaultChecked={settings.compactMode ?? true} name="compactMode">
            <span className="labeled-hint-row labeled-hint-row-nowrap">
              Компактный режим таблиц и карточек
              <HintIcon>Уменьшает отступы, чтобы на экране помещалось больше записей</HintIcon>
            </span>
          </SettingsToggle>
        </div>

        <div className="flex items-center justify-between gap-2.5 pt-2 border-t border-border-soft mt-2">
          <Button
            variant="secondary"
            size="sm"
            type="button"
            onClick={() => {
              onReset?.();
              formRef.current?.reset();
            }}
          >
            <AppIcon name="rotateCcw" size="sm" />
            Сбросить вид
          </Button>
          <Button
            variant="primary"
            size="sm"
            type="submit"
            className="font-bold"
          >
            <AppIcon name="save" size="sm" />
            Сохранить оформление
          </Button>
        </div>
      </Card>
    </form>
  );
}

function SettingsPage({
  authUser = null,
  employees = [],
  initialTab = "interface",
  pageTitle = "Настройки",
  pageDescription = "Управление студией, доступами, уведомлениями и интеграциями",
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

  const userRole = String(authUser?.role || "").toLowerCase();
  const isOwner = userRole === "owner" || authUser?.id === "local-admin";
  const canManageUsers = hasPermission(authUser, PERMISSIONS.USERS_MANAGE);
  const isSalonAdmin = isOwner || userRole === "admin" || canManageUsers;

  const staffTabs = [
    {id: "account", label: "Профиль", mobileLabel: "Профиль", icon: "user"},
    {id: "display", label: "Оформление", mobileLabel: "Тема", icon: "sliders"},
    {id: "notifications", label: "Push-уведомления", mobileLabel: "Push", icon: "bell"},
  ];

  const adminTabs = [
    {id: "interface", label: "Интерфейс", mobileLabel: "UI", icon: "sliders"},
    {id: "access", label: "Доступы", mobileLabel: "Доступ", icon: "shield"},
    {id: "notifications", label: "Уведомления", mobileLabel: "Уведом.", icon: "bell"},
    {id: "calendar", label: "Календарь", mobileLabel: "Календ.", icon: "calendar"},
    {id: "integrations", label: "Интеграции", mobileLabel: "Интегр.", icon: "link"},
    {id: "data", label: "Данные", mobileLabel: "Данные", icon: "database"},
  ];

  const settingsTabs = !isSalonAdmin ? staffTabs : adminTabs;
  const defaultTab = !isSalonAdmin ? "account" : (initialTab || "interface");
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [integrationDiagnosticsRunning, setIntegrationDiagnosticsRunning] = useState(false);

  const resetSettings = () => {
    const didReset = onReset?.();
    if (didReset !== false) {
      formRef.current?.reset();
    }
  };

  const formatCloudSyncTime = (value) => {
    if (!value) {
      return "синхронизируется автоматически";
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? "синхронизируется автоматически"
      : date.toLocaleString("ru-RU", {
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
  };

  const cloudStatusMessage = !cloudEnabled
    ? "Все изменения сохраняются напрямую в базу PostgreSQL на сервере Hetzner."
    : cloudLoadError
      ? cloudLoadError
      : cloudConflict
        ? "На сервере более свежая версия. Выберите, какую версию оставить."
        : !cloudHydrated
          ? "Загрузка состояния с сервера..."
          : lastCloudSyncError
            ? lastCloudSyncError
            : "Изменения автоматически синхронизируются с сервером.";

  const cloudKpiLabel =
    !cloudEnabled
      ? "Hetzner"
      : cloudConflict || cloudLoadError || lastCloudSyncError
        ? "!"
        : cloudHydrated
          ? "OK"
          : "...";

  const smsServerConfigured = Boolean(
    smsReminders?.status?.configured ||
      reviewRequests?.status?.configured ||
      inactiveFollowUp?.status?.configured,
  );
  const telegramTokenConfigured = Boolean(telegramDigest?.status?.telegramTokenConfigured);
  const telegramChatIdConfigured = Boolean(
    String(settings.telegramChatId ?? "").trim() ||
      telegramDigest?.status?.telegramChatIdConfigured,
  );
  const telegramServerReady = telegramTokenConfigured && telegramChatIdConfigured;

  const getSmsScenarioBadge = (scenarioEnabled) => {
    if (!smsServerConfigured) {
      return {label: "Недоступен без подключения SMS", tone: "warning"};
    }
    if (settings.smsEnabled && scenarioEnabled) {
      return {label: "Активен", tone: "success"};
    }
    return {label: "Выключен", tone: "neutral"};
  };

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
            disabled:
              settings.smsEnabled !== true ||
              !settings.inactiveFollowUpEnabled ||
              inactiveFollowUp?.status?.loading,
            label: "Обновить",
            onClick: () => inactiveFollowUp?.refreshStatus?.(),
          },
          {
            disabled:
              settings.smsEnabled !== true ||
              !settings.inactiveFollowUpEnabled,
            label: "Предпросмотр",
            onClick: () =>
              runIntegrationPreview("Follow-up", inactiveFollowUp?.runPreview),
          },
          {
            disabled:
              settings.smsEnabled !== true ||
              !settings.inactiveFollowUpEnabled ||
              inactiveFollowUp?.status?.loading ||
              !inactiveFollowUp?.status?.configured,
            label: "Отправить",
            onClick: () => inactiveFollowUp?.runProcess?.(),
            primary: true,
          },
        ],
        "review-requests": [
          {
            disabled:
              settings.smsEnabled !== true ||
              !settings.reviewRequestsEnabled ||
              reviewRequests?.status?.loading,
            label: "Обновить",
            onClick: () => reviewRequests?.refreshStatus?.(),
          },
          {
            disabled:
              settings.smsEnabled !== true ||
              !settings.reviewRequestsEnabled,
            label: "Предпросмотр",
            onClick: () =>
              runIntegrationPreview("Запросы отзывов", reviewRequests?.runPreview),
          },
          {
            disabled:
              settings.smsEnabled !== true ||
              !settings.reviewRequestsEnabled ||
              reviewRequests?.status?.loading ||
              !reviewRequests?.status?.configured,
            label: "Отправить",
            onClick: () => reviewRequests?.runProcess?.(),
            primary: true,
          },
        ],
        "sms-reminders": [
          {
            disabled:
              settings.smsEnabled !== true ||
              !settings.smsRemindersEnabled ||
              smsReminders?.status?.loading,
            label: "Обновить",
            onClick: () => smsReminders?.refreshStatus?.(),
          },
          {
            disabled:
              settings.smsEnabled !== true ||
              !settings.smsRemindersEnabled,
            label: "Предпросмотр",
            onClick: () => runIntegrationPreview("SMS-напоминания", smsReminders?.runPreview),
          },
          {
            disabled:
              settings.smsEnabled !== true ||
              !settings.smsRemindersEnabled ||
              smsReminders?.status?.loading ||
              !smsReminders?.status?.configured,
            label: "Отправить",
            onClick: () => smsReminders?.runProcess?.(),
            primary: true,
          },
        ],
        "telegram-digest": [
          {
            disabled:
              settings.telegramEnabled !== true ||
              !settings.telegramDigestEnabled ||
              telegramDigest?.status?.loading,
            label: "Обновить",
            onClick: () => telegramDigest?.refreshStatus?.(),
          },
          {
            disabled:
              settings.telegramEnabled !== true ||
              !settings.telegramDigestEnabled,
            label: "Предпросмотр",
            onClick: () =>
              runIntegrationPreview("Telegram-дайджест", telegramDigest?.runPreview),
          },
          {
            disabled:
              settings.telegramEnabled !== true ||
              !settings.telegramDigestEnabled ||
              telegramDigest?.status?.loading ||
              !telegramDigest?.status?.configured,
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
      settings.inactiveFollowUpEnabled,
      settings.reviewRequestsEnabled,
      settings.smsEnabled,
      settings.smsRemindersEnabled,
      settings.telegramEnabled,
      settings.telegramDigestEnabled,
      smsReminders,
      telegramDigest,
    ],
  );

  const settingsTabsRow = (
    <Tabs className="club-tabs settings-tabs-row mb-3">
      {settingsTabs.map((tab) => (
        <TabButton
          active={activeTab === tab.id}
          key={tab.id}
          type="button"
          onClick={() => setActiveTab(tab.id)}
        >
          {isMobile ? tab.mobileLabel : tab.label}
        </TabButton>
      ))}
    </Tabs>
  );

  const settingsMobileSummary = (
    <div className="settings-mobile-summary">
      <article>
        <span>Колокол</span>
        <strong>{settings.notificationsEnabled ?? true ? "Вкл" : "Выкл"}</strong>
      </article>
      <article>
        <span>SMS</span>
        <strong>{smsServerConfigured && settings.smsEnabled ? "Вкл" : "Выкл"}</strong>
      </article>
      <article>
        <span>Telegram</span>
        <strong>{telegramServerReady && settings.telegramEnabled ? "Вкл" : "Выкл"}</strong>
      </article>
      <article>
        <span>Сервер</span>
        <strong>{cloudKpiLabel}</strong>
      </article>
      <article>
        <span>Компакт</span>
        <strong>{settings.compactMode ?? true ? "Вкл" : "Выкл"}</strong>
      </article>
    </div>
  );

  const saveBar =
    activeTab === "access" ? null : (
      <div className="settings-save-bar flex-shrink-0 flex items-center justify-between gap-3 pt-3 pb-1.5 border-t border-border-soft bg-background mt-auto">
        <span className="text-xs text-text-faint hidden sm:inline">
          Нажмите «Сохранить настройки», чтобы применить изменения
        </span>
        <div className="flex items-center gap-2.5 ml-auto">
          <Button
            variant="secondary"
            size="sm"
            type="button"
            onClick={resetSettings}
            className="flex items-center gap-1.5 cursor-pointer"
          >
            <AppIcon name="rotateCcw" size="sm" />
            {isMobile ? "Сбросить" : "Сбросить вид"}
          </Button>
          <Button
            variant="primary"
            size="sm"
            type="submit"
            className="flex items-center gap-1.5 font-bold cursor-pointer"
          >
            <AppIcon name="save" size="sm" />
            Сохранить настройки
          </Button>
        </div>
      </div>
    );

  const reminderScenarioBadge = getSmsScenarioBadge(settings.smsRemindersEnabled);
  const reviewScenarioBadge = getSmsScenarioBadge(settings.reviewRequestsEnabled);
  if (!isSalonAdmin) {
    const effectiveStaffTab = ["account", "display", "notifications"].includes(activeTab)
      ? activeTab
      : "account";

    const linkedMaster = authUser?.employeeId
      ? employees.find((e) => Number(e.id) === Number(authUser.employeeId)) || null
      : null;

    const roleLabel =
      userRole === "staff"
        ? "Мастер / Специалист"
        : userRole === "readonly"
          ? "Только просмотр"
          : userRole === "manager"
            ? "Менеджер"
            : userRole || "Сотрудник";

    const staffMobileSummary = (
      <div className="settings-mobile-summary">
        <article>
          <span>Роль</span>
          <strong>{roleLabel}</strong>
        </article>
        <article>
          <span>Мастер</span>
          <strong>{linkedMaster?.name || "—"}</strong>
        </article>
        <article>
          <span>Тема</span>
          <strong>{selectedColorTheme.label}</strong>
        </article>
        <article>
          <span>Компакт</span>
          <strong>{settings.compactMode ?? true ? "Вкл" : "Выкл"}</strong>
        </article>
      </div>
    );

    const staffTabsRow = (
      <Tabs className="club-tabs settings-tabs-row mb-3">
        {staffTabs.map((tab) => (
          <TabButton
            active={effectiveStaffTab === tab.id}
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
          >
            {isMobile ? tab.mobileLabel : tab.label}
          </TabButton>
        ))}
      </Tabs>
    );

    return (
      <section
        className={clsx(
          "settings-page flex flex-col flex-1 h-full min-h-0 overflow-visible",
          isMobile && "settings-page-mobile nuar-settings",
        )}
      >
        <PageHeader
          className="settings-page-header"
          collapsedMeta={
            staffTabs.find((tab) => tab.id === effectiveStaffTab)?.label ?? "Профиль"
          }
          collapsible={isMobile}
          description="Личные настройки профиля, оформления и Push-уведомлений"
          title="Личный профиль"
        />

        {isMobile ? (
          <>
            {staffMobileSummary}
            {staffTabsRow}
          </>
        ) : (
          staffTabsRow
        )}

        <div className="settings-scroll flex-1 overflow-y-auto pr-1 pb-3 flex flex-col gap-4">
          {effectiveStaffTab === "account" && (
            <div className="flex flex-col gap-4">
              <StaffAccountCard authUser={authUser} employees={employees} />
              <StaffPasswordCard pushNotification={pushNotification} />
            </div>
          )}

          {effectiveStaffTab === "display" && (
            <StaffDisplayCard
              isMobile={isMobile}
              onReset={resetSettings}
              onSubmit={onSubmit}
              settings={settings}
            />
          )}

          {effectiveStaffTab === "notifications" && (
            <PushNotificationsPanel pushNotification={pushNotification} />
          )}
        </div>
      </section>
    );
  }

  const followUpScenarioBadge = getSmsScenarioBadge(settings.inactiveFollowUpEnabled);

  return (
    <section
      className={clsx(
        "settings-page flex flex-col flex-1 h-full min-h-0 overflow-visible",
        isMobile && "settings-page-mobile nuar-settings",
      )}
    >
      <PageHeader
        className="settings-page-header"
        collapsedMeta={
          settingsTabs.find((tab) => tab.id === activeTab)?.label ?? "Интерфейс"
        }
        collapsible={isMobile}
        description={pageDescription}
        title={pageTitle}
      />
      {isMobile ? (
        <>
          {settingsMobileSummary}
          {settingsTabsRow}
        </>
      ) : (
        settingsTabsRow
      )}

      <form
        className="settings-form-shell flex-1 min-h-0 flex flex-col overflow-hidden"
        key={`${settings.colorTheme}-${settings.compactMode}-${settings.smsEnabled}-${settings.telegramEnabled}-${settings.gmailBooksySyncEnabled}`}
        ref={formRef}
        onSubmit={onSubmit}
      >
        <div className="settings-scroll flex-1 overflow-y-auto pr-1 pb-3 flex flex-col gap-4">
          {/* ВКЛАДКА 1: ИНТЕРФЕЙС */}
          <Card
            className={clsx(
              "p-4 sm:p-5 flex flex-col gap-4",
              activeTab === "interface" ? "flex" : "hidden",
            )}
          >
            <div className="flex items-center justify-between gap-3 border-b border-border-soft pb-3">
              <div className="flex items-center gap-2.5">
                <AppIcon name="sliders" size="md" className="text-accent" />
                <div>
                  <h2 className="m-0 text-text-main text-[15px] font-bold">Профиль студии и интерфейс</h2>
                  <p className="m-0 mt-0.5 text-text-muted text-xs">
                    Название, адрес для шаблонов сообщений, цветовая схема и плотность интерфейса.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="flex flex-col gap-1 text-text-muted text-xs font-medium">
                Название студии
                <Input
                  name="studioName"
                  defaultValue={settings.studioName}
                  placeholder="NUAR"
                />
              </label>
              <label className="flex flex-col gap-1 text-text-muted text-xs font-medium">
                Адрес студии (для шаблонов)
                <Input
                  name="studioAddress"
                  defaultValue={settings.studioAddress ?? "Warszawa, ul. Złota 44"}
                  placeholder="Warszawa, ul. Złota 44"
                />
              </label>
              <label className="flex flex-col gap-1 text-text-muted text-xs font-medium">
                Имя владельца
                <Input
                  name="ownerName"
                  defaultValue={settings.ownerName}
                  placeholder="Влад"
                />
              </label>
            </div>

            <fieldset className="flex flex-col gap-1.5 text-text-muted text-xs font-medium border-0 p-0 m-0">
              <legend className="mb-1 text-text-muted text-xs font-medium">Тема оформления</legend>
              <div className="color-theme-picker">
                {COLOR_THEME_OPTIONS.map((themeOption) => (
                  <label
                    className="color-theme-option"
                    key={themeOption.id}
                    title={themeOption.description}
                  >
                    <input
                      defaultChecked={selectedColorTheme.id === themeOption.id}
                      name="colorTheme"
                      onChange={() => applyColorTheme({colorTheme: themeOption.id})}
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
            </fieldset>

            <div className="rounded-control border border-border-soft bg-field px-3.5 py-2.5 flex items-center justify-between gap-3">
              <SettingsToggle defaultChecked={settings.compactMode ?? true} name="compactMode">
                <span className="labeled-hint-row labeled-hint-row-nowrap">
                  Компактный режим таблиц и карточек
                  <HintIcon>Уменьшает вертикальные отступы, чтобы помещалось больше записей на одном экране</HintIcon>
                </span>
              </SettingsToggle>
            </div>
          </Card>

          {/* ВКЛАДКА 2: ДОСТУПЫ */}
          <div
            className={clsx(
              "flex flex-col gap-4",
              activeTab === "access" ? "flex" : "hidden",
            )}
          >
            <UserAccessPanel authUser={authUser} pushNotification={pushNotification} />
          </div>

          {/* ВКЛАДКА 3: УВЕДОМЛЕНИЯ (Блоки А, Б, В) */}
          <div
            className={clsx(
              "flex flex-col gap-4",
              activeTab === "notifications" ? "flex" : "hidden",
            )}
          >
            {/* БЛОК А — Уведомления внутри CRM */}
            <Card className="p-4 sm:p-5 flex flex-col gap-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-soft pb-3">
                <div className="flex items-center gap-2.5">
                  <AppIcon name="bell" size="md" className="text-accent" />
                  <div>
                    <h2 className="m-0 text-text-main text-[15px] font-bold">
                      Уведомления внутри CRM
                    </h2>
                    <p className="m-0 mt-0.5 text-text-muted text-xs">
                      События, которые отображаются в колокольчике верхней панели и всплывающих подсказках.
                    </p>
                  </div>
                </div>
                <StatusBadge tone={settings.notificationsEnabled ?? true ? "success" : "neutral"}>
                  {settings.notificationsEnabled ?? true ? "Колокольчик включён" : "Выключен"}
                </StatusBadge>
              </div>

              <SettingsMobileSection isMobile={isMobile} title="События в колокольчике">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 rounded-control border border-border-soft bg-field p-3">
                  <SettingsToggle defaultChecked={settings.notificationsEnabled ?? true} name="notificationsEnabled">
                    <span className="labeled-hint-row labeled-hint-row-nowrap">
                      Центр уведомлений
                      <HintIcon>Показывать рабочие напоминания в верхней панели</HintIcon>
                    </span>
                  </SettingsToggle>
                  <SettingsToggle defaultChecked={settings.todayVisitAlertsEnabled ?? true} name="todayVisitAlertsEnabled">
                    <span className="labeled-hint-row labeled-hint-row-nowrap">
                      Сегодняшние визиты
                    </span>
                  </SettingsToggle>
                  <SettingsToggle defaultChecked={settings.smartVisitPopupsEnabled ?? true} name="smartVisitPopupsEnabled">
                    <span className="labeled-hint-row labeled-hint-row-nowrap">
                      Всплывающие карточки визита
                    </span>
                  </SettingsToggle>
                  <SettingsToggle defaultChecked={settings.packageBalanceAlertsEnabled ?? true} name="packageBalanceAlertsEnabled">
                    <span className="labeled-hint-row labeled-hint-row-nowrap">
                      Заканчивающиеся пакеты
                    </span>
                  </SettingsToggle>
                  <SettingsToggle defaultChecked={settings.certificateAlertsEnabled ?? true} name="certificateAlertsEnabled">
                    <span className="labeled-hint-row labeled-hint-row-nowrap">
                      Истекающие сертификаты
                    </span>
                  </SettingsToggle>
                  <SettingsToggle defaultChecked={settings.birthdayAlertsEnabled ?? true} name="birthdayAlertsEnabled">
                    <span className="labeled-hint-row labeled-hint-row-nowrap">
                      Дни рождения клиентов
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
                  <SettingsToggle defaultChecked={settings.waitlistEnabled ?? true} name="waitlistEnabled">
                    <span className="labeled-hint-row labeled-hint-row-nowrap">
                      Лист ожидания на отмены
                    </span>
                  </SettingsToggle>
                  <SettingsToggle defaultChecked={settings.forecastAlertsEnabled ?? true} name="forecastAlertsEnabled">
                    <span className="labeled-hint-row labeled-hint-row-nowrap">
                      Прогноз дохода на сегодня/завтра
                    </span>
                  </SettingsToggle>
                  <SettingsToggle defaultChecked={settings.alertAggregationEnabled ?? true} name="alertAggregationEnabled">
                    <span className="labeled-hint-row labeled-hint-row-nowrap">
                      Группировать однотипные
                    </span>
                  </SettingsToggle>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <label className="flex flex-col gap-1 text-text-muted text-xs font-medium">
                    Режим визитов дня
                    <Select
                      name="todayVisitAlertMode"
                      defaultValue={
                        settings.todayVisitAlertMode === "upcoming"
                          ? "upcoming"
                          : "remaining"
                      }
                    >
                      <option value="remaining">Ближайшие по горизонту</option>
                      <option value="upcoming">Только ближайшие</option>
                    </Select>
                  </label>
                  <label className="flex flex-col gap-1 text-text-muted text-xs font-medium">
                    Горизонт визитов
                    <Select
                      name="upcomingVisitMinutes"
                      defaultValue={settings.upcomingVisitMinutes ?? 180}
                    >
                      <option value="60">1 час</option>
                      <option value="120">2 часа</option>
                      <option value="180">3 часа</option>
                      <option value="360">6 часов</option>
                      <option value="720">12 часов</option>
                    </Select>
                  </label>
                  <label className="flex flex-col gap-1 text-text-muted text-xs font-medium">
                    Карточка до визита
                    <Select
                      name="smartVisitPopupMinutes"
                      defaultValue={settings.smartVisitPopupMinutes ?? 15}
                    >
                      <option value="5">За 5 минут</option>
                      <option value="10">За 10 минут</option>
                      <option value="15">За 15 минут</option>
                      <option value="30">За 30 минут</option>
                      <option value="60">За 1 час</option>
                    </Select>
                  </label>
                  <label className="flex flex-col gap-1 text-text-muted text-xs font-medium">
                    День рождения заранее, дн.
                    <Input
                      min="1"
                      name="birthdayReminderDays"
                      type="number"
                      defaultValue={settings.birthdayReminderDays ?? 7}
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <label className="flex flex-col gap-1 text-text-muted text-xs font-medium">
                    Сертификат истекает за, дн.
                    <Input
                      min="1"
                      name="certificateExpiryReminderDays"
                      type="number"
                      defaultValue={settings.certificateExpiryReminderDays ?? 30}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-text-muted text-xs font-medium">
                    Низкий остаток сертиф., %
                    <Input
                      max="100"
                      min="1"
                      name="certificateLowBalancePercent"
                      type="number"
                      defaultValue={settings.certificateLowBalancePercent ?? 20}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-text-muted text-xs font-medium">
                    Порог отсутствия клиента, дн.
                    <Input
                      min="1"
                      name="inactiveClientDays"
                      type="number"
                      defaultValue={settings.inactiveClientDays ?? 14}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-text-muted text-xs font-medium">
                    Лимит клиентов в списке
                    <Input
                      min="3"
                      name="inactiveClientAlertLimit"
                      type="number"
                      defaultValue={settings.inactiveClientAlertLimit ?? 5}
                    />
                  </label>
                </div>

                <div className="rounded-control border border-border-soft bg-field p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <SettingsToggle defaultChecked={settings.quietHoursEnabled ?? true} name="quietHoursEnabled">
                    <span className="labeled-hint-row labeled-hint-row-nowrap">
                      Тихие часы (ночью только срочные уведомления)
                    </span>
                  </SettingsToggle>
                  <div className="flex items-center gap-2.5">
                    <label className="flex items-center gap-1.5 text-text-muted text-xs font-medium">
                      С
                      <Input
                        name="quietHoursStart"
                        type="time"
                        step="3600"
                        defaultValue={settings.quietHoursStart ?? "22:00"}
                        className="w-[110px]"
                      />
                    </label>
                    <label className="flex items-center gap-1.5 text-text-muted text-xs font-medium">
                      До
                      <Input
                        name="quietHoursEnd"
                        type="time"
                        step="3600"
                        defaultValue={settings.quietHoursEnd ?? "08:00"}
                        className="w-[110px]"
                      />
                    </label>
                  </div>
                </div>
              </SettingsMobileSection>
            </Card>

            {/* БЛОК Б — Push-уведомления браузера */}
            <Card className="p-4 sm:p-5 flex flex-col gap-3">
              <PushNotificationsPanel pushNotification={pushNotification} />
            </Card>

            {/* БЛОК В — Автоматические сообщения клиентам */}
            <Card className="p-4 sm:p-5 flex flex-col gap-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-soft pb-3">
                <div className="flex items-center gap-2.5">
                  <AppIcon name="message" size="md" className="text-accent" />
                  <div>
                    <h2 className="m-0 text-text-main text-[15px] font-bold">
                      Автоматические сообщения клиентам
                    </h2>
                    <p className="m-0 mt-0.5 text-text-muted text-xs">
                      Сценарии автоматической отправки SMS по расписанию визитов.
                    </p>
                  </div>
                </div>
                {!smsServerConfigured ? (
                  <Button
                    size="sm"
                    type="button"
                    variant="secondary"
                    onClick={() => setActiveTab("integrations")}
                  >
                    Статус SMS в «Интеграциях»
                  </Button>
                ) : null}
              </div>

              {/* Сохраняем служебные интервалы фоновой очереди, не перегружая экран */}
              <input
                type="hidden"
                name="smsAutoProcessEnabled"
                value={settings.smsAutoProcessEnabled ?? true ? "on" : ""}
              />
              <input
                type="hidden"
                name="smsAutoProcessMinutes"
                value={settings.smsAutoProcessMinutes ?? 10}
              />
              <input
                type="hidden"
                name="reviewRequestAutoProcessEnabled"
                value={settings.reviewRequestAutoProcessEnabled ?? true ? "on" : ""}
              />
              <input
                type="hidden"
                name="reviewRequestAutoProcessMinutes"
                value={settings.reviewRequestAutoProcessMinutes ?? 15}
              />
              <input
                type="hidden"
                name="inactiveFollowUpAutoProcessEnabled"
                value={settings.inactiveFollowUpAutoProcessEnabled ?? true ? "on" : ""}
              />
              <input
                type="hidden"
                name="inactiveFollowUpAutoProcessMinutes"
                value={settings.inactiveFollowUpAutoProcessMinutes ?? 60}
              />

              <div className="flex flex-col gap-2.5">
                {/* Сценарий 1: Напоминание о визите */}
                <article className="rounded-control border border-border-soft bg-field p-3 flex flex-col gap-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <SettingsToggle defaultChecked={settings.smsRemindersEnabled ?? false} name="smsRemindersEnabled">
                      <span className="font-semibold text-text-main text-[13px]">
                        Напоминание о предстоящем визите
                      </span>
                    </SettingsToggle>
                    <StatusBadge tone={reminderScenarioBadge.tone}>
                      {reminderScenarioBadge.label}
                    </StatusBadge>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 pl-6">
                    <SettingsToggle defaultChecked={settings.smsReminder24hEnabled ?? true} name="smsReminder24hEnabled">
                      <span>За 24 часа до записи</span>
                    </SettingsToggle>
                    <SettingsToggle defaultChecked={settings.smsReminder2hEnabled ?? true} name="smsReminder2hEnabled">
                      <span>За 2 часа до записи</span>
                    </SettingsToggle>
                  </div>
                </article>

                {/* Сценарий 2: Запрос отзыва после визита */}
                <article className="rounded-control border border-border-soft bg-field p-3 flex flex-col gap-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <SettingsToggle defaultChecked={settings.reviewRequestsEnabled ?? false} name="reviewRequestsEnabled">
                      <span className="font-semibold text-text-main text-[13px]">
                        Запрос отзыва после завершённого визита
                      </span>
                    </SettingsToggle>
                    <StatusBadge tone={reviewScenarioBadge.tone}>
                      {reviewScenarioBadge.label}
                    </StatusBadge>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pl-6">
                    <label className="flex flex-col gap-1 text-text-muted text-xs font-medium">
                      Через сколько часов
                      <Input
                        min="1"
                        name="reviewRequestDelayHours"
                        type="number"
                        defaultValue={settings.reviewRequestDelayHours ?? 2}
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-text-muted text-xs font-medium">
                      Ссылка Google Maps
                      <Input
                        name="reviewGoogleUrl"
                        defaultValue={settings.reviewGoogleUrl ?? ""}
                        placeholder="https://g.page/nuar/review"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-text-muted text-xs font-medium">
                      Ссылка Booksy
                      <Input
                        name="reviewBooksyUrl"
                        defaultValue={settings.reviewBooksyUrl ?? ""}
                        placeholder="https://booksy.com/..."
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-text-muted text-xs font-medium">
                      Основная ссылка в SMS
                      <Input
                        name="reviewPrimaryUrl"
                        defaultValue={settings.reviewPrimaryUrl ?? ""}
                        placeholder="По умолчанию Google"
                      />
                    </label>
                  </div>
                </article>

                {/* Сценарий 3: Возврат неактивных клиентов */}
                <article className="rounded-control border border-border-soft bg-field p-3 flex flex-col gap-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <SettingsToggle defaultChecked={settings.inactiveFollowUpEnabled ?? false} name="inactiveFollowUpEnabled">
                      <span className="font-semibold text-text-main text-[13px]">
                        Возврат неактивных клиентов (Follow-up)
                      </span>
                    </SettingsToggle>
                    <StatusBadge tone={followUpScenarioBadge.tone}>
                      {followUpScenarioBadge.label}
                    </StatusBadge>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 pl-6">
                    <SettingsToggle defaultChecked={settings.inactiveFollowUp14Enabled ?? true} name="inactiveFollowUp14Enabled">
                      <span>Через 14 дней без визита</span>
                    </SettingsToggle>
                    <SettingsToggle defaultChecked={settings.inactiveFollowUp30Enabled ?? true} name="inactiveFollowUp30Enabled">
                      <span>Через 30 дней</span>
                    </SettingsToggle>
                    <SettingsToggle defaultChecked={settings.inactiveFollowUp60Enabled ?? true} name="inactiveFollowUp60Enabled">
                      <span>Через 60 дней</span>
                    </SettingsToggle>
                  </div>
                </article>
              </div>
            </Card>
          </div>

          {/* ВКЛАДКА 4: КАЛЕНДАРЬ */}
          <Card
            className={clsx(
              "p-4 sm:p-5 flex flex-col gap-4",
              activeTab === "calendar" ? "flex" : "hidden",
            )}
          >
            <div className="flex items-center gap-2.5 border-b border-border-soft pb-3">
              <AppIcon name="calendarClock" size="md" className="text-accent" />
              <div>
                <h2 className="m-0 text-text-main text-[15px] font-bold">Календарь и сетка расписания</h2>
                <p className="m-0 mt-0.5 text-text-muted text-xs">
                  Рабочие часы салона, шаг временной сетки и элементы на графике.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="flex flex-col gap-1 text-text-muted text-xs font-medium">
                Начало рабочего дня
                <Input
                  name="workdayStart"
                  type="time"
                  step="3600"
                  defaultValue={settings.workdayStart ?? "08:00"}
                />
              </label>
              <label className="flex flex-col gap-1 text-text-muted text-xs font-medium">
                Конец рабочего дня
                <Input
                  name="workdayEnd"
                  type="time"
                  step="3600"
                  defaultValue={settings.workdayEnd ?? "22:00"}
                />
              </label>
              <label className="flex flex-col gap-1 text-text-muted text-xs font-medium">
                Шаг временной сетки
                <Select
                  name="calendarSlotMinutes"
                  defaultValue={settings.calendarSlotMinutes ?? 15}
                >
                  <option value="15">15 минут</option>
                  <option value="30">30 минут</option>
                  <option value="60">60 минут</option>
                </Select>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 rounded-control border border-border-soft bg-field p-3">
              <SettingsToggle defaultChecked={settings.calendarRemindersVisible ?? true} name="calendarRemindersVisible">
                <span>Панель визитов дня над графиком</span>
              </SettingsToggle>
              <SettingsToggle defaultChecked={settings.calendarShowTasks ?? true} name="calendarShowTasks">
                <span>Показывать задачи в сетке календаря</span>
              </SettingsToggle>
              <SettingsToggle defaultChecked={settings.calendarNowLineVisible ?? true} name="calendarNowLineVisible">
                <span>Линия текущего времени</span>
              </SettingsToggle>
              <SettingsToggle defaultChecked={settings.calendarConflictWarnings ?? true} name="calendarConflictWarnings">
                <span>Предупреждать о пересечениях записей</span>
              </SettingsToggle>
            </div>
          </Card>

          {/* ВКЛАДКА 5: ИНТЕГРАЦИИ */}
          <div
            className={clsx(
              "settings-integrations-tab flex flex-col gap-4",
              activeTab === "integrations" ? "flex" : "hidden",
            )}
          >
            {/* 1. Telegram */}
            <Card className="settings-integration-card p-4 sm:p-5 flex flex-col gap-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-soft pb-3">
                <div className="flex items-center gap-2.5">
                  <AppIcon name="send" size="md" className="text-accent" />
                  <div>
                    <h2 className="m-0 text-text-main text-[15px] font-bold">Telegram</h2>
                    <p className="m-0 mt-0.5 text-text-muted text-xs">
                      Уведомления владельцу о новых заявках с сайта nuarr.pl и ежедневная утренняя сводка.
                    </p>
                  </div>
                </div>
                <StatusBadge
                  tone={
                    !telegramTokenConfigured
                      ? "warning"
                      : !telegramChatIdConfigured
                        ? "warning"
                        : settings.telegramEnabled
                          ? "success"
                          : "neutral"
                  }
                >
                  {!telegramTokenConfigured
                    ? "Бот не подключён на сервере"
                    : !telegramChatIdConfigured
                      ? "Укажите Chat ID"
                      : settings.telegramEnabled
                        ? "Подключено"
                        : "Выключено"}
                </StatusBadge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[1fr_240px] gap-3 items-center rounded-control border border-border-soft bg-field p-3">
                <SettingsToggle defaultChecked={settings.telegramEnabled ?? false} name="telegramEnabled">
                  <span className="font-semibold text-text-main text-[13px]">
                    Разрешить отправку уведомлений в Telegram
                  </span>
                </SettingsToggle>
                <label className="flex flex-col gap-1 text-text-muted text-xs font-medium">
                  <FieldLabel hint="ID чата владельца (можно узнать у @userinfobot после запуска бота)">
                    Telegram Chat ID
                  </FieldLabel>
                  <Input
                    name="telegramChatId"
                    defaultValue={settings.telegramChatId ?? ""}
                    placeholder="123456789"
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-control border border-border-soft bg-field p-3 flex flex-col justify-between gap-2">
                  <SettingsToggle
                    defaultChecked={settings.siteBookingNotifyTelegramEnabled ?? true}
                    name="siteBookingNotifyTelegramEnabled"
                  >
                    <span className="font-medium text-text-main text-[13px]">
                      Мгновенные заявки с сайта nuarr.pl
                    </span>
                  </SettingsToggle>
                  <span className="text-text-muted text-xs pl-6">
                    Отправляет сообщение при каждой новой онлайн-брони с сайта.
                  </span>
                </div>

                <div className="rounded-control border border-border-soft bg-field p-3 flex flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <SettingsToggle
                      defaultChecked={settings.telegramDigestEnabled ?? false}
                      name="telegramDigestEnabled"
                    >
                      <span className="font-medium text-text-main text-[13px]">
                        Ежедневная сводка (дайджест)
                      </span>
                    </SettingsToggle>
                    <div className="flex items-center gap-2">
                      <Input
                        name="telegramDigestTime"
                        type="time"
                        defaultValue={settings.telegramDigestTime ?? "08:00"}
                        className="w-[104px]"
                        aria-label="Время отправки дайджеста"
                      />
                      {telegramServerReady && settings.telegramEnabled ? (
                        <Button
                          size="sm"
                          type="button"
                          variant="secondary"
                          disabled={telegramDigest?.status?.loading}
                          onClick={() => telegramDigest?.runSend?.()}
                        >
                          Отправить
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <span className="text-text-muted text-xs pl-6">
                    Утренняя сводка по записям дня, выручке, сертификатам и дням рождения.
                  </span>
                </div>
              </div>
            </Card>

            {/* 2. SMS / SMSAPI */}
            <Card className="settings-integration-card p-4 sm:p-5 flex flex-col gap-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-soft pb-3">
                <div className="flex items-center gap-2.5">
                  <AppIcon name="message" size="md" className="text-accent" />
                  <div>
                    <h2 className="m-0 text-text-main text-[15px] font-bold">SMS-шлюз (SMSAPI.pl)</h2>
                    <p className="m-0 mt-0.5 text-text-muted text-xs">
                      Канал для напоминаний о визитах, запросов отзывов и возврата клиентов.
                    </p>
                  </div>
                </div>
                <StatusBadge
                  tone={
                    !smsServerConfigured
                      ? "neutral"
                      : settings.smsEnabled
                        ? "success"
                        : "neutral"
                  }
                >
                  {!smsServerConfigured
                    ? "Не подключено"
                    : settings.smsEnabled
                      ? "Подключено"
                      : "Шлюз настроен (выключен)"}
                </StatusBadge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-3 items-center rounded-control border border-border-soft bg-field p-3">
                <SettingsToggle defaultChecked={settings.smsEnabled ?? false} name="smsEnabled">
                  <span className="font-semibold text-text-main text-[13px]">
                    Разрешить отправку SMS из CRM
                  </span>
                </SettingsToggle>
                <label className="flex flex-col gap-1 text-text-muted text-xs font-medium">
                  Имя отправителя (Sender ID)
                  <Input
                    name="smsSenderName"
                    defaultValue={settings.smsSenderName ?? "NUAR"}
                    placeholder="NUAR"
                  />
                </label>
              </div>

              {!smsServerConfigured ? (
                <div className="rounded-control border border-border-soft bg-surface px-3.5 py-2.5 text-xs text-text-muted flex flex-wrap items-center justify-between gap-2">
                  <span>
                    Токен SMSAPI сейчас не подключён на сервере. Автоматические и ручные SMS не отправляются и не создают ошибок в очереди.
                  </span>
                  <Button
                    size="sm"
                    type="button"
                    variant="ghost"
                    onClick={() => setActiveTab("notifications")}
                  >
                    Сценарии в «Уведомлениях»
                  </Button>
                </div>
              ) : (
                <div className="rounded-control border border-border-soft bg-surface px-3.5 py-2.5 text-xs text-text-muted flex flex-wrap items-center justify-between gap-2">
                  <span>
                    В очереди сейчас: напоминания ({smsReminders?.status?.dueCount ?? 0}), отзывы ({reviewRequests?.status?.dueCount ?? 0}), follow-up ({inactiveFollowUp?.status?.dueCount ?? 0}).
                  </span>
                  <Button
                    size="sm"
                    type="button"
                    variant="secondary"
                    onClick={() => setActiveTab("notifications")}
                  >
                    Настроить сценарии SMS
                  </Button>
                </div>
              )}
            </Card>

            {/* 3. Gmail / Booksy */}
            <Card className="settings-integration-card p-4 sm:p-5 flex flex-col gap-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-soft pb-3">
                <div className="flex items-center gap-2.5">
                  <AppIcon name="mailCheck" size="md" className="text-accent" />
                  <div>
                    <h2 className="m-0 text-text-main text-[15px] font-bold">Gmail и импорт Booksy</h2>
                    <p className="m-0 mt-0.5 text-text-muted text-xs">
                      Чтение писем с записями Booksy и приходных документов в разделе «Импорт».
                    </p>
                  </div>
                </div>
                <StatusBadge
                  tone={
                    !settings.gmailBooksySyncEnabled
                      ? "neutral"
                      : settings.gmailClientId
                        ? "success"
                        : "warning"
                  }
                >
                  {!settings.gmailBooksySyncEnabled
                    ? "Выключено"
                    : settings.gmailClientId
                      ? "Client ID задан (вход в «Импорте»)"
                      : "Требуется Client ID"}
                </StatusBadge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-3 items-center rounded-control border border-border-soft bg-field p-3">
                <SettingsToggle defaultChecked={settings.gmailBooksySyncEnabled ?? false} name="gmailBooksySyncEnabled">
                  <span className="font-semibold text-text-main text-[13px]">
                    Разрешить подключение к Gmail для импорта Booksy
                  </span>
                </SettingsToggle>
                <label className="flex flex-col gap-1 text-text-muted text-xs font-medium">
                  Google OAuth Client ID
                  <Input
                    name="gmailClientId"
                    defaultValue={settings.gmailClientId ?? ""}
                    placeholder="...apps.googleusercontent.com"
                  />
                </label>
              </div>
            </Card>

            {/* 4. Сворачиваемая секция «Диагностика» для администратора */}
            <Card className="settings-integration-card p-4 sm:p-5 flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <AppIcon name="activity" size="md" className="text-text-muted" />
                  <div>
                    <h2 className="m-0 text-text-main text-sm font-bold">
                      Диагностика и тестирование каналов
                    </h2>
                    <p className="m-0 text-text-muted text-xs">
                      Служебный раздел для проверки очередей, предпросмотра и ручной тестовой отправки.
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  type="button"
                  variant="secondary"
                  onClick={() => setDiagnosticsOpen((current) => !current)}
                >
                  {diagnosticsOpen ? "Скрыть диагностику" : "Открыть диагностику"}
                </Button>
              </div>

              {diagnosticsOpen ? (
                <div className="flex flex-col gap-4 pt-2 border-t border-border-soft">
                  <IntegrationHealthPanel
                    actions={integrationHealthActions}
                    report={integrationHealth}
                  />

                  {telegramDigest && (
                    <div className="rounded-control border border-border-soft bg-field p-3.5">
                      <TelegramDigestPanel
                        pushNotification={pushNotification}
                        status={telegramDigest.status}
                        onPreview={telegramDigest.runPreview}
                        onRefreshStatus={telegramDigest.refreshStatus}
                        onSend={telegramDigest.runSend}
                      />
                    </div>
                  )}

                  {smsServerConfigured && smsReminders ? (
                    <div className="rounded-control border border-border-soft bg-field p-3.5">
                      <SmsRemindersPanel
                        status={smsReminders.status}
                        onPreview={smsReminders.runPreview}
                        onProcess={smsReminders.runProcess}
                        onRefreshStatus={smsReminders.refreshStatus}
                      />
                    </div>
                  ) : null}

                  {smsServerConfigured && reviewRequests ? (
                    <div className="rounded-control border border-border-soft bg-field p-3.5">
                      <ReviewRequestsPanel
                        pushNotification={pushNotification}
                        status={reviewRequests.status}
                        onPreview={reviewRequests.runPreview}
                        onProcess={reviewRequests.runProcess}
                        onRefreshStatus={reviewRequests.refreshStatus}
                      />
                    </div>
                  ) : null}

                  {smsServerConfigured && inactiveFollowUp ? (
                    <div className="rounded-control border border-border-soft bg-field p-3.5">
                      <InactiveFollowUpPanel
                        pushNotification={pushNotification}
                        status={inactiveFollowUp.status}
                        onPreview={inactiveFollowUp.runPreview}
                        onProcess={inactiveFollowUp.runProcess}
                        onRefreshStatus={inactiveFollowUp.refreshStatus}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}
            </Card>
          </div>

          {/* ВКЛАДКА 6: ДАННЫЕ */}
          <div
            className={clsx(
              "flex flex-col gap-4",
              activeTab === "data" ? "flex" : "hidden",
            )}
          >
            <Card className="p-4 sm:p-5 flex flex-col gap-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-soft pb-3">
                <div className="flex items-center gap-2.5">
                  <AppIcon name="cloudUpload" size="md" className="text-accent" />
                  <div>
                    <h2 className="m-0 text-text-main text-[15px] font-bold">База данных сервера</h2>
                    <p className="m-0 mt-0.5 text-text-muted text-xs">
                      Состояние синхронизации CRM с сервером Hetzner PostgreSQL.
                    </p>
                  </div>
                </div>
                <StatusBadge tone={cloudLoadError || lastCloudSyncError || cloudConflict ? "warning" : "success"}>
                  {cloudLoadError || lastCloudSyncError || cloudConflict ? "Требует внимания" : "Подключено (Hetzner)"}
                </StatusBadge>
              </div>

              <div className="p-3.5 border border-border-soft rounded-control bg-field flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-text-faint text-xs">Статус синхронизации</span>
                  <strong className="text-text-main text-sm font-semibold">
                    {lastCloudSyncAt ? `Обновлено: ${formatCloudSyncTime(lastCloudSyncAt)}` : "Автосохранение через сервер активно"}
                  </strong>
                  <small
                    className={clsx(
                      "text-xs leading-normal mt-0.5 block",
                      cloudLoadError || lastCloudSyncError || cloudConflict
                        ? "settings-cloud-message is-error font-medium"
                        : "text-text-muted",
                    )}
                  >
                    {cloudStatusMessage}
                  </small>
                </div>

                {cloudEnabled ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    type="button"
                    disabled={!cloudHydrated || cloudSyncing || Boolean(cloudConflict)}
                    onClick={onForceCloudSave}
                    className="flex items-center gap-1.5 shrink-0"
                  >
                    <AppIcon name="cloudUpload" size="sm" />
                    {cloudSyncing ? "Сохранение..." : "Синхронизировать"}
                  </Button>
                ) : null}
              </div>

              {cloudConflict && (
                <div className="settings-cloud-conflict p-3 border rounded-control flex flex-col gap-2.5">
                  <p className="m-0 text-xs leading-normal">
                    В облаке более свежая версия ({formatCloudSyncTime(cloudConflict.remoteUpdatedAt)}). Выберите, какую копию сохранить.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      type="button"
                      disabled={cloudSyncing}
                      onClick={onApplyRemoteSnapshot}
                    >
                      Загрузить с сервера
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      type="button"
                      disabled={cloudSyncing}
                      onClick={onOverwriteRemoteSnapshot}
                    >
                      Оставить текущую версию
                    </Button>
                  </div>
                </div>
              )}
            </Card>

            <Card className="p-4 sm:p-5 flex flex-col gap-3.5">
              <div className="flex items-center gap-2.5 border-b border-border-soft pb-3">
                <AppIcon name="databaseBackup" size="md" className="text-accent" />
                <div>
                  <h2 className="m-0 text-text-main text-[15px] font-bold">Резервная копия JSON</h2>
                  <p className="m-0 mt-0.5 text-text-muted text-xs">
                    Выгрузка и восстановление полной копии базы CRM (клиенты, визиты, услуги, пакеты, сертификаты, сотрудники, задачи и настройки).
                  </p>
                </div>
              </div>

              <div className="p-3.5 border border-border-soft rounded-control bg-field flex flex-wrap items-center justify-between gap-3">
                <span className="text-text-muted text-xs">
                  Рекомендуется скачивать резервную копию перед массовым импортом данных.
                </span>
                <div className="flex items-center gap-2.5">
                  <Button
                    variant="secondary"
                    size="sm"
                    type="button"
                    onClick={onExportData}
                    className="flex items-center gap-1.5 cursor-pointer"
                  >
                    <AppIcon name="download" size="sm" />
                    Скачать копию (.json)
                  </Button>
                  <label className="settings-import-button inline-flex items-center justify-center min-h-8 px-3 gap-1.5 border rounded-control text-xs font-medium transition-colors cursor-pointer">
                    <AppIcon name="upload" size="sm" />
                    Восстановить из файла
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
