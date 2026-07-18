import {useEffect, useMemo, useState} from "react";
import {LoyaltyCard} from "../LoyaltyCardPreview.jsx";
import {
  cardLanguageOptions,
  designPreviewCard,
  getCardLanguage,
  getLoyaltyTierForCard as getTierForCard,
  getTierProgressInfo,
  physicalCardTiers,
  pluralizeVisits,
} from "../../utils/loyaltyCardDesign.jsx";
import {
  correctLoyaltyBalance,
  createClientLoyaltyCard,
  createLoyaltyRewardTemplate,
  deleteLoyaltyCard,
  deleteLoyaltyRewardTemplate,
  earnLoyaltyStamp,
  fetchLoyaltyCards,
  fetchLoyaltyRewardTemplates,
  redeemLoyaltyReward,
  reissueLoyaltyLink,
  updateLoyaltyRewardTemplate,
  updateLoyaltyCardLanguage,
  updateLoyaltyCardStatus,
} from "../../api/loyalty.js";
import RowActionMenuPortal from "../RowActionMenuPortal.jsx";
import LoyaltyQrCode from "../LoyaltyQrCode.jsx";
import PageHeader from "../PageHeader.jsx";
import AppIcon from "../ui/AppIcon.jsx";
import {Button, IconButton} from "../ui/index.js";
import {useRowActionMenu} from "../../hooks/useRowActionMenu.js";

const getCardProgress = (card) =>
  Math.min(100, Math.round(((card?.stamps ?? 0) / Math.max(1, card?.targetStamps ?? 6)) * 100));

const getClientInitials = (client) => {
  const source = String(client?.name || client?.smsName || client?.phone || "Клиент").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (!parts.length) return "К";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
};

const formatCardDate = (card) => {
  const value = card?.createdAt || card?.issuedAt || card?.updatedAt || card?.lastTransaction?.createdAt;
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("ru-RU");
};

const clubTabs = [
  {id: "cards", label: "Карты клиентов", icon: "shield"},
  {id: "design", label: "Дизайн карт", icon: "sparkles"},
  {id: "rewards", label: "Подарки", icon: "gift"},
  {id: "stats", label: "Статистика", icon: "star"},
];

const emptyRewardTemplateForm = {
  active: true,
  description: "",
  durationMin: "",
  expiresAfterDays: "",
  name: "",
  requiresOwnerApproval: false,
  rewardType: "gift",
  tier: "member",
  value: "",
  weight: "1",
};

const normalizeRewardTemplateForm = (template) => ({
  active: template?.active !== false,
  description: template?.description || "",
  durationMin: template?.durationMin ?? "",
  expiresAfterDays: template?.expiresAfterDays ?? "",
  name: template?.name || "",
  requiresOwnerApproval: Boolean(template?.requiresOwnerApproval),
  rewardType: template?.rewardType || "gift",
  tier: String(template?.tier || "member").toLowerCase() === "royalty" ? "royal" : String(template?.tier || "member").toLowerCase(),
  value: template?.value ?? "",
  weight: template?.weight ?? "1",
});

const buildRewardTemplatePayload = (form) => ({
  active: Boolean(form.active),
  description: form.description.trim() || null,
  durationMin: form.durationMin === "" ? null : Number(form.durationMin),
  expiresAfterDays: form.expiresAfterDays === "" ? null : Number(form.expiresAfterDays),
  name: form.name.trim(),
  requiresOwnerApproval: Boolean(form.requiresOwnerApproval),
  rewardType: form.rewardType.trim() || "gift",
  tier: form.tier,
  value: form.value === "" ? null : Number(form.value),
  weight: Math.max(1, Math.trunc(Number(form.weight) || 1)),
});

function ClubCardMenu({
  card,
  isOpen,
  onCopy,
  onDelete,
  onManualAdjust,
  onOpenQr,
  onRedeem,
  onReissue,
  onStatus,
  publicUrl,
  setOpenMenuId,
}) {
  const {menuRef, menuStyle, triggerRef} = useRowActionMenu({
    isOpen,
    setOpenMenuId,
  });

  const closeAndRun = (callback) => {
    setOpenMenuId(null);
    callback();
  };
  const isRewardActionAvailable = card.isActive && Boolean(card.rewardAvailable) &&
    Number(card.stamps || 0) >= Number(card.targetStamps || 6);

  return (
    <div className="club-card-menu" onClick={(event) => event.stopPropagation()}>
      <IconButton
        ref={triggerRef}
        aria-label="Действия карты"
        aria-expanded={isOpen}
        className={isOpen ? "is-active" : ""}
        icon="more"
        label="Действия карты"
        size="sm"
        type="button"
        variant="ghost"
        onClick={() => setOpenMenuId(isOpen ? null : card.id)}>
      </IconButton>

      <RowActionMenuPortal isOpen={isOpen} menuRef={menuRef} menuStyle={menuStyle}>
        <Button
          className="row-action-menu-item"
          disabled={!isRewardActionAvailable}
          fullWidth
          leftIcon="gift"
          size="sm"
          type="button"
          variant="ghost"
          onClick={() => closeAndRun(onRedeem)}>
          Награда
        </Button>
        <Button
          className="row-action-menu-item"
          disabled={!card.isActive}
          fullWidth
          leftIcon="edit"
          size="sm"
          type="button"
          variant="ghost"
          onClick={() => closeAndRun(onManualAdjust)}>
          Начислить / списать
        </Button>
        <Button
          className="row-action-menu-item"
          fullWidth
          leftIcon="link"
          size="sm"
          type="button"
          variant="ghost"
          onClick={() => closeAndRun(onReissue)}>
          Перевыпустить ссылку
        </Button>
        <Button
          className="row-action-menu-item"
          disabled={!publicUrl || !card.isActive}
          fullWidth
          leftIcon="copy"
          size="sm"
          type="button"
          variant="ghost"
          onClick={() => closeAndRun(onCopy)}>
          Скопировать ссылку
        </Button>
        <Button
          className="row-action-menu-item"
          disabled={!publicUrl || !card.isActive}
          fullWidth
          leftIcon="qr"
          size="sm"
          type="button"
          variant="ghost"
          onClick={() => closeAndRun(onOpenQr)}>
          Показать QR
        </Button>
        {publicUrl ? (
          <a href={publicUrl} rel="noreferrer" target="_blank">
            <AppIcon name="external" size="sm" />
            Открыть карту
          </a>
        ) : null}
        <Button
          className="row-action-menu-item"
          fullWidth
          leftIcon="power"
          size="sm"
          type="button"
          variant="ghost"
          onClick={() => closeAndRun(onStatus)}>
          {card.isActive ? "Отключить карту" : "Включить карту"}
        </Button>
        <Button
          className="danger row-action-menu-item"
          fullWidth
          leftIcon="trash"
          size="sm"
          type="button"
          variant="ghost"
          onClick={() => closeAndRun(onDelete)}>
          Удалить карту
        </Button>
      </RowActionMenuPortal>
    </div>
  );
}

export default function ClubPage({clients = [], pushNotification}) {
  const [cards, setCards] = useState([]);
  const [selectedCardId, setSelectedCardId] = useState(null);
  const [activeTab, setActiveTab] = useState("cards");
  const [createdPublicUrls, setCreatedPublicUrls] = useState({});
  const [newCardLanguage, setNewCardLanguage] = useState("ru");
  const [newClientId, setNewClientId] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [reward, setReward] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [visibleQrCardId, setVisibleQrCardId] = useState(null);
  const [openCardMenuId, setOpenCardMenuId] = useState(null);
  const [previewTierId, setPreviewTierId] = useState(null);
  const [manualAdjustmentCardId, setManualAdjustmentCardId] = useState(null);
  const [manualAdjustmentMode, setManualAdjustmentMode] = useState("earn");
  const [manualAdjustmentAmount, setManualAdjustmentAmount] = useState("1");
  const [manualAdjustmentDescription, setManualAdjustmentDescription] = useState("");
  const [manualAdjustmentSaving, setManualAdjustmentSaving] = useState(false);
  const [rewardTemplates, setRewardTemplates] = useState([]);
  const [rewardTemplatesLoading, setRewardTemplatesLoading] = useState(false);
  const [rewardTemplateSaving, setRewardTemplateSaving] = useState(false);
  const [editingRewardTemplateId, setEditingRewardTemplateId] = useState(null);
  const [rewardTemplateForm, setRewardTemplateForm] = useState(emptyRewardTemplateForm);
  const selectedCard = useMemo(
    () => cards.find((card) => card.id === selectedCardId) ?? cards[0] ?? null,
    [cards, selectedCardId],
  );
  const qrCard = useMemo(
    () => cards.find((card) => card.id === visibleQrCardId) ?? null,
    [cards, visibleQrCardId],
  );
  const manualAdjustmentCard = useMemo(
    () => cards.find((card) => card.id === manualAdjustmentCardId) ?? null,
    [cards, manualAdjustmentCardId],
  );
  const previewTier = useMemo(
    () => physicalCardTiers.find((tier) => tier.id === previewTierId) ?? null,
    [previewTierId],
  );
  const qrPublicUrl = qrCard
    ? createdPublicUrls[qrCard.id] || qrCard.publicUrl || ""
    : "";

  const cardClientIds = useMemo(
    () => new Set(cards.filter((card) => card.isActive).map((card) => card.clientId)),
    [cards],
  );

  const clientsWithoutCards = useMemo(
    () => clients.filter((client) => !cardClientIds.has(client.id)),
    [cardClientIds, clients],
  );

  const stats = useMemo(() => {
    const active = cards.filter((card) => card.isActive).length;
    const archived = cards.filter((card) => !card.isActive || card.archivedAt).length;
    const rewards = cards.reduce(
      (total, card) => total + (Number(card.chestCounts?.available) || 0) + (Number(card.rewardCounts?.available) || 0),
      0,
    );
    const stamps = cards.reduce((total, card) => total + (Number(card.stamps) || 0), 0);
    const lifetimeVisits = cards.reduce((total, card) => total + (Number(card.lifetimeVisits) || 0), 0);
    const tiers = cards.reduce((acc, card) => {
      const tier = getTierForCard(card).id;
      acc[tier] = (acc[tier] || 0) + 1;
      return acc;
    }, {});
    const openedGifts = cards.reduce((total, card) => total + (Number(card.rewardCounts?.redeemed) || 0), 0);
    return {active, archived, lifetimeVisits, openedGifts, rewards, stamps, tiers, total: cards.length};
  }, [cards]);

  const loadCards = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetchLoyaltyCards({reward, search, status});
      const items = response?.data?.items ?? [];
      setCards(items);
      setSelectedCardId((current) =>
        current && items.some((card) => card.id === current) ? current : items[0]?.id ?? null,
      );
    } catch (err) {
      setError(err.message || "Не удалось загрузить Club");
    } finally {
      setLoading(false);
    }
  };

  const loadRewardTemplates = async () => {
    setRewardTemplatesLoading(true);
    try {
      const response = await fetchLoyaltyRewardTemplates();
      setRewardTemplates(response?.data?.items ?? []);
    } catch (err) {
      notify("Подарки не загрузились", err.message || "Не удалось получить шаблоны подарков");
    } finally {
      setRewardTemplatesLoading(false);
    }
  };

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      loadCards();
    }, 120);
    return () => window.clearTimeout(loadTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reward, search, status]);

  const notify = (title, message = "") => {
    pushNotification?.({message, title});
  };

  useEffect(() => {
    if (activeTab === "rewards") {
      const loadTimer = window.setTimeout(() => {
        loadRewardTemplates();
      }, 120);
      return () => window.clearTimeout(loadTimer);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const refreshAfterAction = async (response) => {
    const card = response?.data?.card ?? null;
    const transaction = response?.data?.transaction ?? null;
    const publicUrl = response?.data?.publicUrl || card?.publicUrl || "";
    if (card?.id && publicUrl) {
      setCreatedPublicUrls((current) => ({...current, [card.id]: publicUrl}));
    }
    if (card?.id) {
      setCards((current) =>
        current.map((item) =>
          item.id === card.id
            ? {
                ...item,
                ...card,
                client: card.client || item.client,
                lastTransaction: transaction || card.lastTransaction || item.lastTransaction,
                publicUrl: publicUrl || card.publicUrl || item.publicUrl,
              }
            : item,
        ),
      );
      setSelectedCardId(card.id);
    }
    await loadCards();
  };

  const applyLoyaltyCardResponse = (response) => {
    const card = response?.data?.card ?? null;
    const transaction = response?.data?.transaction ?? null;
    const publicUrl = response?.data?.publicUrl || card?.publicUrl || "";

    if (card?.id && publicUrl) {
      setCreatedPublicUrls((current) => ({...current, [card.id]: publicUrl}));
    }
    if (!card?.id) return;

    setCards((current) =>
      current.map((item) =>
        item.id === card.id
          ? {
              ...item,
              ...card,
              client: card.client || item.client,
              lastTransaction: transaction || card.lastTransaction || item.lastTransaction,
              publicUrl: publicUrl || card.publicUrl || item.publicUrl,
            }
          : item,
      ),
    );
    setSelectedCardId(card.id);
  };

  const handleCreate = async () => {
    const clientId = Number(newClientId);
    if (!clientId) return;
    const response = await createClientLoyaltyCard(clientId, {cardLanguage: newCardLanguage});
    await refreshAfterAction(response);
    setNewClientId("");
    notify("Карта создана", "Персональная ссылка доступна в Club");
  };

  const handleRedeem = async (card) => {
    if (!card.rewardAvailable && !card.chestCounts?.available && !card.rewardCounts?.available) return;
    if (!window.confirm("Использовать старую награду и перевыпустить карту? Для новых подарков используйте меню подарков клиента.")) return;
    await refreshAfterAction(await redeemLoyaltyReward(card.id, {
      description: "Использование награды NUAR Club",
    }));
  };

  const openManualAdjustment = (card) => {
    setManualAdjustmentCardId(card.id);
    setManualAdjustmentMode("earn");
    setManualAdjustmentAmount("1");
    setManualAdjustmentDescription("");
  };

  const closeManualAdjustment = () => {
    if (manualAdjustmentSaving) return;
    setManualAdjustmentCardId(null);
    setManualAdjustmentMode("earn");
    setManualAdjustmentAmount("1");
    setManualAdjustmentDescription("");
  };

  const handleManualAdjustmentSubmit = async (event) => {
    event.preventDefault();
    if (!manualAdjustmentCard) return;

    const rawAmount = Number(manualAdjustmentAmount);
    const units = Math.abs(Math.trunc(rawAmount));
    const description = manualAdjustmentDescription.trim();

    if (!Number.isInteger(rawAmount) || rawAmount < 1 || units < 1) {
      notify("Укажите количество отметок", "Например 1 или 2");
      return;
    }

    const fallbackDescription = manualAdjustmentMode === "writeoff"
      ? "Ручное списание отметок"
      : "Ручное начисление визита";
    const operationDescription = description || fallbackDescription;

    setManualAdjustmentSaving(true);
    try {
      let response = null;
      if (manualAdjustmentMode === "writeoff") {
        response = await correctLoyaltyBalance(manualAdjustmentCard.id, {
          amount: -units,
          description: operationDescription,
        });
        applyLoyaltyCardResponse(response);
      } else {
        for (let index = 0; index < units; index += 1) {
          response = await earnLoyaltyStamp(manualAdjustmentCard.id, {
            description: units > 1
              ? `${operationDescription} (${index + 1}/${units})`
              : operationDescription,
          });
          applyLoyaltyCardResponse(response);
        }
      }
      const savedMode = manualAdjustmentMode;
      const savedClientName = manualAdjustmentCard.client?.name || "";
      setManualAdjustmentCardId(null);
      setManualAdjustmentMode("earn");
      setManualAdjustmentAmount("1");
      setManualAdjustmentDescription("");
      notify(
        savedMode === "writeoff" ? "Отметки списаны" : "Отметки начислены",
        savedClientName,
      );
      loadCards().catch((err) => {
        notify("Club не обновился", err.message || "Обновите страницу, если отметка не видна");
      });
    } catch (err) {
      notify("Операция не сохранена", err.message || "Не удалось изменить отметки карты");
    } finally {
      setManualAdjustmentSaving(false);
    }
  };

  const handleReissue = async (card) => {
    if (!window.confirm("Старая ссылка перестанет работать. Баланс и история карты сохранятся")) {
      return;
    }
    await refreshAfterAction(await reissueLoyaltyLink(card.id));
    notify("Ссылка перевыпущена", "Старая ссылка больше не работает");
  };

  const handleStatus = async (card) => {
    await refreshAfterAction(await updateLoyaltyCardStatus(card.id, {
      isActive: !card.isActive,
    }));
  };

  const handleLanguageChange = async (card, cardLanguage) => {
    if (!card?.id || getCardLanguage(card) === cardLanguage) return;
    await refreshAfterAction(await updateLoyaltyCardLanguage(card.id, {cardLanguage}));
    notify("Язык карты изменён");
  };

  const handleDeleteCard = async (card) => {
    const clientName = card?.client?.name || "клиента";
    if (!window.confirm(`Удалить карту ${clientName}? История операций этой карты тоже будет удалена.`)) {
      return;
    }
    try {
      await deleteLoyaltyCard(card.id);
      setCreatedPublicUrls((current) => {
        const next = {...current};
        delete next[card.id];
        return next;
      });
      setVisibleQrCardId((current) => (current === card.id ? null : current));
      await loadCards();
      notify("Карта удалена", clientName);
    } catch (err) {
      notify("Карта не удалена", err.message || "Не удалось удалить карту");
    }
  };

  const handleCopy = async (card) => {
    const publicUrl = createdPublicUrls[card.id] || card.publicUrl;
    if (!publicUrl) return;
    await navigator.clipboard?.writeText(publicUrl);
    notify("Ссылка скопирована");
  };

  const resetRewardTemplateForm = () => {
    setEditingRewardTemplateId(null);
    setRewardTemplateForm(emptyRewardTemplateForm);
  };

  const updateRewardTemplateField = (field, value) => {
    setRewardTemplateForm((current) => ({...current, [field]: value}));
  };

  const handleRewardTemplateEdit = (template) => {
    setEditingRewardTemplateId(template.id);
    setRewardTemplateForm(normalizeRewardTemplateForm(template));
  };

  const handleRewardTemplateDelete = async (template) => {
    if (!window.confirm(`Удалить подарок "${template.name}"? Уже выданные подарки у клиентов сохранятся.`)) {
      return;
    }
    try {
      await deleteLoyaltyRewardTemplate(template.id);
      if (editingRewardTemplateId === template.id) {
        resetRewardTemplateForm();
      }
      await loadRewardTemplates();
      notify("Подарок удалён", template.name);
    } catch (err) {
      notify("Подарок не удалён", err.message || "Не удалось удалить шаблон подарка");
    }
  };

  const handleRewardTemplateSubmit = async (event) => {
    event.preventDefault();
    const payload = buildRewardTemplatePayload(rewardTemplateForm);

    if (!payload.name) {
      notify("Название подарка обязательно");
      return;
    }
    if (payload.durationMin !== null && (!Number.isFinite(payload.durationMin) || payload.durationMin < 0)) {
      notify("Проверьте длительность", "Укажите минуты или оставьте поле пустым");
      return;
    }
    if (payload.expiresAfterDays !== null && (!Number.isFinite(payload.expiresAfterDays) || payload.expiresAfterDays < 0)) {
      notify("Проверьте срок действия", "Укажите дни или оставьте поле пустым");
      return;
    }
    if (payload.value !== null && !Number.isFinite(payload.value)) {
      notify("Проверьте значение", "Сумма или процент должны быть числом");
      return;
    }

    setRewardTemplateSaving(true);
    try {
      if (editingRewardTemplateId) {
        await updateLoyaltyRewardTemplate(editingRewardTemplateId, payload);
        notify("Подарок обновлён", payload.name);
      } else {
        await createLoyaltyRewardTemplate(payload);
        notify("Подарок добавлен", payload.name);
      }
      resetRewardTemplateForm();
      await loadRewardTemplates();
    } catch (err) {
      notify("Подарок не сохранён", err.message || "Не удалось сохранить шаблон подарка");
    } finally {
      setRewardTemplateSaving(false);
    }
  };

  return (
    <section className="club-page">
      <PageHeader
        className="club-page-header"
        description="Центр управления электронными картами лояльности NUAR Club"
        title="Club"
        headerActions={
          <button className="club-icon-button" disabled={loading} type="button" onClick={loadCards}>
            <AppIcon name="refresh" size="sm" />
          </button>
        }
      />

      <div className="club-summary">
        {[
          {icon: "shield", label: "Всего карт", value: stats.total},
          {icon: "sparkles", label: "Активные", value: stats.active},
          {icon: "gift", label: "Награды", value: stats.rewards},
          {icon: "star", label: "Отметки", value: stats.stamps},
        ].map((item) => (
            <article key={item.label}>
              <span className="club-summary-icon"><AppIcon name={item.icon} size="sm" /></span>
              <div>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            </article>
        ))}
      </div>

      <div className="club-tabs">
        {clubTabs.map((tab) => {
          const badge = tab.id === "cards" ? stats.total : null;
          return (
            <button
              className={activeTab === tab.id ? "is-active" : ""}
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
            >
              <AppIcon name={tab.icon} size="sm" />
              <span>{tab.label}</span>
              {badge ? <em>{badge}</em> : null}
            </button>
          );
        })}
      </div>

      {activeTab === "cards" ? (
        <>
          <div className="club-create-panel">
            <div>
              <strong>Новая карта</strong>
              <span>Выберите клиента без карты и создайте персональную ссылку.</span>
            </div>
            <select value={newClientId} onChange={(event) => setNewClientId(event.target.value)}>
              <option value="">Клиент</option>
              {clientsWithoutCards.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name || client.phone || `Клиент ${client.id}`}
                </option>
              ))}
            </select>
            <select value={newCardLanguage} onChange={(event) => setNewCardLanguage(event.target.value)}>
              {cardLanguageOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <button disabled={!newClientId || loading} type="button" onClick={handleCreate}>
              <AppIcon name="gift" size="sm" />
              Создать карту
            </button>
          </div>

          <div className="club-toolbar">
            <label className="club-search">
              <AppIcon name="search" size="sm" />
              <input
                placeholder="Поиск по клиенту или телефону"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="all">Все статусы</option>
              <option value="active">Активные</option>
              <option value="archived">Архив</option>
              <option value="inactive">Отключённые</option>
            </select>
            <select value={reward} onChange={(event) => setReward(event.target.value)}>
              <option value="all">Все награды</option>
              <option value="available">Награда доступна</option>
            </select>
          </div>
        </>
      ) : activeTab === "design" ? (
        <section className="club-physical-designs">
          <div className="club-physical-title">
            <span>Дизайн физической карты</span>
            <strong>NUAR Club levels</strong>
          </div>
          <div className="club-physical-catalog">
            {physicalCardTiers.map((tier) => {
              const tierInfo = getTierProgressInfo(tier);
              const [nextCaption, nextValue] = tierInfo.next.includes(" осталось ")
                ? tierInfo.next.split(" осталось ")
                : [tierInfo.next, ""];

              return (
                <article
                  className="club-physical-tier"
                  key={tier.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setPreviewTierId(tier.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setPreviewTierId(tier.id);
                    }
                  }}>
                  <LoyaltyCard
                    card={{
                      ...designPreviewCard,
                      lifetimeVisits: tier.minVisits,
                    }}
                    tier={tier}
                  />
                  <div className="club-physical-level-info">
                    <span>
                      <small className={`club-tier-badge is-${tier.id}`}>{tier.badge}</small>
                    </span>
                    <p>{tier.threshold}</p>
                  </div>
                  <ul className="club-physical-benefits">
                    {tier.benefits?.map((benefit) => (
                      <li key={benefit}>
                        <AppIcon name="gift" size="sm" />
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="club-physical-next">
                    {tier.description ? <em>{tier.description}</em> : <small>{nextCaption}</small>}
                    <strong>{nextValue || tierInfo.next}</strong>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : activeTab === "rewards" ? (
        <section className="club-reward-manager">
          <div className="club-physical-title">
            <span>Подарки NUAR Club</span>
            <strong>Шаблоны выпадения из сундуков</strong>
          </div>
          <form className="club-reward-template-form" onSubmit={handleRewardTemplateSubmit}>
            <select
              aria-label="Уровень карты"
              disabled={rewardTemplateSaving}
              value={rewardTemplateForm.tier}
              onChange={(event) => updateRewardTemplateField("tier", event.target.value)}
            >
              {physicalCardTiers.map((tier) => (
                <option key={tier.id} value={tier.id}>{tier.badge}</option>
              ))}
            </select>
            <input
              placeholder="Название подарка"
              disabled={rewardTemplateSaving}
              value={rewardTemplateForm.name}
              onChange={(event) => updateRewardTemplateField("name", event.target.value)}
            />
            <input
              placeholder="Описание"
              disabled={rewardTemplateSaving}
              value={rewardTemplateForm.description}
              onChange={(event) => updateRewardTemplateField("description", event.target.value)}
            />
            <input
              aria-label="Вес выпадения"
              min="1"
              placeholder="Вес"
              step="1"
              type="number"
              disabled={rewardTemplateSaving}
              value={rewardTemplateForm.weight}
              onChange={(event) => updateRewardTemplateField("weight", event.target.value)}
            />
            <input
              aria-label="Срок действия в днях"
              min="0"
              placeholder="Дней"
              step="1"
              type="number"
              disabled={rewardTemplateSaving}
              value={rewardTemplateForm.expiresAfterDays}
              onChange={(event) => updateRewardTemplateField("expiresAfterDays", event.target.value)}
            />
            <label>
              <input
                checked={rewardTemplateForm.requiresOwnerApproval}
                disabled={rewardTemplateSaving}
                type="checkbox"
                onChange={(event) => updateRewardTemplateField("requiresOwnerApproval", event.target.checked)}
              />
              Владелец
            </label>
            <label>
              <input
                checked={rewardTemplateForm.active}
                disabled={rewardTemplateSaving}
                type="checkbox"
                onChange={(event) => updateRewardTemplateField("active", event.target.checked)}
              />
              Активен
            </label>
            <button disabled={rewardTemplateSaving} type="submit">
              {rewardTemplateSaving ? "Сохраняю..." : editingRewardTemplateId ? "Сохранить" : "Добавить"}
            </button>
            {editingRewardTemplateId ? (
              <button disabled={rewardTemplateSaving} type="button" onClick={resetRewardTemplateForm}>
                Отмена
              </button>
            ) : null}
          </form>

          <div className="club-reward-template-list">
            {rewardTemplates.map((template) => {
              const tierId = String(template.tier || "member").toLowerCase() === "royalty"
                ? "royal"
                : String(template.tier || "member").toLowerCase();
              const tier = physicalCardTiers.find((item) => item.id === tierId) || physicalCardTiers[0];
              return (
                <article className={`club-reward-template-row ${template.active ? "" : "is-muted"}`} key={template.id}>
                  <span className={`club-tier-badge is-${tier.id}`}>{tier.badge}</span>
                  <div>
                    <strong>{template.name}</strong>
                    <small>{template.description || "Без описания"}</small>
                  </div>
                  <span>{template.requiresOwnerApproval ? "Требует владельца" : "Можно выдать автоматически"}</span>
                  <em>Вес {template.weight || 1}</em>
                  <em>{template.expiresAfterDays ? `${template.expiresAfterDays} дн.` : "Без срока"}</em>
                  <em>{template.active ? "Активен" : "Отключён"}</em>
                  <button type="button" onClick={() => handleRewardTemplateEdit(template)}>
                    <AppIcon name="edit" size="xs" />
                    Правка
                  </button>
                  <button className="is-danger" type="button" onClick={() => handleRewardTemplateDelete(template)}>
                    <AppIcon name="trash" size="xs" />
                    Удалить
                  </button>
                </article>
              );
            })}
            {rewardTemplatesLoading ? (
              <p className="club-empty-text">Загружаю подарки...</p>
            ) : null}
            {!rewardTemplatesLoading && !rewardTemplates.length ? (
              <p className="club-empty-text">Шаблонов подарков пока нет. Если список пустой, сундуки будут использовать системный подарок по умолчанию.</p>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="club-physical-designs">
          <div className="club-physical-title">
            <span>Статистика NUAR Club</span>
            <strong>Учет карт, визитов и подарков</strong>
          </div>
          <div className="club-stats-overview">
            {[
              {icon: "shield", label: "Визиты", value: stats.lifetimeVisits, note: "Все визиты NUAR Club"},
              {icon: "gift", label: "К выдаче", value: stats.rewards, note: "Сундуки и подарки"},
              {icon: "sparkles", label: "Выдано", value: stats.openedGifts, note: "Использованные подарки"},
              {icon: "star", label: "Архив", value: stats.archived, note: "Закрытые карты"},
            ].map((item) => (
                <article className="club-stat-tile" key={item.label}>
                  <span><AppIcon name={item.icon} size="sm" /></span>
                  <div>
                    <small>{item.label}</small>
                    <strong>{item.value}</strong>
                    <em>{item.note}</em>
                  </div>
                </article>
            ))}
          </div>
          <div className="club-stats-grid">
            <article className="club-stats-panel">
              <div className="club-stats-panel-head">
                <span>Уровни</span>
                <strong>Распределение карт</strong>
              </div>
              <div className="club-stats-list">
                {physicalCardTiers.map((tier) => (
                  <article className="club-stats-list-row" key={tier.id}>
                    <span className={`club-tier-badge is-${tier.id}`}>{tier.badge}</span>
                    <strong>{stats.tiers[tier.id] || 0}</strong>
                    <em>{tier.threshold}</em>
                  </article>
                ))}
              </div>
            </article>
            <article className="club-stats-panel">
              <div className="club-stats-panel-head">
                <span>Клиенты</span>
                <strong>Прогресс и подарки</strong>
              </div>
              <div className="club-stats-list">
                {cards.map((card) => {
                  const tier = getTierForCard(card);
                  const gifts = (Number(card.chestCounts?.available) || 0) + (Number(card.rewardCounts?.available) || 0);
                  return (
                    <article className="club-stats-list-row is-client" key={card.id}>
                      <span className="club-client-avatar">{getClientInitials(card.client)}</span>
                      <div>
                        <strong>{card.client?.name || "Клиент"}</strong>
                        <em>{pluralizeVisits(card.lifetimeVisits || 0)} · {gifts ? `${gifts} подарков` : "без подарков"}</em>
                      </div>
                      <span className={`club-tier-badge is-${tier.id}`}>{tier.badge}</span>
                      <b>{card.stamps}/{card.targetStamps}</b>
                    </article>
                  );
                })}
                {!cards.length ? <p className="club-empty-text">Карт для статистики пока нет.</p> : null}
              </div>
            </article>
          </div>
        </section>
      )}

      {error ? <p className="club-error">{error}</p> : null}

      {activeTab === "cards" ? <div className={`club-layout ${selectedCard ? "has-selected-card" : ""}`}>
        <div className="club-list">
          {cards.length ? (
            <div className="club-card-table-head">
              <span>Клиент</span>
              <span>Статус</span>
              <span>Прогресс</span>
              <span>Сундуки</span>
              <span>Подарки</span>
              <span>Дата карты</span>
              <span>Язык</span>
              <span />
            </div>
          ) : null}
          {cards.map((card) => {
            const publicUrl = createdPublicUrls[card.id] || card.publicUrl || "";
            const progress = getCardProgress(card);
            const tier = getTierForCard(card);
            const unopenedGifts = Number(card.chestCounts?.available) || 0;
            const openedGifts =
              (Number(card.rewardCounts?.available) || 0) +
              (Number(card.rewardCounts?.redeemed) || Number(card.rewardCounts?.used) || 0);
            return (
              <article
                className={`club-card ${selectedCard?.id === card.id ? "is-selected" : ""}`}
                key={card.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedCardId(card.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedCardId(card.id);
                  }
                }}>
                <div className="club-card-main">
                  <span className="club-client-avatar">{getClientInitials(card.client)}</span>
                  <div>
                    <b>{card.client?.name || "Клиент"}</b>
                    <small>{card.client?.phone || card.client?.smsName || "Без телефона"}</small>
                  </div>
                </div>
                <div className="club-card-status">
                  <span className={`club-tier-badge is-${tier.id}`}>{tier.badge}</span>
                  <span className={card.isActive ? "is-active" : "is-archived"}>
                    {card.isActive ? "Активна" : "Архив"}
                  </span>
                </div>
                <div className="club-card-progress-cell">
                  <strong>{card.stamps}/{card.targetStamps}</strong>
                  <div className="club-card-progress" aria-label={`Прогресс ${card.stamps} из ${card.targetStamps}`}>
                    <span style={{width: `${progress}%`}} />
                  </div>
                </div>
                <div className="club-card-meta is-unopened">
                  <span className="is-purple"><AppIcon name="gift" size="xs" /> {unopenedGifts}</span>
                </div>
                <div className="club-card-meta is-opened">
                  <span className="is-green"><AppIcon name="gift" size="xs" /> {openedGifts}</span>
                </div>
                <div className="club-card-date">
                  <span>{formatCardDate(card)}</span>
                </div>
                <div className="club-card-language" onClick={(event) => event.stopPropagation()}>
                  <select
                    aria-label="Язык карты"
                    className="club-card-language-select is-full"
                    value={getCardLanguage(card)}
                    onChange={(event) => handleLanguageChange(card, event.target.value)}
                  >
                    {cardLanguageOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <select
                    aria-label="Язык карты"
                    className="club-card-language-select is-short"
                    value={getCardLanguage(card)}
                    onChange={(event) => handleLanguageChange(card, event.target.value)}
                  >
                    {cardLanguageOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.value.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
                <div className="club-card-actions" aria-label="Действия карты">
                  <ClubCardMenu
                    card={card}
                    isOpen={openCardMenuId === card.id}
                    onCopy={() => handleCopy(card)}
                    onDelete={() => handleDeleteCard(card)}
                    onManualAdjust={() => openManualAdjustment(card)}
                    onOpenQr={() => {
                      setVisibleQrCardId((current) => (current === card.id ? null : card.id));
                      setSelectedCardId(card.id);
                    }}
                    onRedeem={() => handleRedeem(card)}
                    onReissue={() => handleReissue(card)}
                    onStatus={() => handleStatus(card)}
                    publicUrl={publicUrl}
                    setOpenMenuId={setOpenCardMenuId}
                  />
                </div>
              </article>
            );
          })}
          {!cards.length ? (
            <div className="club-empty">
              <AppIcon name="sparkles" size="md" />
              <strong>Карт пока нет</strong>
              <span>Создайте первую карту NUAR Club для клиента.</span>
            </div>
          ) : null}
        </div>
      </div> : null}

      {previewTier ? (
        <div
          className="club-card-style-modal-backdrop"
          role="presentation"
          onClick={() => setPreviewTierId(null)}>
          <div
            aria-label={`Стиль карты ${previewTier.displayName}`}
            aria-modal="true"
            className="club-card-style-modal"
            role="dialog"
            onClick={(event) => event.stopPropagation()}>
            <div className="club-card-style-modal-head">
              <span>
                <small>Стиль карты</small>
                <strong>{previewTier.title}</strong>
              </span>
              <button type="button" onClick={() => setPreviewTierId(null)}>
                Закрыть
              </button>
            </div>
            <LoyaltyCard
              card={{
                ...designPreviewCard,
                lifetimeVisits: previewTier.minVisits,
              }}
              tier={previewTier}
            />
          </div>
        </div>
      ) : null}

      {qrCard && qrPublicUrl ? (
        <div
          className="club-qr-modal-backdrop"
          role="presentation"
          onClick={() => setVisibleQrCardId(null)}>
          <div
            aria-label="QR код карты лояльности"
            aria-modal="true"
            className="club-qr-modal"
            role="dialog"
            onClick={(event) => event.stopPropagation()}>
            <div className="club-qr-modal-head">
              <span>
                <small>QR код карты</small>
                <strong>{qrCard.client?.name || "Клиент"}</strong>
              </span>
              <button type="button" onClick={() => setVisibleQrCardId(null)}>
                Закрыть
              </button>
            </div>
            <div className="club-qr-modal-code">
              <LoyaltyQrCode value={qrPublicUrl} />
            </div>
            <div className="club-qr-modal-actions">
              <button type="button" onClick={() => handleCopy(qrCard)}>
                <AppIcon name="copy" size="sm" />
                Скопировать ссылку
              </button>
              <a href={qrPublicUrl} rel="noreferrer" target="_blank">
                <AppIcon name="external" size="sm" />
                Открыть карту
              </a>
            </div>
          </div>
        </div>
      ) : null}

      {manualAdjustmentCard ? (
        <div
          className="club-adjust-modal-backdrop"
          role="presentation"
          onClick={closeManualAdjustment}>
          <form
            aria-label="Ручное начисление или списание"
            aria-modal="true"
            className="club-adjust-modal"
            role="dialog"
            onClick={(event) => event.stopPropagation()}
            onSubmit={handleManualAdjustmentSubmit}>
            <div className="club-adjust-modal-head">
              <span>
                <small>Ручная операция</small>
                <strong>{manualAdjustmentCard.client?.name || "Клиент"}</strong>
              </span>
              <button
                aria-label="Закрыть"
                className="club-adjust-close"
                disabled={manualAdjustmentSaving}
                type="button"
                onClick={closeManualAdjustment}>
                <AppIcon name="x" size="sm" />
              </button>
            </div>
            <div className="club-adjust-mode" role="group" aria-label="Тип операции">
              <button
                className={manualAdjustmentMode === "earn" ? "is-active" : ""}
                disabled={manualAdjustmentSaving}
                type="button"
                onClick={() => setManualAdjustmentMode("earn")}>
                Начислить
              </button>
              <button
                className={manualAdjustmentMode === "writeoff" ? "is-active" : ""}
                disabled={manualAdjustmentSaving}
                type="button"
                onClick={() => setManualAdjustmentMode("writeoff")}>
                Списать
              </button>
            </div>
            <label className="club-adjust-field">
              <span>Количество отметок</span>
              <input
                min="1"
                step="1"
                type="number"
                value={manualAdjustmentAmount}
                disabled={manualAdjustmentSaving}
                onChange={(event) => setManualAdjustmentAmount(event.target.value)}
              />
            </label>
            <label className="club-adjust-field">
              <span>Причина</span>
              <textarea
                placeholder="Например: компенсация, ручное исправление, возврат отметки"
                rows={4}
                value={manualAdjustmentDescription}
                disabled={manualAdjustmentSaving}
                onChange={(event) => setManualAdjustmentDescription(event.target.value)}
              />
            </label>
            <div className="club-adjust-summary">
              <span>Будет сохранено в истории операций</span>
              <strong>{manualAdjustmentMode === "writeoff" ? "-" : "+"}{Math.abs(Number(manualAdjustmentAmount) || 0)}</strong>
            </div>
            <div className="club-adjust-actions">
              <button disabled={manualAdjustmentSaving} type="button" onClick={closeManualAdjustment}>
                Отмена
              </button>
              <button disabled={manualAdjustmentSaving} type="submit">
                {manualAdjustmentSaving ? "Сохраняю..." : "Сохранить"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
