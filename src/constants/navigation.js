import {
  BriefcaseBusiness,
  CalendarDays,
  ChartNoAxesCombined,
  Globe,
  MailSearch,
  MessageSquareText,
  Package,
  PackageSearch,
  ReceiptText,
  Settings,
  User,
  Users,
} from "lucide-react";

export const navItems = [
  {label: "Статистика", page: "statistics", icon: ChartNoAxesCombined},
  {label: "Календарь", page: "calendar", icon: CalendarDays},
  {label: "Оплаты", page: "payments", icon: ReceiptText},
  {label: "Клиенты", page: "clients", icon: Users},
  {label: "Сотрудники", page: "masters", icon: User},
  {label: "Услуги", page: "services", icon: BriefcaseBusiness},
  {label: "Пакеты", page: "packages", icon: Package},
  {label: "Задачи", page: "operations", icon: PackageSearch},
  {label: "Импорт", page: "import", icon: MailSearch},
  {label: "Шаблоны", page: "templates", icon: MessageSquareText},
  {label: "Сайт", page: "site", icon: Globe},
  {label: "Настройки", page: "settings", icon: Settings},
];

export const mobileNavItems = [
  {label: "Календарь", page: "calendar", icon: CalendarDays},
  {label: "Оплаты", page: "payments", icon: ReceiptText},
  {label: "Клиенты", page: "clients", icon: Users},
  {label: "Статистика", page: "statistics", icon: ChartNoAxesCombined},
];
