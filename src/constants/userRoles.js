export const USER_ROLE_OPTIONS = [
  {label: "Владелец (Owner)", value: "owner"},
  {label: "Администратор", value: "admin"},
  {label: "Менеджер", value: "manager"},
  {label: "Сотрудник", value: "staff"},
  {label: "Только чтение", value: "readonly"},
];

export const ROLE_BADGE_VARIANTS = {
  owner: "premium",
  admin: "danger",
  manager: "info",
  staff: "success",
  readonly: "neutral",
};

export const ROLE_LABELS = {
  owner: "Владелец",
  admin: "Администратор",
  manager: "Управляющий",
  staff: "Сотрудник",
  readonly: "Только чтение",
};
