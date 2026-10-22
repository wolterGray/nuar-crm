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
import {
  generateStrongPassword,
  validatePasswordStrength,
} from "../../utils/passwordStrength.js";
import {
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
  onSwitchMode,
  setIsDirty,
}) {
  const [email, setEmail] = useState(user?.email || "");
  const [name, setName] = useState(user?.name || "");
  const [role, setRole] = useState(user?.role || "staff");
  const [employeeId, setEmployeeId] = useState(
    user?.employeeId ? String(user.employeeId) : "",
  );

  const isOwnerProtected = !isOwner && user?.role === "owner";

  const initialSnapshot = useMemo(
    () => ({
      email: (user?.email || "").trim().toLowerCase(),
      name: (user?.name || "").trim(),
      role: user?.role || "staff",
      employeeId: user?.employeeId ? String(user.employeeId) : "",
    }),
    [user],
  );

  const dirty = useMemo(() => {
    return (
      email.trim().toLowerCase() !== initialSnapshot.email ||
      name.trim() !== initialSnapshot.name ||
      role !== initialSnapshot.role ||
      employeeId !== initialSnapshot.employeeId
    );
  }, [email, name, role, employeeId, initialSnapshot]);

  useEffect(() => {
    setIsDirty(dirty);
  }, [dirty, setIsDirty]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (submitting) return;
    onSubmit(user, {
      email: email.trim().toLowerCase() || user.email,
      name: name.trim(),
      role: isOwnerProtected ? user.role : role,
      employeeId: employeeId ? Number(employeeId) : null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="crm-drawer-pane-form">
      <div className="crm-drawer-body">
        {/* Account Status Card */}
        <div className="p-3 bg-surface-2/60 rounded-control border border-border-soft flex items-center justify-between gap-3">
          <div className="flex flex-col min-w-0">
            <span className="text-[11px] font-bold text-text-faint uppercase tracking-wider">
              Статус учётной записи
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
          <span>Имя сотрудника</span>
          <Input
            autoComplete="off"
            placeholder="Например, Натали"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        {/* Email */}
        <label className="flex flex-col gap-1.5 text-text-muted text-xs font-medium">
          <span>Email для входа в CRM</span>
          <Input
            autoComplete="off"
            type="email"
            required
            placeholder="master@nuarr.pl"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        {/* Role */}
        <label className="flex flex-col gap-1.5 text-text-muted text-xs font-medium">
          <span>Роль в CRM</span>
          <Select
            disabled={isOwnerProtected}
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            {allowedRoleOptions.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
          <span className="text-[11px] text-text-faint leading-relaxed">
            Определяет базовый шаблон прав доступа сотрудника.
          </span>
        </label>

        {/* Master Binding */}
        <label className="flex flex-col gap-1.5 text-text-muted text-xs font-medium">
          <span>Привязка к мастеру в расписании</span>
          <Select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
          >
            <option value="">— Без привязки к мастеру —</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name} {emp.role ? `(${emp.role})` : ""}
              </option>
            ))}
          </Select>
          <span className="text-[11px] text-text-faint leading-relaxed">
            Позволяет сотруднику с ролью «Сотрудник» видеть свои записи и собственные начисления.
          </span>
        </label>

        {/* Inline Save Actions right under fields so they are immediately visible */}
        <div className="pt-2 flex items-center gap-2.5">
          <Button
            size="md"
            variant="primary"
            type="submit"
            loading={submitting}
            className="flex-1"
            leftIcon={<AppIcon name="check" size="sm" />}
          >
            Сохранить изменения
          </Button>
          <Button
            size="md"
            variant="secondary"
            type="button"
            disabled={submitting}
            onClick={onClose}
          >
            Отмена
          </Button>
        </div>

        {/* Quick transition to Password or Permissions */}
        <div className="pt-3 border-t border-border-soft flex flex-col gap-2">
          <span className="text-[11px] font-bold text-text-faint uppercase tracking-wider">
            Быстрые действия
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button
              size="sm"
              variant="secondary"
              type="button"
              leftIcon={<AppIcon name="key" size="xs" />}
              onClick={() => onSwitchMode?.("reset-password")}
            >
              Задать / сбросить пароль
            </Button>
            <Button
              size="sm"
              variant="secondary"
              type="button"
              leftIcon={<AppIcon name="shield" size="xs" />}
              onClick={() => onSwitchMode?.("permissions")}
            >
              Настроить права доступа
            </Button>
          </div>
        </div>

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
        variant: "danger",
        icon: "eyeOff",
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

  const customOverrideCount = Object.keys(permsDraft).filter(
    (k) => k !== "mustChangePassword",
  ).length;

  return (
    <form onSubmit={handleSubmit} className="crm-drawer-pane-form">
      {/* Sub-navigation bar for Permissions vs Navigation Preview */}
      <div className="px-5 py-2.5 bg-surface-2/60 border-b border-border-soft flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant={modalTab === "permissions" ? "primary" : "ghost"}
            type="button"
            onClick={() => setModalTab("permissions")}
            leftIcon={<AppIcon name="shield" size="xs" />}
          >
            Настройки прав
          </Button>
          <Button
            size="sm"
            variant={modalTab === "preview" ? "primary" : "ghost"}
            type="button"
            onClick={() => setModalTab("preview")}
            leftIcon={<AppIcon name="eye" size="xs" />}
          >
            Предпросмотр ({previewAllowedGroups.length})
          </Button>
        </div>

        <Button
          size="sm"
          variant="primary"
          type="submit"
          loading={submitting}
          leftIcon={<AppIcon name="check" size="xs" />}
        >
          Сохранить
        </Button>
      </div>

      <div className="crm-drawer-body">
        {modalTab === "permissions" ? (
          <>
            {/* Quick Role Templates */}
            <div className="flex flex-col gap-2 p-3 rounded-control bg-surface-2/60 border border-border-soft">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs text-text-muted">
                  <AppIcon name="sparkles" size="xs" className="text-accent" />
                  <span className="font-semibold text-text-main">Быстрые шаблоны:</span>
                </div>
                {customOverrideCount > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    type="button"
                    onClick={handleResetPermissionsToRole}
                    title="Сбросить все индивидуальные переопределения к роли пользователя"
                  >
                    Сбросить к роли
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={() => handleApplyRoleTemplate("owner")}
                >
                  Владелец
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={() => handleApplyRoleTemplate("admin")}
                >
                  Админ
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={() => handleApplyRoleTemplate("staff")}
                >
                  Массажист
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={() => handleApplyRoleTemplate("readonly")}
                >
                  Только чтение
                </Button>
              </div>
            </div>

            {/* Access Summary Card */}
            <div className="flex flex-col gap-2 p-3 rounded-control bg-field border border-border-soft">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-text-faint uppercase tracking-wider">
                  Итоговый профиль доступа
                </span>
                <span className="text-[11px] text-text-muted">
                  {customOverrideCount > 0 ? (
                    <span className="text-accent font-medium">
                      Изменено вручную: {customOverrideCount}
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

            {/* 2-Level Permission Groups */}
            <div className="flex flex-col gap-3">
              {permissionGroups.map((group) => {
                const roleDefaults =
                  ROLE_DEFAULT_PERMISSIONS[user.role] ||
                  ROLE_DEFAULT_PERMISSIONS.staff;
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
                        className="flex items-center gap-2 text-left flex-1 bg-transparent border-0 p-0 cursor-pointer hover:opacity-85 transition-opacity"
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
                          {allEnabled
                            ? "Все включены"
                            : activeCount === 0
                              ? "Отключено"
                              : "Частично"}
                        </span>
                        <Switch
                          checked={allEnabled}
                          onChange={() => handleToggleSection(group)}
                          aria-label={`Переключить весь раздел ${group.title}`}
                        />
                      </div>
                    </div>

                    {/* Level 2: Individual Permissions */}
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
                              <div className="flex flex-col gap-0.5 min-w-0">
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
          /* Live Navigation Preview */
          <div className="flex flex-col gap-4">
            <div className="rounded-control border border-border-soft bg-surface-2/40 p-3 flex items-center gap-2.5 text-xs text-text-muted">
              <AppIcon name="info" size="sm" className="text-accent shrink-0" />
              <div>
                Предпросмотр показывает, какие разделы меню будут видны сотруднику с текущими настройками прав.
              </div>
            </div>

            <div className="flex flex-col gap-3.5">
              {/* Desktop Menu Preview */}
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

              {/* Mobile Nav Preview */}
              <div className="flex flex-col gap-3 rounded-control bg-field p-3.5 border border-border-soft">
                <div className="flex items-center gap-2 text-xs font-bold text-text-main border-b border-border-soft pb-2">
                  <AppIcon name="smartphone" size="xs" className="text-text-muted" />
                  <span>Мобильная панель ({previewAllowedMobile.length} кнопок)</span>
                </div>
                <div className="p-3 bg-surface rounded-control border border-border flex items-center justify-between gap-1">
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
            leftIcon={<AppIcon name="check" size="sm" />}
          >
            Сохранить права
          </Button>
        </div>
      </div>
    </form>
  );
}

/* ==========================================================================
   PANE 3: Password Management Pane (Direct Generation / Input + Save)
   ========================================================================== */
function UserResetPasswordPane({
  user,
  smtpConfigured,
  submitting,
  onSubmit,
  onClose,
  setIsDirty,
  pushNotification,
}) {
  const [password, setPassword] = useState(() =>
    generateStrongPassword({email: user?.email || ""}),
  );
  const [showPassword, setShowPassword] = useState(true);
  const [copied, setCopied] = useState(false);

  const passwordStrength = useMemo(
    () => validatePasswordStrength(password, {email: user?.email}),
    [password, user?.email],
  );

  const canSubmit = Boolean(password.trim() && passwordStrength.isValid);

  useEffect(() => {
    setIsDirty(false);
  }, [setIsDirty]);

  const handleGenerateNew = () => {
    const next = generateStrongPassword({email: user?.email || ""});
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
        title: "Пароль скопирован в буфер",
        message: "Теперь нажмите «Сохранить пароль», чтобы применить его для сотрудника",
        persist: false,
      });
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      pushNotification?.({
        title: "Пароль",
        message: password,
        persist: false,
      });
    }
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!canSubmit || submitting) return;
    onSubmit(user, {
      method: "manual_temp",
      deliveryMethod: "manual_temp",
      temporaryPassword: password.trim(),
      password: password.trim(),
      email: user?.email,
    });
  };

  const handleCreateResetLink = () => {
    if (submitting) return;
    onSubmit(user, {
      method: "link",
      deliveryMethod: "link",
      email: user?.email,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="crm-drawer-pane-form">
      <div className="crm-drawer-body">
        {/* Main Block: Direct Password Generator & Editor */}
        <div className="p-4 rounded-card bg-surface-2/70 border border-border flex flex-col gap-3.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-text-main">
                Новый пароль сотрудника
              </span>
              <span className="text-[11px] text-text-muted mt-0.5">
                Пароль уже сгенерирован — вы можете скопировать его или ввести свой
              </span>
            </div>
            <Button
              size="sm"
              variant="secondary"
              type="button"
              onClick={handleGenerateNew}
              leftIcon={<AppIcon name="refreshCw" size="xs" />}
            >
              Сгенерировать другой
            </Button>
          </div>

          {/* Password Input + Copy Button */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 flex items-center">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                autoComplete="new-password"
                placeholder="Введите или сгенерируйте пароль"
                onChange={(e) => {
                  setPassword(e.target.value);
                  setCopied(false);
                }}
                className="font-mono font-bold text-sm tracking-wide pr-9"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2.5 text-text-muted hover:text-text-main bg-transparent border-0 cursor-pointer p-1"
                title={showPassword ? "Скрыть пароль" : "Показать пароль"}
              >
                <AppIcon name={showPassword ? "eyeOff" : "eye"} size="xs" />
              </button>
            </div>

            <Button
              size="md"
              variant={copied ? "success" : "secondary"}
              type="button"
              onClick={handleCopyPassword}
              className="shrink-0"
              leftIcon={<AppIcon name={copied ? "check" : "copy"} size="xs" />}
            >
              {copied ? "Скопировано" : "Скопировать"}
            </Button>
          </div>

          {/* Validation Status */}
          {passwordStrength.isValid ? (
            <div className="flex items-center gap-1.5 text-[11.5px] text-accentSuccess font-medium">
              <AppIcon name="check" size="xs" />
              <span>Надёжный пароль — готов к сохранению</span>
            </div>
          ) : (
            <div className="text-[11.5px] text-accentError flex flex-col gap-0.5">
              {passwordStrength.failures.map((f, i) => (
                <span key={i}>• {f}</span>
              ))}
            </div>
          )}

          {/* PROMINENT SAVE BUTTON RIGHT INSIDE THE CARD */}
          <div className="pt-1 flex items-center gap-2.5">
            <Button
              size="md"
              variant="primary"
              type="submit"
              disabled={!canSubmit || submitting}
              loading={submitting}
              className="flex-1"
              leftIcon={<AppIcon name="check" size="sm" />}
            >
              Сохранить пароль
            </Button>
            <Button
              size="md"
              variant="secondary"
              type="button"
              disabled={submitting}
              onClick={onClose}
            >
              Отмена
            </Button>
          </div>
        </div>

        {/* Secondary Option: One-time Reset Link */}
        <div className="p-3.5 rounded-control bg-field border border-border-soft flex flex-col gap-2.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold text-text-main">
                Одноразовая ссылка для самостоятельной смены пароля
              </span>
              <span className="text-[11px] text-text-muted leading-relaxed">
                {smtpConfigured
                  ? `Отправит ссылку на ${user.email} и покажет её для копирования.`
                  : "Создаст одноразовую ссылку, которую можно отправить сотруднику в Telegram или WhatsApp."}
              </span>
            </div>
          </div>
          <div>
            <Button
              size="sm"
              variant="outline"
              type="button"
              disabled={submitting}
              onClick={handleCreateResetLink}
              leftIcon={<AppIcon name="link" size="xs" />}
            >
              Получить ссылку для сброса
            </Button>
          </div>
        </div>

        {/* Security Notice */}
        <div className="rounded-control border border-border-soft bg-field/50 p-3 text-[11.5px] text-text-muted flex items-start gap-2.5">
          <AppIcon name="shield" size="sm" className="text-text-faint shrink-0 mt-0.5" />
          <span className="leading-relaxed">
            После сохранения нового пароля прежние сессии сотрудника на других устройствах будут завершены.
          </span>
        </div>
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
          leftIcon={<AppIcon name="check" size="sm" />}
        >
          Сохранить пароль
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
   onChangeMode,
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

  const handleSafeClose = useCallback(() => {
    if (isDirty) {
      const ok = window.confirm(
        "У вас есть несохранённые изменения. Закрыть без сохранения?",
      );
      if (!ok) return;
    }
    onClose();
  }, [isDirty, onClose]);

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

  if (!isOpen) return null;

  const mode = activeDrawer.type;

  const switchMode = (nextMode) => {
    if (nextMode === mode) return;
    setIsDirty(false);
    if (onChangeMode) {
      onChangeMode(nextMode);
    }
  };

  const titleConfig = {
    edit: {
      title: "Профиль сотрудника",
      icon: "pencil",
    },
    permissions: {
      title: "Права доступа",
      icon: "shield",
    },
    "reset-password": {
      title: "Пароль сотрудника",
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
        <div className="crm-drawer-header flex-col items-stretch gap-3">
          <div className="flex items-center justify-between gap-3">
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

          {/* Mode Tabs so user can switch between Profile, Permissions, and Password effortlessly */}
          <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-border-soft">
            <Button
              size="sm"
              variant={mode === "edit" ? "primary" : "ghost"}
              type="button"
              onClick={() => switchMode("edit")}
              leftIcon={<AppIcon name="pencil" size="xs" />}
            >
              Профиль
            </Button>
            <Button
              size="sm"
              variant={mode === "permissions" ? "primary" : "ghost"}
              type="button"
              onClick={() => switchMode("permissions")}
              leftIcon={<AppIcon name="shield" size="xs" />}
            >
              Права
            </Button>
            <Button
              size="sm"
              variant={mode === "reset-password" ? "primary" : "ghost"}
              type="button"
              onClick={() => switchMode("reset-password")}
              leftIcon={<AppIcon name="key" size="xs" />}
            >
              Пароль
            </Button>
          </div>
        </div>

        {/* 2. PANE CONTENT */}
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
            onSwitchMode={switchMode}
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
            pushNotification={pushNotification}
          />
        )}
      </aside>
    </div>
  );

  return createPortal(drawerContent, portalRoot);
}
