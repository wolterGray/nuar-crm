import {
  BriefcaseBusiness,
  CalendarDays,
  ChartNoAxesCombined,
  ClipboardList,
  MailSearch,
  MessageSquareText,
  Package,
  ReceiptText,
  Settings,
  User,
  Users,
} from "lucide-react";

export const navGroups = [
  {
    id: "work",
    label: "Работа",
    items: [
      {label: "Календарь", page: "calendar", icon: CalendarDays},
      {label: "Клиенты", page: "clients", icon: Users},
      {label: "Оплаты", page: "payments", icon: ReceiptText},
      {label: "Операции", page: "operations", icon: ClipboardList},
    ],
  },
  {
    id: "catalog",
    label: "База",
    items: [
      {label: "Услуги", page: "services", icon: BriefcaseBusiness},
      {label: "Пакеты", page: "packages", icon: Package},
      {label: "Сотрудники", page: "masters", icon: User},
    ],
  },
  {
    id: "comms",
    label: "Связь",
    items: [
      {label: "Шаблоны", page: "templates", icon: MessageSquareText},
      {label: "Импорт", page: "import", icon: MailSearch},
    ],
  },
  {
    id: "analytics",
    label: "Аналитика",
    items: [{label: "Статистика", page: "statistics", icon: ChartNoAxesCombined}],
  },
  {
    id: "system",
    label: "Система",
    items: [{label: "Настройки", page: "settings", icon: Settings}],
  },
];

export const navItems = navGroups.flatMap((group) => group.items);

export const mobileNavItems = [
  {label: "Календарь", page: "calendar", icon: CalendarDays},
  {label: "Оплаты", page: "payments", icon: ReceiptText},
  {label: "Клиенты", page: "clients", icon: Users},
  {label: "Статистика", page: "statistics", icon: ChartNoAxesCombined},
];
