import {
  AtSign,
  Copy,
  ExternalLink,
  Mail,
  MessageCircle,
  MessageSquareText,
  Pencil,
  Plus,
  Send,
  Trash2,
  X,
} from "lucide-react";
import {motion} from "framer-motion";
import {useMemo, useState} from "react";
import PageHeader from "../PageHeader.jsx";
import BulkSmsPanel from "../BulkSmsPanel.jsx";
import {getClientMessageName} from "../../utils/clientMessageName.js";
import {
  getMessageTemplatePurposeLabel,
  MESSAGE_TEMPLATE_PURPOSES,
} from "../../utils/messageTemplates.js";
import {useBreakpoint} from "../../hooks/useBreakpoint.js";
import {RowActionsMenu} from "../RowActionMenuPortal.jsx";
import SearchControl from "../ui/SearchControl.jsx";

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
  const Icon = template.channel === "Email" ? Mail : MessageSquareText;

  if (isMobile) {
    return (
      <motion.article
        animate={{opacity: 1, y: 0}}
        className="catalog-card message-template-card message-template-mobile-card"
        initial={{opacity: 0, y: 6}}>
        <div className="message-template-mobile-head">
          <div className="message-template-card-header">
            <Icon size={18} />
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
          <button
            className="secondary-button"
            type="button"
            onClick={() => onCopy(template)}>
            <Copy size={15} />
            Копировать
          </button>
          <button
            className="add-visit-button"
            type="button"
            onClick={() => onSend(template)}>
            <Send size={15} />
            Отправить
          </button>
        </div>
      </motion.article>
    );
  }

  return (
    <article className="catalog-card message-template-card" key={template.id}>
      <div className="message-template-card-header">
        <Icon size={18} />
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
        <button
          aria-label="Копировать текст"
          className="template-icon-button"
          title="Копировать"
          type="button"
          onClick={() => onCopy(template)}>
          <Copy size={15} />
        </button>
        <button
          aria-label="Отправить клиенту"
          className="template-icon-button template-send-button"
          title="Отправить клиенту"
          type="button"
          onClick={() => onSend(template)}>
          <Send size={15} />
        </button>
        <button
          aria-label="Редактировать шаблон"
          className="template-icon-button"
          title="Редактировать"
          type="button"
          onClick={() => onEdit(template)}>
          <Pencil size={15} />
        </button>
        <button
          aria-label="Удалить шаблон"
          className="template-icon-button template-delete-button"
          title="Удалить"
          type="button"
          onClick={() => onDelete(template)}>
          <Trash2 size={15} />
        </button>
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
        collapsedMeta={`${templates.length} шаблонов`}
        collapsible={false}
        actions={
          isMobile ? (
            <>
              <SearchControl
                className="message-templates-search-control"
                placeholder="Поиск шаблона"
                value={filters.query}
                onChange={(event) => setFilter("query", event.target.value)}
                onClear={() => setFilter("query", "")}
              />
              <button className="add-visit-button" type="button" onClick={onAdd}>
                <Plus size={18} />
                Добавить
              </button>
            </>
          ) : (
            <button className="add-visit-button" type="button" onClick={onAdd}>
              <Plus size={18} />
              Добавить шаблон
            </button>
          )
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
          <BulkSmsPanel
            bulkSms={bulkSms}
            messageTemplates={templates}
            onNotify={onNotify}
          />
        )
      ) : null}

      {preferredClient ? (
        <div className="preferred-message-client message-templates-preferred-mobile">
          <MessageSquareText size={16} />
          <span>
            Сообщение для <strong>{preferredClient.name}</strong>
          </span>
          <button
            aria-label="Убрать выбранного клиента"
            title="Убрать клиента"
            type="button"
            onClick={onClearPreferredClient}>
            <X size={14} />
          </button>
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
              <button
                aria-label="Закрыть отправку"
                className="modal-close"
                type="button"
                onClick={closeSendDialog}>
                <X size={18} />
              </button>
            </div>
            <label>
              Клиент
              <input
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
            </label>
            <div className="send-channel-control" aria-label="Способ отправки">
              <button
                className={sendChannel === "Instagram" ? "active" : ""}
                type="button"
                onClick={() => setSendChannel("Instagram")}>
                <ExternalLink size={15} />
                Instagram
              </button>
              <button
                className={sendChannel === "Email" ? "active" : ""}
                type="button"
                onClick={() => setSendChannel("Email")}>
                <Mail size={15} />
                Email
              </button>
              <button
                className={sendChannel === "SMS" ? "active" : ""}
                type="button"
                onClick={() => setSendChannel("SMS")}>
                <MessageSquareText size={15} />
                SMS
              </button>
              <button
                className={sendChannel === "Telegram" ? "active" : ""}
                type="button"
                onClick={() => setSendChannel("Telegram")}>
                <AtSign size={15} />
                Telegram
              </button>
              <button
                className={sendChannel === "WhatsApp" ? "active" : ""}
                type="button"
                onClick={() => setSendChannel("WhatsApp")}>
                <MessageCircle size={15} />
                WhatsApp
              </button>
            </div>
            <div className="send-template-preview">
              <span>Предпросмотр</span>
              <p>{getPersonalizedText(sendingTemplate, selectedClient)}</p>
            </div>
            <div className="send-template-actions">
              <button
                className="secondary-button"
                disabled={!selectedClient}
                type="button"
                onClick={() => copyText(sendingTemplate, selectedClient)}>
                <Copy size={15} />
                Копировать
              </button>
              <button
                className="submit-button"
                disabled={!selectedClient}
                type="button"
                onClick={sendMessage}>
                <Send size={15} />
                {["Instagram", "Telegram"].includes(sendChannel)
                  ? `Открыть ${sendChannel}`
                  : "Отправить"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

export default MessageTemplatesPage;
