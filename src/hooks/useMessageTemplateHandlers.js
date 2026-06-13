import {useCallback} from "react";

export function useMessageTemplateHandlers({
  createLocalId,
  editingMessageTemplate,
  pushNotification,
  requestEntityDelete,
  setEditingMessageTemplate,
  setMessageTemplateModalOpen,
  setMessageTemplates,
}) {
  const openCreateMessageTemplate = useCallback(() => {
    setEditingMessageTemplate(null);
    setMessageTemplateModalOpen(true);
  }, [setEditingMessageTemplate, setMessageTemplateModalOpen]);

  const openEditMessageTemplate = useCallback(
    (template) => {
      setEditingMessageTemplate(template);
      setMessageTemplateModalOpen(true);
    },
    [setEditingMessageTemplate, setMessageTemplateModalOpen],
  );

  const handleMessageTemplateSubmit = useCallback(
    (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const name = String(form.get("name") ?? "").trim();
      const body = String(form.get("body") ?? "").trim();

      if (!name || !body) {
        return;
      }

      const template = {
        id: editingMessageTemplate?.id ?? createLocalId(),
        name,
        channel: form.get("channel"),
        language: form.get("language"),
        audience: form.get("audience"),
        purpose: form.get("purpose") || "general",
        subject: String(form.get("subject") ?? "").trim(),
        body,
      };

      setMessageTemplates((current) =>
        editingMessageTemplate
          ? current.map((item) => (item.id === template.id ? template : item))
          : [template, ...current],
      );
      setMessageTemplateModalOpen(false);
      setEditingMessageTemplate(null);
      pushNotification({
        title: editingMessageTemplate ? "Шаблон обновлен" : "Шаблон добавлен",
        message: `${template.name} сохранен в шаблонах сообщений`,
      });
    },
    [
      createLocalId,
      editingMessageTemplate,
      pushNotification,
      setEditingMessageTemplate,
      setMessageTemplateModalOpen,
      setMessageTemplates,
    ],
  );

  const requestDeleteMessageTemplate = useCallback(
    (template) => {
      requestEntityDelete("messageTemplate", template);
    },
    [requestEntityDelete],
  );

  const performDeleteMessageTemplate = useCallback(
    (template) => {
      setMessageTemplates((current) =>
        current.filter((item) => item.id !== template.id),
      );
      pushNotification({
        title: "Шаблон удален",
        message: `${template.name} удален из шаблонов сообщений`,
      });
    },
    [pushNotification, setMessageTemplates],
  );

  return {
    handleMessageTemplateSubmit,
    openCreateMessageTemplate,
    openEditMessageTemplate,
    performDeleteMessageTemplate,
    requestDeleteMessageTemplate,
  };
}
