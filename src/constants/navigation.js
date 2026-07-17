export const navGroups = [
  {
    id: "work",
    label: "Работа",
    items: [
      {label: "Сегодня", page: "today", icon: "sun"},
      {label: "Календарь", page: "calendar", icon: "calendarDays"},
      {label: "Клиенты", page: "clients", icon: "users"},
      {label: "Club", page: "club", icon: "crown"},
      {label: "Оплаты", page: "payments", icon: "receipt"},
      {label: "Операции", page: "operations", icon: "clipboardList"},
    ],
  },
  {
    id: "catalog",
    label: "База",
    items: [
      {label: "Услуги", page: "services", icon: "briefcase"},
      {label: "Пакеты", page: "packages", icon: "package"},
      {label: "Сотрудники", page: "masters", icon: "user"},
    ],
  },
  {
    id: "comms",
    label: "Связь",
    items: [
      {label: "Шаблоны", page: "templates", icon: "messageText"},
      {label: "Импорт", page: "import", icon: "mailSearch"},
    ],
  },
  {
    id: "analytics",
    label: "Аналитика",
    items: [{label: "Статистика", page: "statistics", icon: "chart"}],
  },
  {
    id: "system",
    label: "Система",
    items: [
      {label: "Сайт", page: "site", icon: "globe"},
      {label: "Настройки", page: "settings", icon: "settings"},
    ],
  },
];

export const navItems = navGroups.flatMap((group) => group.items);

export const mobileNavItems = [
  {label: "Сегодня", page: "today", icon: "sun"},
  {label: "Календарь", page: "calendar", icon: "calendarDays"},
  {label: "Визиты", page: "payments", icon: "receipt"},
  {label: "Клиенты", page: "clients", icon: "users"},
  {label: "Операции", page: "operations", icon: "clipboardList"},
];
