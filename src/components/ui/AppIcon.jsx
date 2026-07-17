import clsx from "clsx";
import {
  AlertTriangle,
  BadgeCheck,
  Ban,
  Bell,
  Calendar,
  CalendarPlus,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Crown,
  CreditCard,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  Filter,
  Gift,
  Info,
  LoaderCircle,
  LogOut,
  Menu,
  MessageSquare,
  Minus,
  MoreHorizontal,
  Package,
  Phone,
  Plus,
  QrCode,
  RefreshCw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  User,
  Wallet,
  X,
} from "lucide-react";
import styles from "./AppIcon.module.css";

const appIcons = {
  alert: AlertTriangle,
  badgeCheck: BadgeCheck,
  ban: Ban,
  bell: Bell,
  calendar: Calendar,
  calendarPlus: CalendarPlus,
  check: Check,
  chevronDown: ChevronDown,
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  clock: Clock,
  copy: Copy,
  crown: Crown,
  creditCard: CreditCard,
  edit: Edit3,
  external: ExternalLink,
  eye: Eye,
  eyeOff: EyeOff,
  filter: Filter,
  gift: Gift,
  info: Info,
  loader: LoaderCircle,
  logout: LogOut,
  menu: Menu,
  message: MessageSquare,
  minus: Minus,
  more: MoreHorizontal,
  package: Package,
  phone: Phone,
  plus: Plus,
  qr: QrCode,
  refresh: RefreshCw,
  save: Save,
  search: Search,
  settings: Settings,
  shield: ShieldCheck,
  sparkles: Sparkles,
  star: Star,
  trash: Trash2,
  user: User,
  wallet: Wallet,
  x: X,
};

export default function AppIcon({
  className,
  decorative,
  icon,
  label,
  name,
  size = "md",
  spin = false,
  strokeWidth = 1.8,
  ...props
}) {
  const Icon = icon || appIcons[name] || Info;
  const isDecorative = decorative ?? !label;

  return (
    <Icon
      aria-hidden={isDecorative ? "true" : undefined}
      aria-label={isDecorative ? undefined : label}
      className={clsx(styles.icon, styles[size] ?? styles.md, spin && styles.spin, className)}
      focusable="false"
      role={isDecorative ? undefined : "img"}
      strokeWidth={strokeWidth}
      {...props}
    />
  );
}
