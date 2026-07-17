import {motion} from "framer-motion";
import {useMemo, useState} from "react";
import PageHeader from "../ui/PageHeader.jsx";
import BulkSmsPanel from "../BulkSmsPanel.jsx";
import {getClientMessageName} from "../../utils/clientMessageName.js";
import {
  getMessageTemplatePurposeLabel,
  MESSAGE_TEMPLATE_PURPOSES,
} from "../../utils/messageTemplates.js";
import {useBreakpoint} from "../../hooks/useBreakpoint.js";
import {RowActionsMenu} from "../RowActionMenuPortal.jsx";
import SearchControl from "../ui/SearchControl.jsx";
import Button from "../ui/Button.jsx";
import {AppIcon, Field, IconButton, Input} from "../ui/index.js";

function MessageTemplateCard({
  isMobile,
  onCopy,
  onDelete,
  onEdit,
  onSend,
  openMenuId,
  setOpenMenuId,
  template,
}) {
  const iconName = template.channel === "Email" ? "mail" : "message";

  if (isMobile) {
    return (
      <motion.article
        animate={{opacity: 1, y: 0}}
        className="catalog-card message-template-card message-template-mobile-card"
        initial={{opacity: 0, y: 6}}>
        <div className="message-template-mobile-head">
          <div className="message-template-card-header">
            <AppIcon name={iconName} size="md" />
            <div>
              <h3>{template.name}</h3>
              <span>
                {getMessageTemplatePurposeLabel(template.purpose)} · {template.channel}
              </span>
            </div>
          </div>
          <RowActionsMenu
            className="message-template-row-actions"
            itemId={template.id}
            openMenuId={openMenuId}
            setOpenMenuId={setOpenMenuId}
            onDelete={() => onDelete(template)}
            onEdit={() => onEdit(template)}
          />
        </div>
        <div className="message-template-mobile-meta">
          <span>{template.language}</span>
          <span>{template.audience}</span>
        </div>
        {template.subject ? (
          <strong className="message-template-mobile-subject">{template.subject}</strong>
        ) : null}
        <p>{template.body}</p>
        <div className="message-template-mobile-actions">
          <Button
            className="secondary-button"
            leftIcon="copy"
            size="sm"
            type="button"
            variant="secondary"
            onClick={() => onCopy(template)}>
            Копировать
          </Button>
          <Button
            className="add-visit-button"
            leftIcon="send"
            size="sm"
            type="button"
            variant="primary"
            onClick={() => onSend(template)}>
            Отправить
          </Button>
        </div>
      </motion.article>
    );
  }

  return (
    <article className="catalog-card message-template-card" key={template.id}>
      <div className="message-template-card-header">
        <AppIcon name={iconName} size="md" />
        <div>
          <h3>{template.name}</h3>
          <span>
            {getMessageTemplatePurposeLabel(template.purpose)} · {template.channel} ·{" "}
            {template.language} · {template.audience}
          </span>
        </div>
      </div>
      {template.subject && <strong>{template.subject}</strong>}
      <p>{template.body}</p>
      <div className="message-template-actions">
        <IconButton
          className="template-icon-button"
          icon="copy"
          label="Копировать текст"
          size="sm"
          title="Копировать"
          onClick={() => onCopy(template)}>
        </IconButton>
        <IconButton
          className="template-icon-button template-send-button"
          icon="send"
          label="Отправить клиенту"
          size="sm"
          title="Отправить клиенту"
          onClick={() => onSend(template)}>
        </IconButton>
        <IconButton
          className="template-icon-button"
          icon="edit"
          label="Редактировать шаблон"
          size="sm"
          title="Редактировать"
          onClick={() => onEdit(template)}>
        </IconButton>
        <IconButton
          className="template-icon-button template-delete-button"
          icon="trash"
          label="Удалить шаблон"
          size="sm"
          title="Удалить"
          variant="danger"
          onClick={() => onDelete(template)}>
        </IconButton>
      </div>
    </article>
  );
}

function MessageTemplatesPage({
  bulkSms = null,
  templates,
  clients,
  preferredClientId,
  onClearPreferredClient,
  onAdd,
  onEdit,
  onDelete,
  onNotify,
  onMessageSent,
}) {
  const {isMobile} = useBreakpoint();
  const [sendingTemplate, setSendingTemplate] = useState(null);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [clientQuery, setClientQuery] = useState("");
  const [sendChannel, setSendChannel] = useState("SMS");
  const [openMenuId, setOpenMenuId] = useState(null);
  const [filters, setFilters] = useState({
    query: "",
    channel: "",
    language: "",
    audience: "",
    purpose: "",
  });

  const filteredTemplates = useMemo(() => {
    const query = filters.query.trim().toLowerCase();

    return templates.filter((template) => {
      const matchesQuery =
        !query ||
        [template.name, template.subject, template.body, getMessageTemplatePurposeLabel(template.purpose)]
          .join(" ")
          .toLowerCase()
          .includes(query);

      return (
        matchesQuery &&
        (!filters.channel || template.channel === filters.channel) &&
        (!filters.language || template.language === filters.language) &&
        (!filters.audience || template.audience === filters.audience) &&
        (!filters.purpose ||
          String(template.purpose ?? "general") === filters.purpose)
      );
    });
  }, [filters, templates]);

  const setFilter = (name, value) => {
    setOpenMenuId(null);
    setFilters((current) => ({...current, [name]: value}));
  };

  const selectedClient = clients.find(
    (client) => String(client.id) === selectedClientId,
  );
  const preferredClient = clients.find(
    (client) => String(client.id) === preferredClientId,
  );
  const getPersonalizedText = (template, client) =>
    template.body.replaceAll("{name}", getClientMessageName(client) || "клиент");

  const copyText = async (template, client = null) => {
    const text = client ? getPersonalizedText(template, client) : template.body;

    try {
      await navigator.clipboard.writeText(text);
      onNotify({
        title: "Сообщение скопировано",
        message: client
          ? `Текст для ${client.name} готов`
          : `${template.name} скопирован в буфер обмена`,
      });
    } catch {
      onNotify({
        title: "Не удалось скопировать",
        message: "Разрешите браузеру доступ к буферу обмена",
      });
    }
  };

  const openSendDialog = (template) => {
    const preferredClientForDialog = clients.find(
      (client) => String(client.id) === preferredClientId,
    );

    setSendingTemplate(template);
    setSelectedClientId(
      preferredClientForDialog ? String(preferredClientForDialog.id) : "",
    );
    setClientQuery(preferredClientForDialog?.name ?? "");
    setSendChannel(template.channel === "Email" ? "Email" : "SMS");
  };

  const closeSendDialog = () => {
    setSendingTemplate(null);
    setSelectedClientId("");
    setClientQuery("");
  };

  const sendMessage = () => {
    if (!sendingTemplate || !selectedClient) {
      return;
    }

    const body = getPersonalizedText(sendingTemplate, selectedClient);

    if (sendChannel === "Instagram") {
      const instagram = String(selectedClient.instagram ?? "").trim();

      if (!instagram) {
        onNotify({
          title: "Instagram не указан",
          message: `Добавьте Instagram в карточку клиента ${selectedClient.name}`,
        });
        return;
      }

      void copyText(sendingTemplate, selectedClient);
      const profileUrl = instagram.startsWith("http")
        ? instagram
        : `https://www.instagram.com/${instagram.replace(/^@/, "")}/`;
      window.open(profileUrl, "_blank", "noopener,noreferrer");
    } else if (sendChannel === "Telegram") {
      const telegram = String(selectedClient.telegram ?? "").trim();

      if (!telegram) {
        onNotify({
          title: "Telegram не указан",
          message: `Добавьте Telegram в карточку клиента ${selectedClient.name}`,
        });
        return;
      }

      void copyText(sendingTemplate, selectedClient);
      const profileUrl = telegram.startsWith("http")
        ? telegram
        : `https://t.me/${telegram.replace(/^@/, "")}`;
      window.open(profileUrl, "_blank", "noopener,noreferrer");
    } else if (sendChannel === "WhatsApp") {
      const phone = String(selectedClient.phone ?? "").replace(/\D/g, "");

      if (phone.length < 7) {
        onNotify({
          title: "Телефон не указан",
          message: `Добавьте номер в карточку клиента ${selectedClient.name}`,
        });
        return;
      }

      window.open(
        `https://wa.me/${phone}?text=${encodeURIComponent(body)}`,
        "_blank",
        "noopener,noreferrer",
      );
    } else if (sendChannel === "Email") {
      if (!selectedClient.email) {
        onNotify({
          title: "Email не указан",
          message: `Добавьте email в карточку клиента ${selectedClient.name}`,
        });
        return;
      }

      window.open(
        `mailto:${selectedClient.email}?subject=${encodeURIComponent(
          sendingTemplate.subject,
        )}&body=${encodeURIComponent(body)}`,
        "_self",
      );
    } else {
      const phone = String(selectedClient.phone ?? "").replace(/[^\d+]/g, "");

      if (phone.replace(/\D/g, "").length < 7) {
        onNotify({
          title: "Телефон не указан",
          message: `Добавьте номер в карточку клиента ${selectedClient.name}`,
        });
        return;
      }

      window.open(`sms:${phone}?body=${encodeURIComponent(body)}`, "_self");
    }

    onMessageSent({
      client: selectedClient,
      channel: sendChannel,
      template: sendingTemplate,
      body,
    });
    closeSendDialog();
  };

  const filterFields = (
    <>
      <select
        value={filters.channel}
        onChange={(event) => setFilter("channel", event.target.value)}>
        <option value="">Все каналы</option>
        <option>SMS</option>
        <option>Email</option>
      </select>
      <select
        value={filters.language}
        onChange={(event) => setFilter("language", event.target.value)}>
        <option value="">Все языки</option>
        <option>Русский</option>
        <option>Польский</option>
        <option>Английский</option>
        <option>Украинский</option>
      </select>
      <select
        value={filters.audience}
        onChange={(event) => setFilter("audience", event.target.value)}>
        <option value="">Все аудитории</option>
        <option>Все</option>
        <option>Девушки</option>
        <option>Парни</option>
        <option>Поляки</option>
        <option>Англичане</option>
        <option>Украинцы</option>
      </select>
      <select
        value={filters.purpose}
        onChange={(event) => setFilter("purpose", event.target.value)}>
        <option value="">Все назначения</option>
        {Object.entries(MESSAGE_TEMPLATE_PURPOSES).map(([value, meta]) => (
          <option key={value} value={value}>
            {meta.label}
          </option>
        ))}
      </select>
    </>
  );

  return (
    <section
      className={`catalog-page message-templates-page ${
        isMobile ? "message-templates-page-mobile" : ""
      }`}
      onClick={() => setOpenMenuId(null)}>
      <PageHeader
        className="message-templates-page-header"
        collapsedMeta={`${templates.length} шаблонов`}
        collapsible={false}
        actions={
          <div className="message-templates-page-toolbar">
            {isMobile ? (
              <SearchControl
                className="message-templates-search-control"
                placeholder="Поиск шаблона"
                value={filters.query}
                onChange={(event) => setFilter("query", event.target.value)}
                onClear={() => setFilter("query", "")}
              />
            ) : null}
            <Button
              className="message-templates-add-button"
              leftIcon="plus"
              type="button"
              variant="primary"
              onClick={onAdd}>
              {isMobile ? "Добавить" : "Добавить шаблон"}
            </Button>
          </div>
        }
        description={
          isMobile
            ? `${filteredTemplates.length} из ${templates.length} шаблонов`
            : `${filteredTemplates.length} из ${templates.length} шаблонов`
        }
        title="Шаблоны"
      />

      {isMobile ? (
        <details className="message-templates-filters-collapsible">
          <summary>
            Фильтры
            <span>
              {filteredTemplates.length} / {templates.length}
            </span>
          </summary>
          <div className="message-template-filters message-template-filters-mobile">
            {filterFields}
          </div>
        </details>
      ) : null}

      {!isMobile ? (
        <div className="message-template-filters">
          <SearchControl
            className="message-templates-search-control"
            placeholder="Поиск шаблона"
            value={filters.query}
            onChange={(event) => setFilter("query", event.target.value)}
            onClear={() => setFilter("query", "")}
          />
          {filterFields}
        </div>
      ) : null}

      {preferredClient ? (
        <div className="preferred-message-client message-templates-preferred-mobile">
          <AppIcon name="message" size="sm" />
          <span>
            Сообщение для <strong>{preferredClient.name}</strong>
          </span>
          <IconButton
            icon="x"
            label="Убрать выбранного клиента"
            size="sm"
            title="Убрать клиента"
            variant="ghost"
            onClick={onClearPreferredClient}
          />
        </div>
      ) : null}

      <div className="catalog-grid message-template-grid message-templates-scroll">
        {filteredTemplates.map((template) => (
          <MessageTemplateCard
            key={template.id}
            isMobile={isMobile}
            openMenuId={openMenuId}
            setOpenMenuId={setOpenMenuId}
            template={template}
            onCopy={copyText}
            onDelete={onDelete}
            onEdit={onEdit}
            onSend={openSendDialog}
          />
        ))}
        {filteredTemplates.length === 0 ? (
          <div className="message-templates-empty">
            <strong>Шаблоны не найдены</strong>
            <span>Измените фильтры или добавьте новый шаблон.</span>
          </div>
        ) : null}
      </div>

      {bulkSms ? (
        isMobile ? (
          <details className="message-templates-bulk-collapsible">
            <summary>Bulk SMS</summary>
            <BulkSmsPanel
              bulkSms={bulkSms}
              messageTemplates={templates}
              onNotify={onNotify}
            />
          </details>
        ) : (
          <div className="message-templates-secondary">
            <BulkSmsPanel
              bulkSms={bulkSms}
              messageTemplates={templates}
              onNotify={onNotify}
            />
          </div>
        )
      ) : null}

      {sendingTemplate ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={closeSendDialog}>
          <section
            aria-labelledby="send-template-title"
            aria-modal="true"
            className="employee-modal send-template-modal"
            role="dialog"
            onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 id="send-template-title">Отправить клиенту</h2>
                <p>{sendingTemplate.name}</p>
              </div>
              <IconButton
                className="modal-close"
                icon="x"
                label="Закрыть отправку"
                size="sm"
                variant="ghost"
                onClick={closeSendDialog}>
              </IconButton>
            </div>
            <Field label="Клиент">
              <Input
                list="message-client-options"
                placeholder="Начните вводить имя"
                value={clientQuery}
                onChange={(event) => {
                  const query = event.target.value;
                  const matchingClient = clients.find(
                    (client) =>
                      client.name.toLowerCase() === query.toLowerCase(),
                  );

                  setClientQuery(query);
                  setSelectedClientId(
                    matchingClient ? String(matchingClient.id) : "",
                  );
                }}
              />
              <datalist id="message-client-options">
                {clients.map((client) => (
                  <option key={client.id} value={client.name} />
                ))}
              </datalist>
            </Field>
            <div className="send-channel-control" aria-label="Способ отправки">
              <button
                className={sendChannel === "Instagram" ? "active" : ""}
                type="button"
                onClick={() => setSendChannel("Instagram")}>
                <AppIcon name="external" size="sm" />
                Instagram
              </button>
              <button
                className={sendChannel === "Email" ? "active" : ""}
                type="button"
                onClick={() => setSendChannel("Email")}>
                <AppIcon name="mail" size="sm" />
                Email
              </button>
              <button
                className={sendChannel === "SMS" ? "active" : ""}
                type="button"
                onClick={() => setSendChannel("SMS")}>
                <AppIcon name="message" size="sm" />
                SMS
              </button>
              <button
                className={sendChannel === "Telegram" ? "active" : ""}
                type="button"
                onClick={() => setSendChannel("Telegram")}>
                <AppIcon name="at" size="sm" />
                Telegram
              </button>
              <button
                className={sendChannel === "WhatsApp" ? "active" : ""}
                type="button"
                onClick={() => setSendChannel("WhatsApp")}>
                <AppIcon name="message" size="sm" />
                WhatsApp
              </button>
            </div>
            <div className="send-template-preview">
              <span>Предпросмотр</span>
              <p>{getPersonalizedText(sendingTemplate, selectedClient)}</p>
            </div>
            <div className="send-template-actions">
              <Button
                className="secondary-button"
                disabled={!selectedClient}
                leftIcon="copy"
                size="sm"
                type="button"
                variant="secondary"
                onClick={() => copyText(sendingTemplate, selectedClient)}>
                Копировать
              </Button>
              <Button
                className="submit-button"
                disabled={!selectedClient}
                leftIcon="send"
                size="sm"
                type="button"
                variant="primary"
                onClick={sendMessage}>
                {["Instagram", "Telegram"].includes(sendChannel)
                  ? `Открыть ${sendChannel}`
                  : "Отправить"}
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

export default MessageTemplatesPage;
