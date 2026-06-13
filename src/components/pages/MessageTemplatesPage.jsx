import {
  AtSign,
  Copy,
  ExternalLink,
  Mail,
  MessageCircle,
  MessageSquareText,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
  X,
} from "lucide-react";
import {useMemo, useState} from "react";
import PageHeader from "../PageHeader.jsx";
import {getClientMessageName} from "../../utils/clientMessageName.js";

function MessageTemplatesPage({
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
  const [sendingTemplate, setSendingTemplate] = useState(null);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [clientQuery, setClientQuery] = useState("");
  const [sendChannel, setSendChannel] = useState("SMS");
  const [filters, setFilters] = useState({
    query: "",
    channel: "",
    language: "",
    audience: "",
  });
  const filteredTemplates = useMemo(() => {
    const query = filters.query.trim().toLowerCase();

    return templates.filter((template) => {
      const matchesQuery =
        !query ||
        [template.name, template.subject, template.body]
          .join(" ")
          .toLowerCase()
          .includes(query);

      return (
        matchesQuery &&
        (!filters.channel || template.channel === filters.channel) &&
        (!filters.language || template.language === filters.language) &&
        (!filters.audience || template.audience === filters.audience)
      );
    });
  }, [filters, templates]);

  const setFilter = (name, value) => {
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

  return (
    <section className="catalog-page message-templates-page">
      <PageHeader
        actions={
          <button className="add-visit-button" type="button" onClick={onAdd}>
            <Plus size={18} />
            Добавить шаблон
          </button>
        }
        description={`${filteredTemplates.length} из ${templates.length} шаблонов`}
        title="Шаблоны сообщений"
      />

      <div className="message-template-filters">
        <label className="clients-search">
          <Search size={16} />
          <input
            value={filters.query}
            onChange={(event) => setFilter("query", event.target.value)}
            placeholder="Поиск шаблона"
          />
        </label>
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
      </div>
      {preferredClient && (
        <div className="preferred-message-client">
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
      )}

      <div className="catalog-grid message-template-grid">
        {filteredTemplates.map((template) => {
          const Icon = template.channel === "Email" ? Mail : MessageSquareText;

          return (
            <article
              className="catalog-card message-template-card"
              key={template.id}>
              <div className="message-template-card-header">
                <Icon size={18} />
                <div>
                  <h3>{template.name}</h3>
                  <span>
                    {template.channel} · {template.language} ·{" "}
                    {template.audience}
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
                  onClick={() => copyText(template)}>
                  <Copy size={15} />
                </button>
                <button
                  aria-label="Отправить клиенту"
                  className="template-icon-button template-send-button"
                  title="Отправить клиенту"
                  type="button"
                  onClick={() => openSendDialog(template)}>
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
        })}
      </div>
      {filteredTemplates.length === 0 && (
        <div className="clients-empty">
          <strong>Шаблоны не найдены</strong>
          <span>Измените фильтры или добавьте новый шаблон.</span>
        </div>
      )}
      {sendingTemplate && (
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
      )}
    </section>
  );
}

export default MessageTemplatesPage;
