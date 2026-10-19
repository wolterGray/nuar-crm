import clsx from "clsx";
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {
  createUser,
  disableUser,
  enableUser,
  fetchUsers,
  sendUserReset,
  updateUser,
} from "../../api/users.js";
import {COLOR_THEME_OPTIONS} from "../../constants/colorThemes.js";
import {useBreakpoint} from "../../hooks/useBreakpoint.js";
import {resolveColorTheme} from "../../utils/colorTheme.js";
import {buildIntegrationHealth} from "../../utils/integrationHealth.js";
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
  Input,
  PageHeader,
  Select,
  Switch,
  TabButton,
  Tabs,
} from "../ui/index.js";
import {
  PERMISSIONS,
  ROLE_DEFAULT_PERMISSIONS,
  canViewPage,
  getAllowedMobileNav,
  getAllowedNavigation,
} from "../../utils/permissions.js";
import {navGroups} from "../../constants/navigation.js";

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

const USER_ROLE_OPTIONS = [
  {label: "Владелец (Owner)", value: "owner"},
  {label: "Администратор", value: "admin"},
  {label: "Менеджер", value: "manager"},
  {label: "Сотрудник", value: "staff"},
  {label: "Только чтение", value: "readonly"},
];

const formatUserDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

function UserAccessPanel({authUser, pushNotification}) {
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({email: "", employeeId: "", name: "", role: "staff"});
  const [employees, setEmployees] = useState([]);
  const [permissionGroups, setPermissionGroups] = useState([]);
  const [editingPermsUser, setEditingPermsUser] = useState(null);
  const [permsDraft, setPermsDraft] = useState({});
  const [modalTab, setModalTab] = useState("permissions"); // "permissions" | "preview"
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [savingPerms, setSavingPerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [resetInfo, setResetInfo] = useState(null);
  const [rows, setRows] = useState([]);
  const [savingId, setSavingId] = useState(null);

  const isOwner = !authUser?.role || authUser.role === "owner";

  const loadUsers = useCallback(async () => {
    if (!isOwner) {
      setRows([]);
      setLoadError("Управление доступами доступно только владельцу студии (Owner).");
      return;
    }

    setLoading(true);
    setLoadError("");
    try {
      const payload = await fetchUsers();
      setRows(payload.users || []);
      setEmployees(payload.employees || []);
      setPermissionGroups(payload.permissionGroups || []);
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
  }, [isOwner, pushNotification]);

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

  const handleCopyResetUrl = async (url) => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      pushNotification?.({
        title: "Ссылка скопирована",
        message: "Отправьте её сотруднику для установки пароля",
        persist: false,
      });
    } catch {
      pushNotification?.({
        title: "Скопируйте ссылку вручную",
        message: url,
        persist: false,
      });
    }
  };

  const handleCreateUser = async () => {
    const normalizedEmail = String(draft.email ?? "").trim().toLowerCase();
    if (!normalizedEmail) return;

    setCreating(true);
    setResetInfo(null);
    try {
      const payload = await createUser({
        email: normalizedEmail,
        employeeId: draft.employeeId ? Number(draft.employeeId) : null,
        name: String(draft.name ?? "").trim(),
        role: draft.role,
      });
      setRows((current) => [...current, payload.user]);
      setDraft({email: "", employeeId: "", name: "", role: "staff"});
      if (payload.resetUrl) {
        setResetInfo({
          email: payload.user.email,
          emailSent: Boolean(payload.resetEmailSent),
          smtpConfigured: Boolean(payload.smtpConfigured),
          url: payload.resetUrl,
        });
      }
      pushNotification?.({
        title: "Пользователь создан",
        message: payload.resetEmailSent
          ? `Письмо со ссылкой для установки пароля отправлено на ${payload.user.email}.`
          : "Скопируйте одноразовую ссылку ниже и отправьте сотруднику для задания пароля.",
      });
    } catch (error) {
      pushNotification?.({
        title: "Пользователь не создан",
        message: error?.message || "Проверьте корректность email и выбранной роли",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateUser = async (user) => {
    setSavingId(user.id);
    try {
      const payload = await updateUser(user.id, {
        email: user.email,
        employeeId: user.employeeId ? Number(user.employeeId) : null,
        isActive: user.isActive,
        name: user.name,
        permissions: user.permissions || {},
        role: user.role,
      });
      patchRow(user.id, payload.user);
      pushNotification?.({
        title: "Доступ сохранён",
        message: `${payload.user.email} (${USER_ROLE_OPTIONS.find((r) => r.value === payload.user.role)?.label || payload.user.role})`,
      });
    } catch (error) {
      pushNotification?.({
        title: "Доступ не обновлён",
        message: error?.message || "Нельзя удалить или понизить последнего активного владельца",
      });
      void loadUsers();
    } finally {
      setSavingId(null);
    }
  };

  const handleToggleUser = async (user) => {
    setSavingId(user.id);
    try {
      const payload = user.isActive
        ? await disableUser(user.id)
        : await enableUser(user.id);
      patchRow(user.id, payload.user);
      pushNotification?.({
        title: payload.user.isActive ? "Доступ включён" : "Доступ отключён",
        message: payload.user.email,
      });
    } catch (error) {
      pushNotification?.({
        title: "Статус не изменён",
        message: error?.message || "Нельзя отключить последнего активного владельца",
      });
    } finally {
      setSavingId(null);
    }
  };

  const handleSendReset = async (user) => {
    setSavingId(user.id);
    setResetInfo(null);
    try {
      const payload = await sendUserReset(user.id);
      if (payload.resetUrl) {
        setResetInfo({
          email: user.email,
          emailSent: Boolean(payload.resetEmailSent),
          smtpConfigured: Boolean(payload.smtpConfigured),
          url: payload.resetUrl,
        });
      }
      pushNotification?.({
        title: payload.resetEmailSent ? "Ссылка отправлена на почту" : "Ссылка для пароля создана",
        message: payload.resetEmailSent
          ? `Письмо отправлено на ${user.email}`
          : "Скопируйте ссылку ниже и передайте сотруднику.",
      });
    } catch (error) {
      pushNotification?.({
        title: "Не удалось создать ссылку",
        message: error?.message || "Пользователь должен быть активен",
      });
    } finally {
      setSavingId(null);
    }
  };

  const openPermissionsModal = (user) => {
    setEditingPermsUser(user);
    setPermsDraft({ ...(user.permissions || {}) });
    setModalTab("permissions");
    setCollapsedGroups({});
  };

  const handleTogglePermission = (key, currentVal) => {
    setPermsDraft((prev) => ({
      ...prev,
      [key]: !currentVal,
    }));
  };

  const handleApplyRoleTemplate = (roleKey) => {
    const templatePerms = ROLE_DEFAULT_PERMISSIONS[roleKey];
    if (!templatePerms) return;
    setPermsDraft({ ...templatePerms });
    pushNotification?.({
      title: "Шаблон применён",
      message: `Загружены настройки прав для роли «${USER_ROLE_OPTIONS.find((r) => r.value === roleKey)?.label || roleKey}»`,
      persist: false,
    });
  };

  const handleResetPermissionsToRole = () => {
    setPermsDraft({});
  };

  const handleToggleSection = (group) => {
    if (!editingPermsUser) return;
    const roleDefaults = ROLE_DEFAULT_PERMISSIONS[editingPermsUser.role] || ROLE_DEFAULT_PERMISSIONS.staff;
    const allEnabled = group.permissions.every((perm) => {
      const val = permsDraft[perm.key] !== undefined ? permsDraft[perm.key] : roleDefaults[perm.key];
      return Boolean(val);
    });

    const targetVal = !allEnabled;
    setPermsDraft((prev) => {
      const next = { ...prev };
      group.permissions.forEach((perm) => {
        next[perm.key] = targetVal;
      });
      return next;
    });
  };

  const toggleGroupCollapse = (groupId) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const effectivePermsUser = useMemo(() => {
    if (!editingPermsUser) return null;
    const roleDefaults = ROLE_DEFAULT_PERMISSIONS[editingPermsUser.role] || ROLE_DEFAULT_PERMISSIONS.staff;
    const effectivePermissions = { ...roleDefaults, ...permsDraft };
    return {
      ...editingPermsUser,
      effectivePermissions,
      permissions: permsDraft,
    };
  }, [editingPermsUser, permsDraft]);

  const summaryItems = useMemo(() => {
    if (!effectivePermsUser) return [];
    const p = effectivePermsUser.effectivePermissions || {};
    const items = [];

    // Calendar
    if (p[PERMISSIONS.CALENDAR_VIEW_ALL]) {
      items.push({ label: "Календарь", value: "Все мастера и смены", variant: "success", icon: "calendarDays" });
    } else if (p[PERMISSIONS.CALENDAR_VIEW_ASSIGNED]) {
      items.push({ label: "Календарь", value: "Только свои записи", variant: "warning", icon: "userCheck" });
    } else {
      items.push({ label: "Календарь", value: "Доступ закрыт", variant: "danger", icon: "calendarOff" });
    }

    // Contacts
    if (p[PERMISSIONS.CLIENTS_VIEW_CONTACTS]) {
      items.push({ label: "Контакты гостей", value: "Телефоны и email открыты", variant: "info", icon: "phone" });
    } else {
      items.push({ label: "Контакты гостей", value: "Телефоны и email скрыты", variant: "warning", icon: "phoneOff" });
    }

    // Finance
    if (p[PERMISSIONS.FINANCE_VIEW_SALON_STATS]) {
      items.push({ label: "Финансы", value: "Касса и выручка студии", variant: "neutral", icon: "coins" });
    } else if (p[PERMISSIONS.PAYOUTS_VIEW_OWN]) {
      items.push({ label: "Финансы", value: "Только личные начисления", variant: "neutral", icon: "receipt" });
    } else {
      items.push({ label: "Финансы", value: "Полностью скрыты", variant: "danger", icon: "walletCards" });
    }

    // Catalog
    if (p[PERMISSIONS.CATALOG_MANAGE]) {
      items.push({ label: "Каталог", value: "Управление ценами и услугами", variant: "info", icon: "briefcase" });
    } else if (p[PERMISSIONS.CATALOG_VIEW]) {
      items.push({ label: "Каталог", value: "Только просмотр услуг", variant: "neutral", icon: "eye" });
    } else {
      items.push({ label: "Каталог", value: "Скрыт от сотрудника", variant: "disabled", icon: "briefcase" });
    }

    // Access management
    if (p[PERMISSIONS.USERS_MANAGE]) {
      items.push({ label: "Безопасность", value: "Управление ролями и аккаунтами", variant: "warning", icon: "shield" });
    }

    return items;
  }, [effectivePermsUser]);

  const previewAllowedGroups = useMemo(() => {
    if (!effectivePermsUser) return [];
    return getAllowedNavigation(navGroups, effectivePermsUser);
  }, [effectivePermsUser]);

  const previewAllowedMobile = useMemo(() => {
    if (!effectivePermsUser) return [];
    return getAllowedMobileNav(effectivePermsUser);
  }, [effectivePermsUser]);

  const handleSavePermissions = async () => {
    if (!editingPermsUser) return;
    setSavingPerms(true);
    try {
      const payload = await updateUser(editingPermsUser.id, {
        email: editingPermsUser.email,
        employeeId: editingPermsUser.employeeId ? Number(editingPermsUser.employeeId) : null,
        isActive: editingPermsUser.isActive,
        name: editingPermsUser.name,
        permissions: permsDraft,
        role: editingPermsUser.role,
      });
      patchRow(editingPermsUser.id, payload.user);
      pushNotification?.({
        title: "Права доступа сохранены",
        message: `${payload.user.email} (${payload.user.role})`,
      });
      setEditingPermsUser(null);
    } catch (error) {
      pushNotification?.({
        title: "Не удалось сохранить права",
        message: error?.message || "Ошибка обновления прав доступа",
      });
    } finally {
      setSavingPerms(false);
    }
  };

  return (
    <Card className="p-4 sm:p-5 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-soft pb-3">
        <div className="flex items-center gap-2.5">
          <AppIcon name="shield" size="md" className="text-accent" />
          <div>
            <h2 className="m-0 text-text-main text-[15px] font-bold">Доступы сотрудников и права</h2>
            <p className="m-0 mt-0.5 text-text-muted text-xs">
              Учётные записи, привязка к мастерам, роли и детальные разрешения доступа к CRM.
            </p>
          </div>
        </div>
        <StatusBadge tone="neutral">
          Активных: {rows.filter((row) => row.isActive).length} из {rows.length}
        </StatusBadge>
      </div>

      {!isOwner ? (
        <div className="rounded-control border border-border bg-field p-3.5 text-xs text-text-muted">
          Вы вошли с ролью «{USER_ROLE_OPTIONS.find((r) => r.value === authUser?.role)?.label || authUser?.role}». Управление пользователями и ролями доступно только владельцу студии.
        </div>
      ) : (
        <>
          <section className="rounded-control border border-border-soft bg-field p-3.5 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <strong className="text-text-main text-[13px] font-semibold">Добавить пользователя</strong>
              <span className="text-text-faint text-[11px]">
                После создания вы получите ссылку для установки пароля
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[minmax(180px,1.2fr)_minmax(130px,0.8fr)_160px_170px_auto] gap-2.5 items-end">
              <label className="flex flex-col gap-1 text-text-muted text-xs font-medium">
                Email для входа
                <Input
                  autoComplete="off"
                  placeholder="master@nuarr.pl"
                  type="email"
                  value={draft.email}
                  onChange={(event) => setDraft((current) => ({...current, email: event.target.value}))}
                />
              </label>
              <label className="flex flex-col gap-1 text-text-muted text-xs font-medium">
                Имя сотрудника
                <Input
                  autoComplete="off"
                  placeholder="Например, Натали"
                  value={draft.name}
                  onChange={(event) => setDraft((current) => ({...current, name: event.target.value}))}
                />
              </label>
              <label className="flex flex-col gap-1 text-text-muted text-xs font-medium">
                Роль в CRM
                <Select
                  value={draft.role}
                  onChange={(event) => setDraft((current) => ({...current, role: event.target.value}))}
                >
                  {USER_ROLE_OPTIONS.map((role) => (
                    <option key={role.value} value={role.value}>{role.label}</option>
                  ))}
                </Select>
              </label>
              <label className="flex flex-col gap-1 text-text-muted text-xs font-medium">
                Привязка к мастеру
                <Select
                  value={draft.employeeId}
                  onChange={(event) => setDraft((current) => ({...current, employeeId: event.target.value}))}
                >
                  <option value="">— Без привязки —</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} {emp.role ? `(${emp.role})` : ""}
                    </option>
                  ))}
                </Select>
              </label>
              <Button
                className="flex items-center justify-center gap-1.5 min-h-10"
                disabled={creating || !draft.email.trim()}
                loading={creating}
                type="button"
                variant="primary"
                onClick={handleCreateUser}
              >
                <AppIcon name="userPlus" size="sm" />
                Создать
              </Button>
            </div>
          </section>

          {resetInfo ? (
            <div className="settings-success-note rounded-control border p-3 flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs">
                  <strong className="font-semibold">
                    Одноразовая ссылка для установки пароля ({resetInfo.email})
                  </strong>
                  <span className="block text-text-muted mt-0.5">
                    {resetInfo.emailSent
                      ? "Письмо отправлено на почту. При необходимости вы также можете скопировать ссылку вручную:"
                      : "Почтовый сервер (SMTP) не подключён — скопируйте ссылку и отправьте сотруднику в Telegram или мессенджер:"}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    type="button"
                    variant="secondary"
                    onClick={() => handleCopyResetUrl(resetInfo.url)}
                  >
                    Скопировать ссылку
                  </Button>
                  <Button
                    size="sm"
                    type="button"
                    variant="ghost"
                    onClick={() => setResetInfo(null)}
                  >
                    Скрыть
                  </Button>
                </div>
              </div>
              <input
                readOnly
                className="w-full rounded-control border border-border bg-surface px-2.5 py-1.5 text-xs font-mono text-text-main select-all"
                value={resetInfo.url}
                onFocus={(event) => event.target.select()}
              />
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            {loading ? (
              <div className="rounded-control border border-border bg-field p-3.5 text-xs text-text-muted">
                Загрузка списка пользователей…
              </div>
            ) : loadError ? (
              <div className="rounded-control border border-accentError/40 bg-field p-3.5 text-xs text-accentError flex items-center justify-between gap-3">
                <span>{loadError}</span>
                <Button size="sm" type="button" variant="secondary" onClick={loadUsers}>
                  Повторить
                </Button>
              </div>
            ) : rows.length ? (
              rows.map((user) => {
                const customPermCount = Object.keys(user.permissions || {}).length;
                return (
                  <article
                    className="grid grid-cols-1 xl:grid-cols-[minmax(160px,1.1fr)_minmax(110px,0.7fr)_140px_160px_90px_120px_auto] gap-2.5 items-center rounded-control border border-border-soft bg-field px-3.5 py-2.5"
                    key={user.id}
                  >
                    <Input
                      aria-label="Email"
                      type="email"
                      value={user.email}
                      onChange={(event) => patchRow(user.id, {email: event.target.value})}
                    />
                    <Input
                      aria-label="Имя"
                      placeholder="Имя"
                      value={user.name || ""}
                      onChange={(event) => patchRow(user.id, {name: event.target.value})}
                    />
                    <Select
                      aria-label="Роль"
                      value={user.role}
                      onChange={(event) => patchRow(user.id, {role: event.target.value})}
                    >
                      {USER_ROLE_OPTIONS.map((role) => (
                        <option key={role.value} value={role.value}>{role.label}</option>
                      ))}
                    </Select>
                    <Select
                      aria-label="Мастер"
                      value={user.employeeId || ""}
                      onChange={(event) => patchRow(user.id, {employeeId: event.target.value ? Number(event.target.value) : null})}
                    >
                      <option value="">— Без мастера —</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name}
                        </option>
                      ))}
                    </Select>
                    <span
                      className={clsx(
                        "settings-user-status inline-flex min-h-8 items-center justify-center rounded-control border px-2 text-xs font-bold",
                        user.isActive ? "is-active" : "is-disabled",
                      )}
                    >
                      {user.isActive ? "Активен" : "Отключён"}
                    </span>
                    <div className="text-[11px] text-text-muted leading-tight">
                      <span className="block">Создан: {formatUserDate(user.createdAt)}</span>
                      <span className="block mt-0.5">Вход: {formatUserDate(user.lastLoginAt)}</span>
                    </div>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <Button
                        size="sm"
                        type="button"
                        variant="secondary"
                        title="Настройка индивидуальных прав доступа"
                        onClick={() => openPermissionsModal(user)}
                        className="flex items-center gap-1"
                      >
                        <AppIcon name="shield" size="xs" />
                        Права
                        {customPermCount > 0 ? (
                          <span className="ml-0.5 rounded-full bg-accent/20 px-1 py-0.2 text-[10px] text-accent font-bold">
                            {customPermCount}
                          </span>
                        ) : null}
                      </Button>
                      <Button
                        disabled={savingId === user.id}
                        size="sm"
                        type="button"
                        variant="secondary"
                        onClick={() => handleUpdateUser(user)}
                      >
                        Сохранить
                      </Button>
                      <Button
                        disabled={savingId === user.id || !user.isActive}
                        size="sm"
                        title="Получить или отправить ссылку для смены пароля"
                        type="button"
                        variant="secondary"
                        onClick={() => handleSendReset(user)}
                      >
                        <AppIcon name="send" size="xs" />
                        Пароль
                      </Button>
                      <Button
                        disabled={savingId === user.id}
                        size="sm"
                        type="button"
                        variant={user.isActive ? "danger" : "secondary"}
                        onClick={() => handleToggleUser(user)}
                      >
                        <AppIcon name="power" size="xs" />
                        {user.isActive ? "Откл." : "Вкл."}
                      </Button>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="rounded-control border border-border bg-field p-3.5 text-xs text-text-muted">
                Пользователей в базе пока нет. Создайте первую учётную запись выше.
              </div>
            )}
          </div>
        </>
      )}

      {/* Модальное окно индивидуальной настройки прав доступа (RBAC) */}
      <Dialog open={Boolean(editingPermsUser)}>
        <DialogBackdrop>
          <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-4 sm:p-5 bg-surface border-border rounded-modal shadow-modal">
            <DialogHeader className="border-b border-border-soft pb-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-control bg-accent/15 border border-accent/30 flex items-center justify-center shrink-0 text-accent">
                    <AppIcon name="shield" size="md" />
                  </div>
                  <div className="min-w-0">
                    <DialogTitle className="text-base font-bold text-text-main m-0 truncate">
                      Права доступа: {editingPermsUser?.name || editingPermsUser?.email}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-text-muted mt-0.5 m-0 flex items-center gap-1.5 flex-wrap">
                      <span>Роль:</span>
                      <strong className="text-text-main">
                        {USER_ROLE_OPTIONS.find((r) => r.value === editingPermsUser?.role)?.label || editingPermsUser?.role}
                      </strong>
                      <span className="text-text-faint">•</span>
                      <span>{editingPermsUser?.email}</span>
                    </DialogDescription>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  type="button"
                  onClick={() => setEditingPermsUser(null)}
                >
                  <AppIcon name="x" size="sm" />
                </Button>
              </div>

              {/* Переключатель вкладок: Настройки прав vs Предпросмотр */}
              <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-border-soft">
                <button
                  type="button"
                  onClick={() => setModalTab("permissions")}
                  className={clsx(
                    "px-3 py-1.5 rounded-control text-xs font-semibold transition-colors flex items-center gap-1.5",
                    modalTab === "permissions"
                      ? "bg-accent text-white shadow-sm"
                      : "text-text-muted hover:text-text-main hover:bg-surface-2",
                  )}
                >
                  <AppIcon name="shield" size="xs" />
                  Настройки прав
                </button>
                <button
                  type="button"
                  onClick={() => setModalTab("preview")}
                  className={clsx(
                    "px-3 py-1.5 rounded-control text-xs font-semibold transition-colors flex items-center gap-1.5",
                    modalTab === "preview"
                      ? "bg-accent text-white shadow-sm"
                      : "text-text-muted hover:text-text-main hover:bg-surface-2",
                  )}
                >
                  <AppIcon name="eye" size="xs" />
                  Предпросмотр навигации
                  {previewAllowedGroups.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 rounded-full bg-field text-[10px]">
                      {previewAllowedGroups.length}
                    </span>
                  )}
                </button>
              </div>
            </DialogHeader>

            <div className="overflow-y-auto flex-1 py-3 pr-1 flex flex-col gap-4">
              {modalTab === "permissions" ? (
                <>
                  {/* Панель быстрых шаблонов ролей */}
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-control bg-surface-2/60 border border-border-soft">
                    <div className="flex items-center gap-1.5 text-xs text-text-muted">
                      <AppIcon name="sparkles" size="xs" className="text-accent" />
                      <span className="font-medium">Шаблоны:</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        className="h-7 text-xs px-2.5"
                        onClick={() => handleApplyRoleTemplate("owner")}
                        title="Полный доступ ко всей CRM и настройкам"
                      >
                        Владелец
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        className="h-7 text-xs px-2.5"
                        onClick={() => handleApplyRoleTemplate("admin")}
                        title="Все операции кроме управления пользователями"
                      >
                        Админ
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        className="h-7 text-xs px-2.5"
                        onClick={() => handleApplyRoleTemplate("staff")}
                        title="Только свои визиты, маскированные контакты, свои начисления"
                      >
                        Массажист
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        className="h-7 text-xs px-2.5"
                        onClick={() => handleApplyRoleTemplate("readonly")}
                        title="Просмотр календаря и базы клиентов без редактирования"
                      >
                        Только чтение
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        type="button"
                        className="h-7 text-xs px-2 text-text-faint hover:text-text-main"
                        onClick={handleResetPermissionsToRole}
                        title="Сбросить все индивидуальные переопределения к роли пользователя"
                      >
                        Сбросить
                      </Button>
                    </div>
                  </div>

                  {/* Сводка доступа (Access Summary Card) */}
                  <div className="flex flex-col gap-2 p-3 rounded-control bg-field border border-border-soft">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-text-faint uppercase tracking-wider">
                        Итоговый профиль доступа сотрудника
                      </span>
                      <span className="text-[11px] text-text-muted">
                        {Object.keys(permsDraft).length > 0 ? (
                          <span className="text-accent font-medium">
                            {Object.keys(permsDraft).length} индивидуальных переопределений
                          </span>
                        ) : (
                          "Стандартные права роли"
                        )}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {summaryItems.map((item, idx) => (
                        <Badge
                          key={idx}
                          variant={item.variant}
                          size="sm"
                          className="flex items-center gap-1.5 py-1 px-2.5 text-[11px] font-medium"
                        >
                          <AppIcon name={item.icon} size="xs" />
                          <span>
                            {item.label}: <strong className="font-semibold">{item.value}</strong>
                          </span>
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Двухуровневый список прав: Раздел (Level 1) → Действия (Level 2) */}
                  <div className="flex flex-col gap-3">
                    {permissionGroups.map((group) => {
                      const roleDefaults = ROLE_DEFAULT_PERMISSIONS[editingPermsUser?.role] || ROLE_DEFAULT_PERMISSIONS.staff;
                      const activeCount = group.permissions.filter((perm) => {
                        const val = permsDraft[perm.key] !== undefined ? permsDraft[perm.key] : roleDefaults[perm.key];
                        return Boolean(val);
                      }).length;
                      const allEnabled = activeCount === group.permissions.length;
                      const isCollapsed = Boolean(collapsedGroups[group.id]);

                      return (
                        <div
                          key={group.id}
                          className="rounded-control border border-border-soft bg-surface-2/40 overflow-hidden flex flex-col"
                        >
                          {/* Уровень 1: Раздел */}
                          <div className="flex items-center justify-between gap-3 p-3 bg-surface-2/70 border-b border-border-soft">
                            <button
                              type="button"
                              onClick={() => toggleGroupCollapse(group.id)}
                              className="flex items-center gap-2 text-left flex-1 hover:opacity-85 transition-opacity"
                            >
                              <AppIcon
                                name={isCollapsed ? "chevronRight" : "chevronDown"}
                                size="xs"
                                className="text-text-muted shrink-0"
                              />
                              <div className="flex flex-col">
                                <span className="text-xs font-bold text-text-main tracking-tight uppercase">
                                  {group.title}
                                </span>
                                <span className="text-[10px] text-text-faint">
                                  Активно: {activeCount} из {group.permissions.length}
                                </span>
                              </div>
                            </button>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[11px] text-text-muted hidden sm:inline">
                                {allEnabled ? "Все включены" : activeCount === 0 ? "Отключено" : "Частично"}
                              </span>
                              <Switch
                                checked={allEnabled}
                                onChange={() => handleToggleSection(group)}
                                aria-label={`Переключить весь раздел ${group.title}`}
                              />
                            </div>
                          </div>

                          {/* Уровень 2: Детальные действия */}
                          {!isCollapsed && (
                            <div className="flex flex-col gap-1.5 p-2.5">
                              {group.permissions.map((perm) => {
                                const isOverridden = permsDraft[perm.key] !== undefined;
                                const isChecked = isOverridden
                                  ? Boolean(permsDraft[perm.key])
                                  : Boolean(roleDefaults[perm.key]);
                                const isSensitive =
                                  perm.key.endsWith(".delete") ||
                                  perm.key === PERMISSIONS.USERS_MANAGE ||
                                  perm.key === PERMISSIONS.FINANCE_DAY_CLOSE;

                                return (
                                  <div
                                    key={perm.key}
                                    className="flex items-center justify-between gap-3 p-2.5 rounded-control bg-surface/60 border border-border-soft hover:border-border transition-colors"
                                  >
                                    <div className="flex flex-col gap-0.5">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-xs font-semibold text-text-main">{perm.label}</span>
                                        {isSensitive && (
                                          <Badge variant="danger" size="sm">
                                            Опасное
                                          </Badge>
                                        )}
                                        {isOverridden && (
                                          <Badge variant="info" size="sm">
                                            Изменено
                                          </Badge>
                                        )}
                                      </div>
                                      <span className="text-[11px] text-text-muted leading-tight">
                                        {perm.description}
                                      </span>
                                    </div>
                                    <div className="shrink-0">
                                      <Switch
                                        checked={isChecked}
                                        onChange={() => handleTogglePermission(perm.key, isChecked)}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                /* Режим живого предпросмотра навигации (Navigation Preview) */
                <div className="flex flex-col gap-4">
                  <div className="rounded-control border border-border-soft bg-surface-2/40 p-3 flex items-center gap-2.5 text-xs text-text-muted">
                    <AppIcon name="info" size="sm" className="text-accent shrink-0" />
                    <div>
                      Режим предпросмотра отображает структуру навигации, доступную пользователю с текущим набором прав, без необходимости перезахода в систему.
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {/* Десктопное меню */}
                    <div className="flex flex-col gap-2 rounded-control bg-field p-3.5 border border-border-soft">
                      <div className="flex items-center gap-2 text-xs font-bold text-text-main border-b border-border-soft pb-2">
                        <AppIcon name="monitor" size="xs" className="text-text-muted" />
                        <span>Десктопное меню ({previewAllowedGroups.length} разделов)</span>
                      </div>
                      <div className="flex flex-col gap-3 py-1">
                        {previewAllowedGroups.map((group) => (
                          <div key={group.id} className="flex flex-col gap-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-text-faint px-1">
                              {group.label}
                            </span>
                            <div className="flex flex-col gap-1">
                              {group.items.map((item) => (
                                <div
                                  key={item.page}
                                  className="flex items-center justify-between px-2.5 py-1.5 rounded-control text-xs bg-surface/80 border border-border-soft text-text-main"
                                >
                                  <div className="flex items-center gap-2">
                                    <AppIcon name={item.icon} size="xs" className="text-accent" />
                                    <span>{item.label}</span>
                                  </div>
                                  <span className="text-[10px] text-text-faint font-mono">/{item.page}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Мобильная навигация */}
                    <div className="flex flex-col gap-3 rounded-control bg-field p-3.5 border border-border-soft">
                      <div className="flex items-center gap-2 text-xs font-bold text-text-main border-b border-border-soft pb-2">
                        <AppIcon name="smartphone" size="xs" className="text-text-muted" />
                        <span>Мобильная нижняя панель ({previewAllowedMobile.length} кнопок)</span>
                      </div>
                      <div className="p-3 bg-surface rounded-control border border-border flex items-center justify-between gap-1 shadow-sm">
                        {previewAllowedMobile.map((item) => (
                          <div key={item.page} className="flex flex-col items-center gap-1 text-center flex-1">
                            <div className="w-8 h-8 rounded-full bg-field border border-border-soft flex items-center justify-center text-accent">
                              <AppIcon name={item.icon} size="xs" />
                            </div>
                            <span className="text-[10px] font-medium text-text-main leading-none truncate max-w-[54px]">
                              {item.label}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-col gap-1.5 border-t border-border-soft pt-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-text-faint">
                          Доступность ключевых разделов
                        </span>
                        <div className="grid grid-cols-2 gap-1 text-xs">
                          {[
                            {name: "Календарь", page: "calendar"},
                            {name: "Клиенты", page: "clients"},
                            {name: "Выручка студии", page: "payments"},
                            {name: "Мои начисления", page: "my-earnings"},
                            {name: "Каталог услуг", page: "services"},
                            {name: "Задачи/Чек-листы", page: "operations"},
                            {name: "Сотрудники/Смены", page: "masters"},
                            {name: "Статистика", page: "statistics"},
                            {name: "Настройки", page: "settings"},
                          ].map((sec) => {
                            const allowed = canViewPage(sec.page, effectivePermsUser);
                            return (
                              <div
                                key={sec.page}
                                className={clsx(
                                  "flex items-center gap-1.5 px-2 py-1 rounded text-[11px]",
                                  allowed
                                    ? "text-accentSuccess bg-accentSuccess/10 font-medium"
                                    : "text-text-faint bg-field line-through opacity-60",
                                )}
                              >
                                <AppIcon name={allowed ? "check" : "x"} size="xs" />
                                <span>{sec.name}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="border-t border-border-soft pt-3 flex items-center justify-between gap-2 mt-auto">
              <Button
                size="sm"
                variant="ghost"
                type="button"
                onClick={handleResetPermissionsToRole}
                title="Сбросить все переопределения к стандартным правам роли"
              >
                Сбросить к роли
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  type="button"
                  onClick={() => setEditingPermsUser(null)}
                >
                  Отмена
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  type="button"
                  loading={savingPerms}
                  onClick={handleSavePermissions}
                >
                  Сохранить права
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </DialogBackdrop>
      </Dialog>
    </Card>
  );
}

function SettingsPage({
  authUser = null,
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
  const [activeTab, setActiveTab] = useState(initialTab);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [integrationDiagnosticsRunning, setIntegrationDiagnosticsRunning] = useState(false);

  const settingsTabs = [
    {id: "interface", label: "Интерфейс", mobileLabel: "UI", icon: "sliders"},
    {id: "access", label: "Доступы", mobileLabel: "Доступ", icon: "shield"},
    {id: "notifications", label: "Уведомления", mobileLabel: "Уведом.", icon: "bell"},
    {id: "calendar", label: "Календарь", mobileLabel: "Календ.", icon: "calendar"},
    {id: "integrations", label: "Интеграции", mobileLabel: "Интегр.", icon: "link"},
    {id: "data", label: "Данные", mobileLabel: "Данные", icon: "database"},
  ];

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
