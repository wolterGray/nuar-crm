import {useCallback} from "react";
import {
  createMessageTemplate,
  deleteMessageTemplate,
  updateMessageTemplate,
} from "../api/operations.js";

export function useMessageTemplateHandlers({
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
    async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const name = String(form.get("name") ?? "").trim();
      const body = String(form.get("body") ?? "").trim();

      if (!name || !body) {
        return;
      }

      const template = {
        ...(editingMessageTemplate?.id ? {id: editingMessageTemplate.id} : {}),
        name,
        channel: form.get("channel"),
        language: form.get("language"),
        audience: form.get("audience"),
        purpose: form.get("purpose") || "general",
        subject: String(form.get("subject") ?? "").trim(),
        body,
      };
      let savedTemplate;

      try {
        const response = editingMessageTemplate
          ? await updateMessageTemplate(editingMessageTemplate.id, template)
          : await createMessageTemplate(template);
        savedTemplate = response?.data ?? template;
      } catch (error) {
        pushNotification({
          title: editingMessageTemplate ? "Шаблон не обновлен" : "Шаблон не добавлен",
          message: error?.message || "Backend не принял шаблон",
          persist: false,
        });
        return;
      }

      setMessageTemplates((current) =>
        editingMessageTemplate
          ? current.map((item) => (item.id === savedTemplate.id ? savedTemplate : item))
          : [savedTemplate, ...current],
      );
      setMessageTemplateModalOpen(false);
      setEditingMessageTemplate(null);
      pushNotification({
        title: editingMessageTemplate ? "Шаблон обновлен" : "Шаблон добавлен",
        message: `${savedTemplate.name} сохранен в шаблонах сообщений`,
      });
    },
    [
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
    async (template) => {
      try {
        await deleteMessageTemplate(template.id);
      } catch (error) {
        pushNotification({
          title: "Шаблон не удален",
          message: error?.message || "Backend не удалил шаблон",
          persist: false,
        });
        return;
      }

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
