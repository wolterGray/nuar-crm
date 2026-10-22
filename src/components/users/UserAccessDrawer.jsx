import {useCallback, useEffect, useMemo, useState} from "react";
import {createPortal} from "react-dom";
import clsx from "clsx";
import AppIcon from "../ui/AppIcon.jsx";
import {Button, IconButton, Input, Select, Switch, Badge} from "../ui/index.js";
import {useModalScrollLock} from "../../hooks/useModalScrollLock.js";
import {
  PERMISSIONS,
  ROLE_DEFAULT_PERMISSIONS,
  canViewPage,
  getAllowedMobileNav,
  getAllowedNavigation,
} from "../../utils/permissions.js";
import {navGroups} from "../../constants/navigation.js";
import {validatePasswordStrength} from "../../utils/passwordStrength.js";
import {
  USER_ROLE_OPTIONS,
  ROLE_BADGE_VARIANTS,
  ROLE_LABELS,
} from "../../constants/userRoles.js";

function getPortalRoot() {
  if (typeof document === "undefined") return null;
  return document.querySelector(".crm-shell") ?? document.body;
}

/* ==========================================================================
   PANE 1: Edit User Profile Pane
   ========================================================================== */
function UserEditPane({
  user,
  allowedRoleOptions,
  employees,
  isOwner,
  submitting,
  onSubmit,
  onClose,
  setIsDirty,
}) {
  const [name, setName] = useState(user?.name || "");
  const [role, setRole] = useState(user?.role || "staff");
  const [employeeId, setEmployeeId] = useState(
    user?.employeeId ? String(user.employeeId) : "",
  );

  const isOwnerProtected = !isOwner && user?.role === "owner";

  // Snapshot to detect unsaved changes
  const initialSnapshot = useMemo(
    () => ({
      name: (user?.name || "").trim(),
      role: user?.role || "staff",
      employeeId: user?.employeeId ? String(user.employeeId) : "",
    }),
    [user],
  );

  const dirty = useMemo(() => {
    return (
      name.trim() !== initialSnapshot.name ||
      role !== initialSnapshot.role ||
      employeeId !== initialSnapshot.employeeId
    );
  }, [name, role, employeeId, initialSnapshot]);

  useEffect(() => {
    setIsDirty(dirty);
  }, [dirty, setIsDirty]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (submitting) return;
    onSubmit(user, {
      name: name.trim(),
      role: isOwnerProtected ? user.role : role,
      employeeId: employeeId ? Number(employeeId) : null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="crm-drawer-pane-form">
      <div className="crm-drawer-body">
        {/* Account Info Card */}
        <div className="p-3 bg-surface-2/60 rounded-control border border-border-soft flex items-center justify-between gap-3">
          <div className="flex flex-col min-w-0">
            <span className="text-[11px] font-bold text-text-faint uppercase tracking-wider">
              Учётная запись
            </span>
            <span className="text-xs font-semibold text-text-main truncate mt-0.5">
              {user.email}
            </span>
          </div>
          <Badge variant={user.isActive ? "success" : "disabled"} size="sm">
            {user.isActive ? "Активен" : "Отключён"}
          </Badge>
        </div>

        {/* Name */}
        <label className="flex flex-col gap-1.5 text-text-muted text-xs font-medium">
          <span>
            Имя сотрудника <span className="text-accent">*</span>
          </span>
          <Input
            autoComplete="name"
            placeholder="Например: Анна Смирнова"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        {/* Role */}
        <label className="flex flex-col gap-1.5 text-text-muted text-xs font-medium">
          <span>Роль в CRM</span>
          <Select
            value={role}
            disabled={isOwnerProtected}
            onChange={(e) => setRole(e.target.value)}
          >
            {(isOwnerProtected ? USER_ROLE_OPTIONS : allowedRoleOptions).map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
          {isOwnerProtected && (
            <span className="text-[11px] text-accentWarning">
              Роль владельца защищена от изменения администратором
            </span>
          )}
        </label>

        {/* Master Binding */}
        <label className="flex flex-col gap-1.5 text-text-muted text-xs font-medium">
          <span>Привязка к профилю мастера</span>
          <Select
            value={employeeId}
            disabled={isOwnerProtected}
            onChange={(e) => setEmployeeId(e.target.value)}
          >
            <option value="">— Без привязки к мастеру —</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name} {emp.role ? `(${emp.role})` : ""}
              </option>
            ))}
          </Select>
          <span className="text-[11px] text-text-faint leading-normal">
            Связывает учётную запись пользователя с расписанием и визитами мастера в календаре.
          </span>
        </label>

        {/* Status Notice */}
        {!user.isActive && (
          <div className="rounded-control border border-accentWarning/30 bg-accentWarning/10 p-3 text-xs text-text-main flex items-start gap-2.5">
            <AppIcon name="alertTriangle" size="sm" className="text-accentWarning shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              Пользователь сейчас отключён и не имеет доступа к CRM. Для разблокировки используйте пункт «Включить доступ» в меню действий.
            </div>
          </div>
        )}
      </div>

      {/* Fixed Footer */}
      <div className="crm-drawer-footer">
        <Button
          size="md"
          variant="secondary"
          type="button"
          disabled={submitting}
          onClick={onClose}
        >
          Отмена
        </Button>
        <Button
          size="md"
          variant="primary"
          type="submit"
          loading={submitting}
          leftIcon={<AppIcon name="check" size="sm" />}
        >
          Сохранить изменения
        </Button>
      </div>
    </form>
  );
}

/* ==========================================================================
   PANE 2: Permissions Matrix Pane (RBAC)
   ========================================================================== */
function UserPermissionsPane({
  user,
  permissionGroups,
  submitting,
  onSubmit,
  onClose,
  setIsDirty,
  pushNotification,
}) {
  const [modalTab, setModalTab] = useState("permissions"); // "permissions" | "preview"
  const [permsDraft, setPermsDraft] = useState(() => ({...(user?.permissions || {})}));
  const [collapsedGroups, setCollapsedGroups] = useState({});

  const initialPermsStr = useMemo(
    () => JSON.stringify(user?.permissions || {}),
    [user],
  );

  const dirty = useMemo(() => {
    return JSON.stringify(permsDraft) !== initialPermsStr;
  }, [permsDraft, initialPermsStr]);

  useEffect(() => {
    setIsDirty(dirty);
  }, [dirty, setIsDirty]);

  const handleTogglePermission = (key, currentVal) => {
    setPermsDraft((prev) => ({
      ...prev,
      [key]: !currentVal,
    }));
  };

  const handleApplyRoleTemplate = (roleKey) => {
    const templatePerms = ROLE_DEFAULT_PERMISSIONS[roleKey];
    if (!templatePerms) return;
    setPermsDraft({...templatePerms});
    pushNotification?.({
      title: "Шаблон применён",
      message: `Загружены настройки прав для роли «${ROLE_LABELS[roleKey] || roleKey}»`,
      persist: false,
    });
  };

  const handleResetPermissionsToRole = () => {
    setPermsDraft({});
  };

  const handleToggleSection = (group) => {
    const roleDefaults =
      ROLE_DEFAULT_PERMISSIONS[user.role] || ROLE_DEFAULT_PERMISSIONS.staff;
    const allEnabled = group.permissions.every((perm) => {
      const val =
        permsDraft[perm.key] !== undefined
          ? permsDraft[perm.key]
          : roleDefaults[perm.key];
      return Boolean(val);
    });

    const targetVal = !allEnabled;
    setPermsDraft((prev) => {
      const next = {...prev};
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
    const roleDefaults =
      ROLE_DEFAULT_PERMISSIONS[user.role] || ROLE_DEFAULT_PERMISSIONS.staff;
    const effectivePermissions = {...roleDefaults, ...permsDraft};
    return {
      ...user,
      effectivePermissions,
      permissions: permsDraft,
    };
  }, [user, permsDraft]);

  const summaryItems = useMemo(() => {
    const p = effectivePermsUser.effectivePermissions || {};
    const items = [];

    // Calendar
    if (p[PERMISSIONS.CALENDAR_VIEW_ALL]) {
      items.push({
        label: "Календарь",
        value: "Все мастера и смены",
        variant: "success",
        icon: "calendarDays",
      });
    } else if (p[PERMISSIONS.CALENDAR_VIEW_ASSIGNED]) {
      items.push({
        label: "Календарь",
        value: "Только свои записи",
        variant: "warning",
        icon: "userCheck",
      });
    } else {
      items.push({
        label: "Календарь",
        value: "Доступ закрыт",
        variant: "danger",
        icon: "calendarOff",
      });
    }

    // Contacts
    if (p[PERMISSIONS.CLIENTS_VIEW_CONTACTS]) {
      items.push({
        label: "Контакты",
        value: "Открыты",
        variant: "info",
        icon: "phone",
      });
    } else {
      items.push({
        label: "Контакты",
        value: "Скрыты",
        variant: "warning",
        icon: "phoneOff",
      });
    }

    // Finance
    if (p[PERMISSIONS.FINANCE_VIEW_SALON_STATS]) {
      items.push({
        label: "Финансы",
        value: "Касса салона",
        variant: "neutral",
        icon: "coins",
      });
    } else if (p[PERMISSIONS.PAYOUTS_VIEW_OWN]) {
      items.push({
        label: "Финансы",
        value: "Свои начисления",
        variant: "neutral",
        icon: "receipt",
      });
    } else {
      items.push({
        label: "Финансы",
        value: "Скрыты",
        variant: "danger",
        icon: "walletCards",
      });
    }

    // Catalog
    if (p[PERMISSIONS.CATALOG_MANAGE]) {
      items.push({
        label: "Каталог",
        value: "Редактирование",
        variant: "info",
        icon: "briefcase",
      });
    } else if (p[PERMISSIONS.CATALOG_VIEW]) {
      items.push({
        label: "Каталог",
        value: "Просмотр",
        variant: "neutral",
        icon: "eye",
      });
    } else {
      items.push({
        label: "Каталог",
        value: "Скрыт",
        variant: "disabled",
        icon: "briefcase",
      });
    }

    // Security
    if (p[PERMISSIONS.USERS_MANAGE]) {
      items.push({
        label: "Безопасность",
        value: "Управление доступом",
        variant: "warning",
        icon: "shield",
      });
    }

    return items;
  }, [effectivePermsUser]);

  const previewAllowedGroups = useMemo(() => {
    return getAllowedNavigation(navGroups, effectivePermsUser);
  }, [effectivePermsUser]);

  const previewAllowedMobile = useMemo(() => {
    return getAllowedMobileNav(effectivePermsUser);
  }, [effectivePermsUser]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (submitting) return;
    onSubmit(user, permsDraft);
  };

  return (
    <form onSubmit={handleSubmit} className="crm-drawer-pane-form">
      <div className="crm-drawer-body">
        {/* Sub-tab Navigation */}
        <div className="flex items-center gap-2 p-1 bg-surface-2 rounded-control border border-border-soft">
          <button
            type="button"
            onClick={() => setModalTab("permissions")}
            className={clsx(
              "flex-1 py-1.5 px-3 rounded-control text-xs font-semibold transition-colors flex items-center justify-center gap-1.5",
              modalTab === "permissions"
                ? "bg-accent text-white shadow-sm"
                : "text-text-muted hover:text-text-main hover:bg-surface/50",
            )}
          >
            <AppIcon name="shield" size="xs" />
            <span>Настройки прав</span>
          </button>
          <button
            type="button"
            onClick={() => setModalTab("preview")}
            className={clsx(
              "flex-1 py-1.5 px-3 rounded-control text-xs font-semibold transition-colors flex items-center justify-center gap-1.5",
              modalTab === "preview"
                ? "bg-accent text-white shadow-sm"
                : "text-text-muted hover:text-text-main hover:bg-surface/50",
            )}
          >
            <AppIcon name="eye" size="xs" />
            <span>Предпросмотр ({previewAllowedGroups.length})</span>
          </button>
        </div>

        {modalTab === "permissions" ? (
          <>
            {/* Quick Role Templates */}
            <div className="flex flex-col gap-2 p-3 rounded-control bg-surface-2/60 border border-border-soft">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs text-text-muted">
                  <AppIcon name="sparkles" size="xs" className="text-accent" />
                  <span className="font-semibold text-text-main">Шаблоны ролей:</span>
                </div>
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
                  title="Все операции кроме управления владельцами"
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
              </div>
            </div>

            {/* Effective Access Summary */}
            <div className="flex flex-col gap-2 p-3 rounded-control bg-field border border-border-soft">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-text-faint uppercase tracking-wider">
                  Итоговый профиль доступа
                </span>
                <span className="text-[11px] text-text-muted">
                  {Object.keys(permsDraft).length > 0 ? (
                    <span className="text-accent font-medium">
                      {Object.keys(permsDraft).length} переопределений
                    </span>
                  ) : (
                    "Права по умолчанию"
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

            {/* Grouped Permissions Matrix */}
            <div className="flex flex-col gap-2.5">
              {permissionGroups.map((group) => {
                const roleDefaults =
                  ROLE_DEFAULT_PERMISSIONS[user?.role] || ROLE_DEFAULT_PERMISSIONS.staff;
                const activeCount = group.permissions.filter((perm) => {
                  const val =
                    permsDraft[perm.key] !== undefined
                      ? permsDraft[perm.key]
                      : roleDefaults[perm.key];
                  return Boolean(val);
                }).length;
                const allEnabled = activeCount === group.permissions.length;
                const isCollapsed = Boolean(collapsedGroups[group.id]);

                return (
                  <div
                    key={group.id}
                    className="rounded-control border border-border-soft bg-surface-2/40 overflow-hidden flex flex-col"
                  >
                    {/* Level 1: Group Header */}
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
                            Включено: {activeCount} из {group.permissions.length}
                          </span>
                        </div>
                      </button>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] text-text-muted hidden sm:inline">
                          {allEnabled
                            ? "Все"
                            : activeCount === 0
                              ? "Выкл"
                              : "Частично"}
                        </span>
                        <Switch
                          checked={allEnabled}
                          onChange={() => handleToggleSection(group)}
                          aria-label={`Переключить раздел ${group.title}`}
                        />
                      </div>
                    </div>

                    {/* Level 2: Detailed Permissions */}
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
                                  <span className="text-xs font-semibold text-text-main">
                                    {perm.label}
                                  </span>
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
                                  onChange={() =>
                                    handleTogglePermission(perm.key, isChecked)
                                  }
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
          /* Preview Tab */
          <div className="flex flex-col gap-4">
            <div className="rounded-control border border-border-soft bg-surface-2/40 p-3 flex items-center gap-2.5 text-xs text-text-muted">
              <AppIcon name="info" size="sm" className="text-accent shrink-0" />
              <div>
                Предпросмотр интерфейса с текущими правами сотрудника без необходимости перезахода.
              </div>
            </div>

            <div className="flex flex-col gap-3.5">
              {/* Desktop Navigation Preview */}
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
                            <span className="text-[10px] text-text-faint font-mono">
                              /{item.page}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mobile Navigation Preview */}
              <div className="flex flex-col gap-3 rounded-control bg-field p-3.5 border border-border-soft">
                <div className="flex items-center gap-2 text-xs font-bold text-text-main border-b border-border-soft pb-2">
                  <AppIcon name="smartphone" size="xs" className="text-text-muted" />
                  <span>Нижняя мобильная панель ({previewAllowedMobile.length} кнопок)</span>
                </div>
                <div className="p-3 bg-surface rounded-control border border-border flex items-center justify-between gap-1 shadow-sm">
                  {previewAllowedMobile.map((item) => (
                    <div
                      key={item.page}
                      className="flex flex-col items-center gap-1 text-center flex-1"
                    >
                      <div className="w-8 h-8 rounded-full bg-field border border-border-soft flex items-center justify-center text-accent">
                        <AppIcon name={item.icon} size="xs" />
                      </div>
                      <span className="text-[10px] font-medium text-text-main leading-none truncate max-w-[54px]">
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>

                {/* CRM Key Pages Matrix */}
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

      {/* Fixed Footer */}
      <div className="crm-drawer-footer justify-between">
        <Button
          size="md"
          variant="ghost"
          type="button"
          onClick={handleResetPermissionsToRole}
          title="Сбросить все индивидуальные переопределения к роли пользователя"
        >
          Сбросить к роли
        </Button>
        <div className="flex items-center gap-2">
          <Button
            size="md"
            variant="secondary"
            type="button"
            disabled={submitting}
            onClick={onClose}
          >
            Отмена
          </Button>
          <Button
            size="md"
            variant="primary"
            type="submit"
            loading={submitting}
            leftIcon={<AppIcon name="shield" size="sm" />}
          >
            Сохранить права
          </Button>
        </div>
      </div>
    </form>
  );
}

/* ==========================================================================
   PANE 3: Reset Password Pane
   ========================================================================== */
function UserResetPasswordPane({
  user,
  smtpConfigured,
  submitting,
  onSubmit,
  onClose,
  setIsDirty,
}) {
  const [method, setMethod] = useState("email"); // "email" | "generate_temp" | "manual_temp"
  const [manualPassword, setManualPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showManualPassword, setShowManualPassword] = useState(false);

  const passwordStrength = useMemo(
    () => validatePasswordStrength(manualPassword, {email: user?.email}),
    [manualPassword, user?.email],
  );

  const passwordsMatch = manualPassword === confirmPassword;
  const canSubmit =
    method === "email" ||
    method === "generate_temp" ||
    (method === "manual_temp" &&
      manualPassword &&
      passwordsMatch &&
      passwordStrength.isValid);

  const dirty = useMemo(() => {
    return method !== "email" || Boolean(manualPassword);
  }, [method, manualPassword]);

  useEffect(() => {
    setIsDirty(dirty);
  }, [dirty, setIsDirty]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!canSubmit || submitting) return;

    if (method === "email") {
      onSubmit(user, {deliveryMethod: "email"});
    } else if (method === "generate_temp") {
      onSubmit(user, {deliveryMethod: "generate_temp"});
    } else if (method === "manual_temp") {
      onSubmit(user, {
        deliveryMethod: "manual_temp",
        manualPassword,
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="crm-drawer-pane-form">
      <div className="crm-drawer-body">
        {/* Session Invalidation Notice */}
        <div className="rounded-control border border-border-soft bg-field p-3 text-xs text-text-muted flex items-start gap-2.5">
          <AppIcon name="shield" size="sm" className="text-accent shrink-0 mt-0.5" />
          <span className="leading-relaxed">
            При сбросе пароля все ранее выданные активные сессии сотрудника на всех устройствах будут немедленно завершены.
          </span>
        </div>

        {/* 3 Delivery Options */}
        <div className="delivery-options-grid">
          {/* Option A: Email */}
          <div
            className={clsx(
              "delivery-option-card",
              method === "email" && "is-selected",
            )}
            onClick={() => setMethod("email")}
          >
            <div className="delivery-option-radio">
              {method === "email" && <div className="delivery-option-radio-dot" />}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-bold text-text-main">
                Отправить ссылку на email
              </span>
              <p className="m-0 mt-0.5 text-[11px] text-text-muted leading-tight">
                {smtpConfigured
                  ? `Ссылка для установки нового пароля придёт на ${user.email}.`
                  : "Почта не настроена — ссылка будет сгенерирована для передачи в мессенджер."}
              </p>
            </div>
          </div>

          {/* Option B: Generate temp */}
          <div
            className={clsx(
              "delivery-option-card",
              method === "generate_temp" && "is-selected",
            )}
            onClick={() => setMethod("generate_temp")}
          >
            <div className="delivery-option-radio">
              {method === "generate_temp" && (
                <div className="delivery-option-radio-dot" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-bold text-text-main">
                Сгенерировать временный пароль
              </span>
              <p className="m-0 mt-0.5 text-[11px] text-text-muted leading-tight">
                Сервер создаст надёжный пароль и отобразит его в защищённом окне для копирования.
              </p>
            </div>
          </div>

          {/* Option C: Manual temp */}
          <div
            className={clsx(
              "delivery-option-card",
              method === "manual_temp" && "is-selected",
            )}
            onClick={() => setMethod("manual_temp")}
          >
            <div className="delivery-option-radio">
              {method === "manual_temp" && (
                <div className="delivery-option-radio-dot" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-bold text-text-main">
                Задать временный пароль вручную
              </span>
              <p className="m-0 mt-0.5 text-[11px] text-text-muted leading-tight">
                Вы сами задаёте пароль с валидацией сложности по стандартам безопасности.
              </p>
            </div>
          </div>
        </div>

        {/* Manual Password Input Block */}
        {method === "manual_temp" && (
          <div className="p-3 bg-surface-2 rounded-control border border-border flex flex-col gap-3">
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5 text-text-muted text-xs font-medium">
                <span>Новый временный пароль</span>
                <div className="relative flex items-center">
                  <Input
                    type={showManualPassword ? "text" : "password"}
                    value={manualPassword}
                    autoComplete="new-password"
                    placeholder="Минимум 12 символов"
                    onChange={(e) => setManualPassword(e.target.value)}
                    className="pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowManualPassword((v) => !v)}
                    className="absolute right-2 text-text-muted hover:text-text-main bg-transparent border-0 cursor-pointer p-1"
                    tabIndex="-1"
                  >
                    <AppIcon
                      name={showManualPassword ? "eyeOff" : "eye"}
                      size="xs"
                    />
                  </button>
                </div>
              </label>

              <label className="flex flex-col gap-1.5 text-text-muted text-xs font-medium">
                <span>Подтверждение пароля</span>
                <Input
                  type={showManualPassword ? "text" : "password"}
                  value={confirmPassword}
                  autoComplete="new-password"
                  placeholder="Повторите пароль"
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </label>
            </div>

            {manualPassword && !passwordsMatch && (
              <span className="text-[11px] text-accentError">
                Пароли не совпадают
              </span>
            )}

            {manualPassword && passwordStrength.failures.length > 0 && (
              <div className="text-[11px] text-accentError flex flex-col gap-0.5">
                {passwordStrength.failures.map((f, i) => (
                  <span key={i}>• {f}</span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Fixed Footer */}
      <div className="crm-drawer-footer">
        <Button
          size="md"
          variant="secondary"
          type="button"
          disabled={submitting}
          onClick={onClose}
        >
          Отмена
        </Button>
        <Button
          size="md"
          variant="primary"
          type="submit"
          disabled={!canSubmit || submitting}
          loading={submitting}
          leftIcon={<AppIcon name="key" size="sm" />}
        >
          Сбросить пароль
        </Button>
      </div>
    </form>
  );
}

/* ==========================================================================
   MAIN COMPONENT: UserAccessDrawer
   ========================================================================== */
export default function UserAccessDrawer({
  activeDrawer, // { type: 'edit' | 'permissions' | 'reset-password', userId } | null
  user,
  onClose,
  allowedRoleOptions,
  employees,
  permissionGroups,
  smtpConfigured,
  isOwner,
  submitting,
  onSaveEdit,
  onSavePermissions,
  onResetPassword,
  pushNotification,
}) {
  const isOpen = Boolean(activeDrawer && user);
  useModalScrollLock(isOpen);
  const [isDirty, setIsDirty] = useState(false);

  // Safe close handler that checks for unsaved changes
  const handleSafeClose = useCallback(() => {
    if (isDirty) {
      const ok = window.confirm(
        "У вас есть несохранённые изменения. Закрыть без сохранения?",
      );
      if (!ok) return;
    }
    onClose();
  }, [isDirty, onClose]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        handleSafeClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleSafeClose]);

  if (!isOpen || !user) return null;

  const mode = activeDrawer.type; // "edit" | "permissions" | "reset-password"

  // Title, subtitle and icon config
  const titleConfig = {
    edit: {
      title: "Редактирование пользователя",
      icon: "pencil",
    },
    permissions: {
      title: "Права доступа",
      icon: "shield",
    },
    "reset-password": {
      title: "Сброс пароля",
      icon: "key",
    },
  }[mode] || {
    title: "Управление доступом",
    icon: "shield",
  };

  const portalRoot = getPortalRoot();
  if (!portalRoot) return null;

  const drawerContent = (
    <div
      className="crm-drawer-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleSafeClose();
        }
      }}
    >
      <aside
        className="crm-drawer-root"
        role="dialog"
        aria-modal="true"
        aria-label={titleConfig.title}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. FIXED HEADER */}
        <div className="crm-drawer-header">
          <div className="crm-drawer-title-wrap">
            <div className="w-9 h-9 rounded-control bg-accent/15 border border-accent/30 flex items-center justify-center shrink-0 text-accent">
              <AppIcon name={titleConfig.icon} size="md" />
            </div>
            <div className="min-w-0">
              <h2 className="crm-drawer-title">{titleConfig.title}</h2>
              <div className="crm-drawer-subtitle">
                <span className="font-semibold text-text-main truncate">
                  {user.name || user.email}
                </span>
                <span className="text-text-faint">•</span>
                <Badge
                  variant={ROLE_BADGE_VARIANTS[user.role] || "neutral"}
                  size="sm"
                >
                  {ROLE_LABELS[user.role] || user.role}
                </Badge>
              </div>
            </div>
          </div>
          <IconButton
            icon="x"
            label="Закрыть панель"
            size="sm"
            variant="ghost"
            onClick={handleSafeClose}
          />
        </div>

        {/* 2. PANE CONTENT (includes scrollable body + fixed footer) */}
        {mode === "edit" && (
          <UserEditPane
            key={`edit-${user.id}`}
            user={user}
            allowedRoleOptions={allowedRoleOptions}
            employees={employees}
            isOwner={isOwner}
            submitting={submitting}
            onSubmit={onSaveEdit}
            onClose={handleSafeClose}
            setIsDirty={setIsDirty}
          />
        )}

        {mode === "permissions" && (
          <UserPermissionsPane
            key={`perms-${user.id}`}
            user={user}
            permissionGroups={permissionGroups}
            submitting={submitting}
            onSubmit={onSavePermissions}
            onClose={handleSafeClose}
            setIsDirty={setIsDirty}
            pushNotification={pushNotification}
          />
        )}

        {mode === "reset-password" && (
          <UserResetPasswordPane
            key={`reset-${user.id}`}
            user={user}
            smtpConfigured={smtpConfigured}
            submitting={submitting}
            onSubmit={onResetPassword}
            onClose={handleSafeClose}
            setIsDirty={setIsDirty}
          />
        )}
      </aside>
    </div>
  );

  return createPortal(drawerContent, portalRoot);
}
