// backend/constants/permissions.js
// Centralized RBAC permissions registry, role defaults, and security helpers.

const PERMISSIONS = {
  // Календарь и записи
  CALENDAR_VIEW_ALL: 'calendar.view_all',
  CALENDAR_VIEW_ASSIGNED: 'calendar.view_assigned',
  CALENDAR_MANAGE_ALL: 'calendar.manage_all',
  CALENDAR_MANAGE_ASSIGNED: 'calendar.manage_assigned',
  CALENDAR_DELETE: 'calendar.delete',

  // Клиенты
  CLIENTS_VIEW: 'clients.view',
  CLIENTS_VIEW_CONTACTS: 'clients.view_contacts',
  CLIENTS_MANAGE: 'clients.manage',
  CLIENTS_DELETE: 'clients.delete',

  // Финансы и касса
  FINANCE_VIEW_SALON_STATS: 'finance.view_salon_stats',
  FINANCE_DAY_CLOSE: 'finance.day_close',
  PAYOUTS_VIEW_ALL: 'payouts.view_all',
  PAYOUTS_VIEW_OWN: 'payouts.view_own',
  PAYOUTS_MANAGE: 'payouts.manage',

  // Каталог и сотрудники
  CATALOG_MANAGE: 'catalog.manage',
  EMPLOYEES_MANAGE: 'employees.manage',
  TASKS_MANAGE: 'tasks.manage',

  // Пользователи и безопасность
  USERS_MANAGE: 'users.manage',
  LOGS_VIEW: 'logs.view',
};

const PERMISSION_GROUPS = [
  {
    id: 'calendar',
    title: 'Календарь и визиты',
    permissions: [
      { key: PERMISSIONS.CALENDAR_VIEW_ALL, label: 'Просмотр записей всех мастеров', description: 'Видеть полный календарь студии' },
      { key: PERMISSIONS.CALENDAR_VIEW_ASSIGNED, label: 'Просмотр только своих записей', description: 'Видеть визиты, где назначен текущий мастер' },
      { key: PERMISSIONS.CALENDAR_MANAGE_ALL, label: 'Управление любыми записями', description: 'Создавать, переносить и завершать любые визиты' },
      { key: PERMISSIONS.CALENDAR_MANAGE_ASSIGNED, label: 'Управление только своими записями', description: 'Завершать и редактировать назначенные на себя визиты' },
      { key: PERMISSIONS.CALENDAR_DELETE, label: 'Удаление и отмена записей', description: 'Отменять или удалять визиты из расписания' },
    ],
  },
  {
    id: 'clients',
    title: 'База клиентов и контакты',
    permissions: [
      { key: PERMISSIONS.CLIENTS_VIEW, label: 'Просмотр карточек клиентов', description: 'Видеть имена, предпочтения, комментарии и историю' },
      { key: PERMISSIONS.CLIENTS_VIEW_CONTACTS, label: 'Просмотр личных контактов', description: 'Видеть номера телефонов, email и telegram (иначе маскируются)' },
      { key: PERMISSIONS.CLIENTS_MANAGE, label: 'Создание и редактирование клиентов', description: 'Добавлять новых клиентов и менять их данные' },
      { key: PERMISSIONS.CLIENTS_DELETE, label: 'Удаление клиентов', description: 'Безвозвратно удалять карточки клиентов' },
    ],
  },
  {
    id: 'finance',
    title: 'Финансы, касса и зарплаты',
    permissions: [
      { key: PERMISSIONS.FINANCE_VIEW_SALON_STATS, label: 'Просмотр выручки и кассы студии', description: 'Видеть дневные закрытия, сводки оборота и пакеты/сертификаты' },
      { key: PERMISSIONS.FINANCE_DAY_CLOSE, label: 'Проведение закрытия смены (Z-отчёт)', description: 'Вносить и подтверждать данные кассовой смены' },
      { key: PERMISSIONS.PAYOUTS_VIEW_ALL, label: 'Просмотр выплат всех сотрудников', description: 'Видеть начисленные комиссии и историю выплат по всем мастерам' },
      { key: PERMISSIONS.PAYOUTS_VIEW_OWN, label: 'Просмотр только своих выплат', description: 'Видеть свои начисленные проценты и личные выплаты' },
      { key: PERMISSIONS.PAYOUTS_MANAGE, label: 'Начисление и подтверждение выплат', description: 'Создавать и отмечать выплаты зарплат' },
    ],
  },
  {
    id: 'management',
    title: 'Каталог, операции и сотрудники',
    permissions: [
      { key: PERMISSIONS.CATALOG_MANAGE, label: 'Управление услугами и прайс-листом', description: 'Редактировать цены, длительности и описания услуг' },
      { key: PERMISSIONS.EMPLOYEES_MANAGE, label: 'Управление мастерами и сменами', description: 'Настраивать график работы, смены и ставки мастеров' },
      { key: PERMISSIONS.TASKS_MANAGE, label: 'Управление задачами и чек-листами', description: 'Создавать, отмечать и закрывать задачи студии' },
    ],
  },
  {
    id: 'security',
    title: 'Безопасность и настройки',
    permissions: [
      { key: PERMISSIONS.USERS_MANAGE, label: 'Управление доступом пользователей', description: 'Создавать аккаунты, менять роли и настраивать права' },
      { key: PERMISSIONS.LOGS_VIEW, label: 'Просмотр журнала аудита (Audit Log)', description: 'Видеть историю изменений, действий и ошибок' },
    ],
  },
];

const ALL_PERMISSION_KEYS = Object.values(PERMISSIONS);

const ROLE_DEFAULT_PERMISSIONS = {
  owner: ALL_PERMISSION_KEYS.reduce((acc, key) => ({ ...acc, [key]: true }), {}),
  admin: {
    [PERMISSIONS.CALENDAR_VIEW_ALL]: true,
    [PERMISSIONS.CALENDAR_VIEW_ASSIGNED]: true,
    [PERMISSIONS.CALENDAR_MANAGE_ALL]: true,
    [PERMISSIONS.CALENDAR_MANAGE_ASSIGNED]: true,
    [PERMISSIONS.CALENDAR_DELETE]: true,
    [PERMISSIONS.CLIENTS_VIEW]: true,
    [PERMISSIONS.CLIENTS_VIEW_CONTACTS]: true,
    [PERMISSIONS.CLIENTS_MANAGE]: true,
    [PERMISSIONS.CLIENTS_DELETE]: true,
    [PERMISSIONS.FINANCE_VIEW_SALON_STATS]: true,
    [PERMISSIONS.FINANCE_DAY_CLOSE]: true,
    [PERMISSIONS.PAYOUTS_VIEW_ALL]: true,
    [PERMISSIONS.PAYOUTS_VIEW_OWN]: true,
    [PERMISSIONS.PAYOUTS_MANAGE]: true,
    [PERMISSIONS.CATALOG_MANAGE]: true,
    [PERMISSIONS.EMPLOYEES_MANAGE]: true,
    [PERMISSIONS.TASKS_MANAGE]: true,
    [PERMISSIONS.USERS_MANAGE]: false, // Only owner manages user roles/perms by default
    [PERMISSIONS.LOGS_VIEW]: true,
  },
  manager: {
    [PERMISSIONS.CALENDAR_VIEW_ALL]: true,
    [PERMISSIONS.CALENDAR_VIEW_ASSIGNED]: true,
    [PERMISSIONS.CALENDAR_MANAGE_ALL]: true,
    [PERMISSIONS.CALENDAR_MANAGE_ASSIGNED]: true,
    [PERMISSIONS.CALENDAR_DELETE]: false,
    [PERMISSIONS.CLIENTS_VIEW]: true,
    [PERMISSIONS.CLIENTS_VIEW_CONTACTS]: true,
    [PERMISSIONS.CLIENTS_MANAGE]: true,
    [PERMISSIONS.CLIENTS_DELETE]: false,
    [PERMISSIONS.FINANCE_VIEW_SALON_STATS]: true,
    [PERMISSIONS.FINANCE_DAY_CLOSE]: true,
    [PERMISSIONS.PAYOUTS_VIEW_ALL]: false,
    [PERMISSIONS.PAYOUTS_VIEW_OWN]: true,
    [PERMISSIONS.PAYOUTS_MANAGE]: false,
    [PERMISSIONS.CATALOG_MANAGE]: false,
    [PERMISSIONS.EMPLOYEES_MANAGE]: false,
    [PERMISSIONS.TASKS_MANAGE]: true,
    [PERMISSIONS.USERS_MANAGE]: false,
    [PERMISSIONS.LOGS_VIEW]: false,
  },
  staff: {
    [PERMISSIONS.CALENDAR_VIEW_ALL]: false,
    [PERMISSIONS.CALENDAR_VIEW_ASSIGNED]: true,
    [PERMISSIONS.CALENDAR_MANAGE_ALL]: false,
    [PERMISSIONS.CALENDAR_MANAGE_ASSIGNED]: true,
    [PERMISSIONS.CALENDAR_DELETE]: false,
    [PERMISSIONS.CLIENTS_VIEW]: true,
    [PERMISSIONS.CLIENTS_VIEW_CONTACTS]: false, // Contacts masked by default
    [PERMISSIONS.CLIENTS_MANAGE]: false,
    [PERMISSIONS.CLIENTS_DELETE]: false,
    [PERMISSIONS.FINANCE_VIEW_SALON_STATS]: false,
    [PERMISSIONS.FINANCE_DAY_CLOSE]: false,
    [PERMISSIONS.PAYOUTS_VIEW_ALL]: false,
    [PERMISSIONS.PAYOUTS_VIEW_OWN]: true,
    [PERMISSIONS.PAYOUTS_MANAGE]: false,
    [PERMISSIONS.CATALOG_MANAGE]: false,
    [PERMISSIONS.EMPLOYEES_MANAGE]: false,
    [PERMISSIONS.TASKS_MANAGE]: true,
    [PERMISSIONS.USERS_MANAGE]: false,
    [PERMISSIONS.LOGS_VIEW]: false,
  },
  readonly: {
    [PERMISSIONS.CALENDAR_VIEW_ALL]: true,
    [PERMISSIONS.CALENDAR_VIEW_ASSIGNED]: true,
    [PERMISSIONS.CALENDAR_MANAGE_ALL]: false,
    [PERMISSIONS.CALENDAR_MANAGE_ASSIGNED]: false,
    [PERMISSIONS.CALENDAR_DELETE]: false,
    [PERMISSIONS.CLIENTS_VIEW]: true,
    [PERMISSIONS.CLIENTS_VIEW_CONTACTS]: false,
    [PERMISSIONS.CLIENTS_MANAGE]: false,
    [PERMISSIONS.CLIENTS_DELETE]: false,
    [PERMISSIONS.FINANCE_VIEW_SALON_STATS]: false,
    [PERMISSIONS.FINANCE_DAY_CLOSE]: false,
    [PERMISSIONS.PAYOUTS_VIEW_ALL]: false,
    [PERMISSIONS.PAYOUTS_VIEW_OWN]: false,
    [PERMISSIONS.PAYOUTS_MANAGE]: false,
    [PERMISSIONS.CATALOG_MANAGE]: false,
    [PERMISSIONS.EMPLOYEES_MANAGE]: false,
    [PERMISSIONS.TASKS_MANAGE]: false,
    [PERMISSIONS.USERS_MANAGE]: false,
    [PERMISSIONS.LOGS_VIEW]: false,
  },
};

/**
 * Calculates effective permissions by merging role defaults with explicit user overrides.
 */
function getEffectivePermissions(role, customPermissions = {}) {
  const normRole = String(role || 'staff').toLowerCase();
  if (normRole === 'owner') {
    return ALL_PERMISSION_KEYS.reduce((acc, key) => ({ ...acc, [key]: true }), {});
  }

  const base = { ...(ROLE_DEFAULT_PERMISSIONS[normRole] || ROLE_DEFAULT_PERMISSIONS.staff) };

  if (customPermissions && typeof customPermissions === 'object') {
    for (const [key, val] of Object.entries(customPermissions)) {
      if (typeof val === 'boolean' && ALL_PERMISSION_KEYS.includes(key)) {
        base[key] = val;
      }
    }
  }

  return base;
}

/**
 * Mask sensitive contact info for staff without clients.view_contacts permission.
 */
function maskPhoneNumber(phone) {
  if (!phone) return phone;
  const str = String(phone).trim();
  if (str.length <= 4) return '***';
  const prefix = str.slice(0, 3);
  const suffix = str.slice(-2);
  return `${prefix} ••• •• ${suffix}`;
}

function maskEmail(email) {
  if (!email) return email;
  const str = String(email).trim();
  const [name, domain] = str.split('@');
  if (!domain) return '***';
  const visibleName = name.length > 2 ? `${name.slice(0, 2)}•••` : `${name.slice(0, 1)}•••`;
  return `${visibleName}@${domain}`;
}

module.exports = {
  ALL_PERMISSION_KEYS,
  PERMISSION_GROUPS,
  PERMISSIONS,
  ROLE_DEFAULT_PERMISSIONS,
  getEffectivePermissions,
  maskEmail,
  maskPhoneNumber,
};
