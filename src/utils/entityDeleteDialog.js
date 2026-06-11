export const entityDeleteTypes = {
  client: "client",
  employee: "employee",
  service: "service",
  package: "package",
  clientPackage: "clientPackage",
  messageTemplate: "messageTemplate",
  task: "task",
  supply: "supply",
};

export const getEntityDeleteDialogContent = (pendingDelete) => {
  if (!pendingDelete?.type || !pendingDelete?.entity) {
    return null;
  }

  const {type, entity} = pendingDelete;

  switch (type) {
    case entityDeleteTypes.client:
      return {
        confirmLabel: "Удалить",
        message: `${entity.name} будет удалён из базы клиентов. Его пакеты тоже будут удалены. Визиты и записи в календаре сохранятся.`,
        title: "Удалить клиента?",
      };
    case entityDeleteTypes.employee:
      return {
        confirmLabel: "Удалить",
        message: `${entity.name} будет удалён из базы сотрудников. Визиты и записи в календаре с этим мастером сохранятся.`,
        title: "Удалить сотрудника?",
      };
    case entityDeleteTypes.service:
      return {
        confirmLabel: "Удалить",
        message: `${entity.name} будет удалена из каталога услуг. Старые визиты и записи сохранятся.`,
        title: "Удалить услугу?",
      };
    case entityDeleteTypes.package:
      return {
        confirmLabel: "Удалить",
        message: `${entity.name} будет удалён из шаблонов пакетов. Уже проданные пакеты клиентов сохранятся.`,
        title: "Удалить шаблон пакета?",
      };
    case entityDeleteTypes.clientPackage:
      return {
        confirmLabel: "Удалить",
        message: `${entity.client}: ${entity.packageName} будет удалён. Остаток сеансов и история списаний по этому пакету пропадут из CRM.`,
        title: "Удалить пакет клиента?",
      };
    case entityDeleteTypes.messageTemplate:
      return {
        confirmLabel: "Удалить",
        message: `${entity.name} будет удалён из шаблонов сообщений.`,
        title: "Удалить шаблон?",
      };
    case entityDeleteTypes.task:
      return {
        confirmLabel: "Удалить",
        message: entity.type === "note"
          ? `Заметка «${entity.title}» будет удалена без возможности восстановления.`
          : `Задача «${entity.title}» будет удалена без возможности восстановления.`,
        title: entity.type === "note" ? "Удалить заметку?" : "Удалить задачу?",
      };
    case entityDeleteTypes.supply:
      return {
        confirmLabel: "Удалить",
        message: `${entity.name} будет удалён из списка расходников.`,
        title: "Удалить расходник?",
      };
    default:
      return null;
  }
};
