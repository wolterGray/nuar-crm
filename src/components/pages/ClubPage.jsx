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
  awardLoyaltyGift,
  correctLoyaltyBalance,
  createClientLoyaltyCard,
  createLoyaltyRewardTemplate,
  deleteLoyaltyCard,
  deleteLoyaltyGift,
  deleteLoyaltyRewardTemplate,
  earnLoyaltyStamp,
  fetchLoyaltyCards,
  fetchLoyaltyClubDetails,
  fetchLoyaltyRewardTemplates,
  redeemIssuedLoyaltyReward,
  redeemLoyaltyReward,
  reissueLoyaltyLink,
  updateLoyaltyRewardTemplate,
  updateLoyaltyCardLanguage,
  updateLoyaltyCardStatus,
} from "../../api/loyalty.js";
import "./ClubPage.css";
import RowActionMenuPortal from "../RowActionMenuPortal.jsx";
import LoyaltyQrCode from "../LoyaltyQrCode.jsx";
import PageHeader from "../PageHeader.jsx";
import AppIcon from "../ui/AppIcon.jsx";
import {
  Badge,
  Button,
  Checkbox,
  EmptyState,
  IconButton,
  Input,
  SearchControl,
  Select,
  Textarea,
} from "../ui/index.js";
import {useRowActionMenu} from "../../hooks/useRowActionMenu.js";
import {useBreakpoint} from "../../hooks/useBreakpoint.js";

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
          <a
            className="row-action-menu-item"
            href={publicUrl}
            rel="noreferrer"
            target="_blank"
            onClick={() => setOpenMenuId(null)}
          >
            <AppIcon name="external" size="sm" />
            <span>Открыть карту</span>
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
  const [adjustTab, setAdjustTab] = useState("stamps");
  const [clientRewards, setClientRewards] = useState([]);
  const [clientRewardsLoading, setClientRewardsLoading] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [customGiftName, setCustomGiftName] = useState("");
  const [customGiftDescription, setCustomGiftDescription] = useState("");
  const [giftMode, setGiftMode] = useState("earn");
  const [rewardTemplates, setRewardTemplates] = useState([]);
  const [rewardTemplatesLoading, setRewardTemplatesLoading] = useState(false);
  const [rewardTemplateSaving, setRewardTemplateSaving] = useState(false);
  const [editingRewardTemplateId, setEditingRewardTemplateId] = useState(null);
  const [rewardTemplateForm, setRewardTemplateForm] = useState(emptyRewardTemplateForm);
  const {isMobile} = useBreakpoint();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [expandedTierId, setExpandedTierId] = useState(null);
  const [isTemplateFormOpen, setIsTemplateFormOpen] = useState(false);


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

  const refreshClientRewards = async (cardId) => {
    setClientRewardsLoading(true);
    try {
      const response = await fetchLoyaltyClubDetails(cardId);
      setClientRewards(response?.data?.rewards ?? []);
    } catch (err) {
      notify("Не удалось обновить список подарков", err.message || "");
    } finally {
      setClientRewardsLoading(false);
    }
  };

  const openManualAdjustment = async (card) => {
    setManualAdjustmentCardId(card.id);
    setManualAdjustmentMode("earn");
    setManualAdjustmentAmount("1");
    setManualAdjustmentDescription("");
    setAdjustTab("stamps");
    setClientRewards([]);
    setSelectedTemplateId("");
    setCustomGiftName("");
    setCustomGiftDescription("");
    setGiftMode("earn");

    loadRewardTemplates();

    setClientRewardsLoading(true);
    try {
      const response = await fetchLoyaltyClubDetails(card.id);
      setClientRewards(response?.data?.rewards ?? []);
    } catch (err) {
      notify("Не удалось получить подарки клиента", err.message || "");
    } finally {
      setClientRewardsLoading(false);
    }
  };

  const closeManualAdjustment = () => {
    if (manualAdjustmentSaving) return;
    setManualAdjustmentCardId(null);
    setManualAdjustmentMode("earn");
    setManualAdjustmentAmount("1");
    setManualAdjustmentDescription("");
    setAdjustTab("stamps");
    setClientRewards([]);
    setSelectedTemplateId("");
    setCustomGiftName("");
    setCustomGiftDescription("");
    setGiftMode("earn");
  };

  const handleAwardGift = async () => {
    if (!manualAdjustmentCard) return;
    if (!customGiftName.trim()) {
      notify("Укажите название подарка");
      return;
    }

    setManualAdjustmentSaving(true);
    try {
      const payload = {
        name: customGiftName.trim(),
        description: customGiftDescription.trim(),
        templateId: selectedTemplateId && selectedTemplateId !== "custom" ? Number(selectedTemplateId) : null,
      };
      await awardLoyaltyGift(manualAdjustmentCard.id, payload);
      const savedClientName = manualAdjustmentCard.client?.name || "";
      setManualAdjustmentCardId(null);
      setAdjustTab("stamps");
      setClientRewards([]);
      setSelectedTemplateId("");
      setCustomGiftName("");
      setCustomGiftDescription("");
      setGiftMode("earn");
      notify("Подарок начислен", savedClientName);
      await loadCards();
    } catch (err) {
      notify("Не удалось начислить подарок", err.message || "");
    } finally {
      setManualAdjustmentSaving(false);
    }
  };

  const handleManualAdjustmentSubmit = async (event) => {
    event.preventDefault();
    if (!manualAdjustmentCard) return;

    if (adjustTab === "gifts") {
      if (giftMode === "earn") {
        await handleAwardGift();
      }
      return;
    }

    const rawAmount = Number(manualAdjustmentAmount);
    const units = Math.abs(Math.trunc(rawAmount));
    const description = manualAdjustmentDescription.trim();

    if (!Number.isInteger(rawAmount) || rawAmount < 1 || units < 1) {
      notify("Укажите количество отметок", "Например 1 or 2");
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
      setAdjustTab("stamps");
      setClientRewards([]);
      setSelectedTemplateId("");
      setCustomGiftName("");
      setCustomGiftDescription("");
      setGiftMode("earn");
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
    <section className="club-page-container">
      <PageHeader
        className="club-page-header shrink-0"
        title={
          <span className="flex items-center gap-2">
            <span>NUAR Club</span>
            <span className="text-textMuted text-sm font-normal">({stats.total})</span>
          </span>
        }
        headerActions={
          <IconButton
            disabled={loading}
            icon="refresh"
            label="Обновить карты"
            size="sm"
            type="button"
            variant="ghost"
            onClick={loadCards}
          />
        }
      />

      <div className="club-summary-grid">
        {[
          {icon: "shield", label: "Всего карт", value: stats.total},
          {icon: "sparkles", label: "Активные", value: stats.active},
          {icon: "gift", label: "Награды", value: stats.rewards},
          {icon: "star", label: "Отметки", value: stats.stamps},
        ].map((item) => (
          <article className="club-stat-card" key={item.label}>
            <div className="club-stat-icon-wrap">
              <AppIcon name={item.icon} size="sm" />
            </div>
            <div className="club-stat-content">
              <span className="club-stat-label">{item.label}</span>
              <strong className="club-stat-value">{item.value}</strong>
            </div>
          </article>
        ))}
      </div>

      <nav className="club-page-tabs" role="tablist">
        {clubTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const count = tab.id === "cards" ? stats.total : null;
          return (
            <button
              aria-selected={isActive}
              className={`club-page-tab-btn ${isActive ? "is-active" : ""}`}
              key={tab.id}
              role="tab"
              type="button"
              onClick={() => setActiveTab(tab.id)}
            >
              <AppIcon name={tab.icon} size="sm" />
              <span>{tab.label}</span>
              {count !== null && <span className="club-tab-counter">{count}</span>}
            </button>
          );
        })}
      </nav>

      {activeTab === "cards" ? (
        <>
          {isMobile ? (
            <button
              className="club-mobile-create-toggle"
              type="button"
              onClick={() => setIsCreateOpen(!isCreateOpen)}
            >
              <span className="flex items-center gap-2">
                <AppIcon name={isCreateOpen ? "minus" : "plus"} size="sm" />
                {isCreateOpen ? "Свернуть форму" : "Новая карта лояльности"}
              </span>
              <AppIcon name={isCreateOpen ? "chevronUp" : "chevronDown"} size="sm" />
            </button>
          ) : null}

          {(!isMobile || isCreateOpen) ? (
            <div className="club-new-card-panel">
              <div className="club-new-card-info">
                <strong>Новая карта лояльности</strong>
                <span>Выберите клиента без карты для генерации персональной ссылки</span>
              </div>
              <div className="club-new-card-form">
                <Select
                  value={newClientId}
                  onChange={(event) => setNewClientId(event.target.value)}
                >
                  <option value="">Выберите клиента...</option>
                  {clientsWithoutCards.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name || client.phone || `Клиент ${client.id}`}
                    </option>
                  ))}
                </Select>
                <Select
                  value={newCardLanguage}
                  onChange={(event) => setNewCardLanguage(event.target.value)}
                >
                  {cardLanguageOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </Select>
                <Button
                  disabled={!newClientId || loading}
                  leftIcon="gift"
                  type="button"
                  variant="primary"
                  onClick={handleCreate}
                >
                  Создать карту
                </Button>
              </div>
            </div>
          ) : null}

          <div className="club-filter-bar">
            <SearchControl
              className="club-search-field"
              placeholder="Поиск по клиенту или телефону..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onClear={() => setSearch("")}
            />
            <Select
              className="club-filter-select"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="all">Все статусы</option>
              <option value="active">Активные</option>
              <option value="archived">Архив</option>
              <option value="inactive">Отключённые</option>
            </Select>
            <Select
              className="club-filter-select"
              value={reward}
              onChange={(event) => setReward(event.target.value)}
            >
              <option value="all">Все награды</option>
              <option value="available">Награда доступна</option>
            </Select>
          </div>
        </>
      ) : activeTab === "design" ? (
        <section className="club-section-box">
          <div className="club-section-header">
            <h3>Дизайн физической карты</h3>
            <p>Уровни и привилегии NUAR Club</p>
          </div>
          {isMobile ? (
            <div className="club-physical-accordion">
              {physicalCardTiers.map((tier) => {
                const tierInfo = getTierProgressInfo(tier);
                const [nextCaption, nextValue] = tierInfo.next.includes(" осталось ")
                  ? tierInfo.next.split(" осталось ")
                  : [tierInfo.next, ""];
                const isExpanded = expandedTierId === tier.id;

                return (
                  <article key={tier.id}>
                    <button
                      className="club-physical-accordion-btn"
                      type="button"
                      onClick={() => setExpandedTierId(isExpanded ? null : tier.id)}
                    >
                      <span className={`club-tier-badge is-${tier.id}`}>{tier.badge}</span>
                      <span style={{ flex: 1, fontSize: "13px", color: "var(--text, #ffffff)", fontWeight: "500" }}>{tier.threshold}</span>
                      <AppIcon name={isExpanded ? "chevronUp" : "chevronDown"} size="sm" />
                    </button>

                    {isExpanded && (
                      <div className="club-physical-accordion-body">
                        <div style={{ cursor: "pointer" }} onClick={() => setPreviewTierId(tier.id)}>
                          <LoyaltyCard
                            card={{
                              ...designPreviewCard,
                              lifetimeVisits: tier.minVisits,
                            }}
                            tier={tier}
                          />
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
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="club-tiers-grid">
              {physicalCardTiers.map((tier) => {
                const tierInfo = getTierProgressInfo(tier);
                const [nextCaption, nextValue] = tierInfo.next.includes(" осталось ")
                  ? tierInfo.next.split(" осталось ")
                  : [tierInfo.next, ""];

                return (
                  <article
                    className="club-tier-card"
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
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                      <span className={`club-tier-badge is-${tier.id}`}>{tier.badge}</span>
                      <span style={{ fontSize: "12px", color: "var(--text-muted, #a4a4ac)" }}>{tier.threshold}</span>
                    </div>
                    <ul className="club-physical-benefits" style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "6px" }}>
                      {tier.benefits?.map((benefit) => (
                        <li key={benefit} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text-muted, #a4a4ac)" }}>
                          <AppIcon name="gift" size="xs" />
                          <span>{benefit}</span>
                        </li>
                      ))}
                    </ul>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", borderTop: "1px solid var(--border-soft, rgba(255, 255, 255, 0.05))", paddingTop: "8px", marginTop: "auto" }}>
                      <span style={{ color: "var(--text-faint, #7f7f86)" }}>{tier.description || nextCaption}</span>
                      <strong style={{ color: "var(--text, #ffffff)", fontWeight: "600" }}>{nextValue || tierInfo.next}</strong>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      ) : activeTab === "rewards" ? (
        <section className="club-section-box">
          <div className="club-section-header">
            <h3>Подарки NUAR Club</h3>
            <p>Шаблоны выпадения наград из сундуков</p>
          </div>

          {isMobile ? (
            <button
              className="club-mobile-template-toggle"
              type="button"
              onClick={() => setIsTemplateFormOpen(!isTemplateFormOpen)}
            >
              <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <AppIcon name={isTemplateFormOpen ? "minus" : "plus"} size="sm" />
                {isTemplateFormOpen ? (editingRewardTemplateId ? "Свернуть форму" : "Свернуть форму") : (editingRewardTemplateId ? "Редактировать шаблон" : "Создать шаблон подарка")}
              </span>
              <AppIcon name={isTemplateFormOpen ? "chevronUp" : "chevronDown"} size="sm" />
            </button>
          ) : null}

          {(!isMobile || isTemplateFormOpen || editingRewardTemplateId) ? (
            <form className="club-reward-template-form-card" onSubmit={handleRewardTemplateSubmit}>
              <Select
                aria-label="Уровень карты"
                disabled={rewardTemplateSaving}
                value={rewardTemplateForm.tier}
                onChange={(event) => updateRewardTemplateField("tier", event.target.value)}
              >
                {physicalCardTiers.map((tier) => (
                  <option key={tier.id} value={tier.id}>{tier.badge}</option>
                ))}
              </Select>
              <Input
                placeholder="Название подарка"
                disabled={rewardTemplateSaving}
                value={rewardTemplateForm.name}
                onChange={(event) => updateRewardTemplateField("name", event.target.value)}
              />
              <Input
                placeholder="Описание"
                disabled={rewardTemplateSaving}
                value={rewardTemplateForm.description}
                onChange={(event) => updateRewardTemplateField("description", event.target.value)}
              />
              <Input
                aria-label="Вес выпадения"
                min="1"
                placeholder="Вес"
                step="1"
                type="number"
                disabled={rewardTemplateSaving}
                value={rewardTemplateForm.weight}
                onChange={(event) => updateRewardTemplateField("weight", event.target.value)}
              />
              <Input
                aria-label="Срок действия в днях"
                min="0"
                placeholder="Дней"
                step="1"
                type="number"
                disabled={rewardTemplateSaving}
                value={rewardTemplateForm.expiresAfterDays}
                onChange={(event) => updateRewardTemplateField("expiresAfterDays", event.target.value)}
              />
              <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text-muted, #a4a4ac)", cursor: "pointer" }}>
                <Checkbox
                  checked={rewardTemplateForm.requiresOwnerApproval}
                  disabled={rewardTemplateSaving}
                  onChange={(event) => updateRewardTemplateField("requiresOwnerApproval", event.target.checked)}
                />
                Владелец
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text-muted, #a4a4ac)", cursor: "pointer" }}>
                <Checkbox
                  checked={rewardTemplateForm.active}
                  disabled={rewardTemplateSaving}
                  onChange={(event) => updateRewardTemplateField("active", event.target.checked)}
                />
                Активен
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Button disabled={rewardTemplateSaving} type="submit" variant="primary" size="sm">
                  {rewardTemplateSaving ? "Сохраняю..." : editingRewardTemplateId ? "Сохранить" : "Добавить"}
                </Button>
                {editingRewardTemplateId ? (
                  <Button disabled={rewardTemplateSaving} type="button" variant="secondary" size="sm" onClick={resetRewardTemplateForm}>
                    Отмена
                  </Button>
                ) : null}
              </div>
            </form>
          ) : null}

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {rewardTemplates.map((template) => {
              const tierId = String(template.tier || "member").toLowerCase() === "royalty"
                ? "royal"
                : String(template.tier || "member").toLowerCase();
              const tier = physicalCardTiers.find((item) => item.id === tierId) || physicalCardTiers[0];
              return (
                <article className="club-reward-template-row" key={template.id} style={{ opacity: template.active ? 1 : 0.6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: 0 }}>
                    <span className={`club-tier-badge is-${tier.id}`}>{tier.badge}</span>
                    <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                      <strong style={{ fontSize: "13px", fontWeight: "600", color: "var(--text, #ffffff)" }}>{template.name}</strong>
                      <small style={{ fontSize: "11px", color: "var(--text-muted, #a4a4ac)" }}>{template.description || "Без описания"}</small>
                    </div>
                  </div>
                  <Badge size="sm" variant={template.requiresOwnerApproval ? "warning" : "neutral"}>
                    {template.requiresOwnerApproval ? "Требует владельца" : "Автовыдача"}
                  </Badge>
                  <span style={{ fontSize: "12px", color: "var(--text-muted, #a4a4ac)" }}>Вес {template.weight || 1}</span>
                  <span style={{ fontSize: "12px", color: "var(--text-muted, #a4a4ac)" }}>{template.expiresAfterDays ? `${template.expiresAfterDays} дн.` : "Бессрочно"}</span>
                  <Badge size="sm" variant={template.active ? "success" : "neutral"}>
                    {template.active ? "Активен" : "Отключён"}
                  </Badge>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <IconButton icon="edit" size="sm" type="button" variant="ghost" label="Правка" onClick={() => handleRewardTemplateEdit(template)} />
                    <IconButton icon="trash" size="sm" type="button" variant="ghost" label="Удалить" onClick={() => handleRewardTemplateDelete(template)} />
                  </div>
                </article>
              );
            })}
            {rewardTemplatesLoading ? (
              <p style={{ textAlign: "center", padding: "16px", color: "var(--text-muted, #a4a4ac)", fontSize: "13px" }}>Загружаю подарки...</p>
            ) : null}
            {!rewardTemplatesLoading && !rewardTemplates.length ? (
              <EmptyState
                icon="gift"
                title="Шаблонов подарков пока нет"
                description="Если список пустой, сундуки будут использовать системный подарок по умолчанию."
              />
            ) : null}
          </div>
        </section>
      ) : (
        <section className="club-section-box">
          <div className="club-section-header">
            <h3>Статистика NUAR Club</h3>
            <p>Учет карт, визитов и подарков</p>
          </div>
          <div className="club-summary-grid">
            {[
              {icon: "shield", label: "Визиты", value: stats.lifetimeVisits, note: "Все визиты NUAR Club"},
              {icon: "gift", label: "К выдаче", value: stats.rewards, note: "Сундуки и подарки"},
              {icon: "sparkles", label: "Выдано", value: stats.openedGifts, note: "Использованные подарки"},
              {icon: "star", label: "Архив", value: stats.archived, note: "Закрытые карты"},
            ].map((item) => (
              <article className="club-stat-card" key={item.label}>
                <div className="club-stat-icon-wrap"><AppIcon name={item.icon} size="sm" /></div>
                <div className="club-stat-content">
                  <span className="club-stat-label">{item.label}</span>
                  <span className="club-stat-value">{item.value}</span>
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

      {activeTab === "cards" ? (
        isMobile ? (
          <div className="club-mobile-list">
            {cards.map((card) => {
              const publicUrl = createdPublicUrls[card.id] || card.publicUrl || "";
              const tier = getTierForCard(card);
              const unopenedGifts = Number(card.chestCounts?.available) || 0;
              const openedGifts =
                (Number(card.rewardCounts?.available) || 0) +
                (Number(card.rewardCounts?.redeemed) || Number(card.rewardCounts?.used) || 0);

              return (
                <article
                  className={`club-mobile-card-item ${selectedCardId === card.id ? "is-selected" : ""}`}
                  key={card.id}
                  onClick={() => setSelectedCardId(card.id)}
                >
                  {/* Top: Avatar + Client info + Menu */}
                  <div className="club-mobile-card-top">
                    <div className="club-row-client">
                      <span className="club-client-avatar">{getClientInitials(card.client)}</span>
                      <div className="club-client-meta">
                        <strong>{card.client?.name || "Клиент"}</strong>
                        <small>{card.client?.phone || card.client?.smsName || "Без телефона"}</small>
                      </div>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
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
                  </div>

                  {/* Stamp progress dots */}
                  <div className="club-mobile-card-stamps-row">
                    <div className="club-mobile-stamp-dots">
                      {Array.from({ length: card.targetStamps || 6 }).map((_, i) => (
                        <span
                          key={i}
                          className={`club-mobile-stamp-dot ${i < card.stamps ? `is-filled is-${tier.id}` : ""}`}
                        />
                      ))}
                    </div>
                    <strong style={{ fontSize: "12px", color: "var(--text, #ffffff)" }}>
                      {card.stamps}/{card.targetStamps}
                    </strong>
                  </div>

                  {/* Meta row: Badges, Gifts, Language */}
                  <div className="club-mobile-card-meta-row">
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span className={`club-tier-badge is-${tier.id}`}>{tier.badge}</span>
                      <Badge size="sm" variant={card.isActive ? "success" : "neutral"}>
                        {card.isActive ? "Активна" : "Архив"}
                      </Badge>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      {unopenedGifts > 0 && (
                        <span className="club-gift-chip is-chest">
                          <AppIcon name="gift" size="xs" /> {unopenedGifts}
                        </span>
                      )}
                      {openedGifts > 0 && (
                        <span className="club-gift-chip is-gift">
                          <AppIcon name="sparkles" size="xs" /> {openedGifts}
                        </span>
                      )}
                      <div onClick={(e) => e.stopPropagation()}>
                        <Select
                          aria-label="Язык карты"
                          className="club-lang-select"
                          style={{ minWidth: "55px", padding: "0 6px", height: "28px", fontSize: "11px" }}
                          value={getCardLanguage(card)}
                          onChange={(event) => handleLanguageChange(card, event.target.value)}
                        >
                          {cardLanguageOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.value.toUpperCase()}</option>
                          ))}
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Mobile Actions */}
                  <div className="club-mobile-card-actions-row" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      variant="primary"
                      type="button"
                      leftIcon="edit"
                      onClick={() => openManualAdjustment(card)}
                    >
                      Операция
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      type="button"
                      leftIcon="qr"
                      onClick={() => {
                        setVisibleQrCardId(visibleQrCardId === card.id ? null : card.id);
                        setSelectedCardId(card.id);
                      }}
                    >
                      QR-код
                    </Button>
                  </div>
                </article>
              );
            })}
            {!cards.length && (
              <EmptyState
                icon="shield"
                title="Карт пока нет"
                description="Создайте первую карту NUAR Club для клиента в панели выше или измените фильтр поиска."
              />
            )}
          </div>
        ) : (
          <div className="club-table-wrap">
            {cards.length > 0 && (
              <div className="club-table-header">
                <span>Клиент</span>
                <span>Статус</span>
                <span>Прогресс</span>
                <span>Сундуки</span>
                <span>Подарки</span>
                <span>Дата</span>
                <span>Язык</span>
                <span />
              </div>
            )}
            <div className="club-table-rows">
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
                    className={`club-row-card ${selectedCardId === card.id ? "is-selected" : ""}`}
                    key={card.id}
                    onClick={() => setSelectedCardId(card.id)}
                  >
                    <div className="club-row-client">
                      <span className="club-client-avatar">{getClientInitials(card.client)}</span>
                      <div className="club-client-meta">
                        <strong>{card.client?.name || "Клиент"}</strong>
                        <small>{card.client?.phone || card.client?.smsName || "Без телефона"}</small>
                      </div>
                    </div>

                    <div className="club-row-status">
                      <span className={`club-tier-badge is-${tier.id}`}>{tier.badge}</span>
                      <Badge size="sm" variant={card.isActive ? "success" : "neutral"}>
                        {card.isActive ? "Активна" : "Архив"}
                      </Badge>
                    </div>

                    <div className="club-row-progress">
                      <div className="club-progress-info">
                        <strong>{card.stamps}/{card.targetStamps}</strong>
                      </div>
                      <div className="club-progress-track" aria-label={`Прогресс ${card.stamps} из ${card.targetStamps}`}>
                        <div className="club-progress-fill" style={{ width: `${progress}%` }} />
                      </div>
                    </div>

                    <div>
                      <span className={`club-gift-chip is-chest ${unopenedGifts === 0 ? "is-zero" : ""}`}>
                        <AppIcon name="gift" size="xs" /> {unopenedGifts}
                      </span>
                    </div>

                    <div>
                      <span className={`club-gift-chip is-gift ${openedGifts === 0 ? "is-zero" : ""}`}>
                        <AppIcon name="sparkles" size="xs" /> {openedGifts}
                      </span>
                    </div>

                    <div className="club-row-date">
                      <span>{formatCardDate(card)}</span>
                    </div>

                    <div className="club-row-lang" onClick={(e) => e.stopPropagation()}>
                      <Select
                        aria-label="Язык карты"
                        className="club-lang-select"
                        value={getCardLanguage(card)}
                        onChange={(event) => handleLanguageChange(card, event.target.value)}
                      >
                        {cardLanguageOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </Select>
                    </div>

                    <div className="club-row-actions" aria-label="Действия карты">
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
            </div>
            {!cards.length && (
              <EmptyState
                icon="shield"
                title="Карт пока нет"
                description="Создайте первую карту NUAR Club для клиента в панели выше или измените фильтр поиска."
              />
            )}
          </div>
        )
      ) : null}

      {previewTier ? (
        <div
          className="club-modal-backdrop"
          role="presentation"
          onClick={() => setPreviewTierId(null)}>
          <div
            aria-label={`Стиль карты ${previewTier.displayName}`}
            aria-modal="true"
            className="club-modal-card"
            role="dialog"
            onClick={(event) => event.stopPropagation()}>
            <div className="club-modal-header">
              <div>
                <small>Стиль карты</small>
                <h3>{previewTier.title}</h3>
              </div>
              <IconButton
                icon="x"
                label="Закрыть"
                size="sm"
                type="button"
                variant="ghost"
                onClick={() => setPreviewTierId(null)}
              />
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
          className="club-modal-backdrop"
          role="presentation"
          onClick={() => setVisibleQrCardId(null)}>
          <div
            aria-label="QR код карты лояльности"
            aria-modal="true"
            className="club-modal-card"
            style={{ maxWidth: "420px" }}
            role="dialog"
            onClick={(event) => event.stopPropagation()}>
            <div className="club-modal-header">
              <div>
                <small>QR код карты</small>
                <h3>{qrCard.client?.name || "Клиент"}</h3>
              </div>
              <IconButton
                icon="x"
                label="Закрыть"
                size="sm"
                type="button"
                variant="ghost"
                onClick={() => setVisibleQrCardId(null)}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "center", padding: "16px 0" }}>
              <LoyaltyQrCode value={qrPublicUrl} />
            </div>
            <div className="club-modal-footer" style={{ justifyContent: "center" }}>
              <Button leftIcon="copy" type="button" variant="primary" onClick={() => handleCopy(qrCard)}>
                Скопировать ссылку
              </Button>
              <a
                href={qrPublicUrl}
                rel="noreferrer"
                target="_blank"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "0 14px",
                  minHeight: "38px",
                  borderRadius: "var(--radius-control, 10px)",
                  fontSize: "13px",
                  fontWeight: "500",
                  color: "var(--text, #ffffff)",
                  background: "var(--surface-2, #1b1b1e)",
                  border: "1px solid var(--border, rgba(255, 255, 255, 0.08))",
                  textDecoration: "none"
                }}
              >
                <AppIcon name="external" size="sm" />
                Открыть карту
              </a>
            </div>
          </div>
        </div>
      ) : null}

      {manualAdjustmentCard ? (
        <div
          className="club-modal-backdrop"
          role="presentation"
          onClick={closeManualAdjustment}>
          <form
            aria-label="Ручное начисление или списание"
            aria-modal="true"
            className="club-modal-card"
            role="dialog"
            onClick={(event) => event.stopPropagation()}
            onSubmit={handleManualAdjustmentSubmit}>
            <div className="club-modal-header">
              <div>
                <small>Ручная операция</small>
                <h3>{manualAdjustmentCard.client?.name || "Клиент"}</h3>
              </div>
              <IconButton
                disabled={manualAdjustmentSaving}
                icon="x"
                label="Закрыть"
                size="sm"
                type="button"
                variant="ghost"
                onClick={closeManualAdjustment}
              />
            </div>

            {/* Tabs for Stamps vs Gifts */}
            <div className="club-modal-segmented">
              <button
                className={`club-modal-segmented-btn ${adjustTab === "stamps" ? "is-active is-accent" : ""}`}
                type="button"
                onClick={() => setAdjustTab("stamps")}
              >
                Отметки
              </button>
              <button
                className={`club-modal-segmented-btn ${adjustTab === "gifts" ? "is-active is-accent" : ""}`}
                type="button"
                onClick={() => setAdjustTab("gifts")}
              >
                Подарки
              </button>
            </div>

            {adjustTab === "stamps" ? (
              <>
                <div className="club-modal-segmented">
                  <button
                    className={`club-modal-segmented-btn ${manualAdjustmentMode === "earn" ? "is-active is-accent" : ""}`}
                    type="button"
                    disabled={manualAdjustmentSaving}
                    onClick={() => setManualAdjustmentMode("earn")}
                  >
                    Начислить
                  </button>
                  <button
                    className={`club-modal-segmented-btn ${manualAdjustmentMode === "writeoff" ? "is-active is-accent" : ""}`}
                    type="button"
                    disabled={manualAdjustmentSaving}
                    onClick={() => setManualAdjustmentMode("writeoff")}
                  >
                    Списать
                  </button>
                </div>
                <label className="club-modal-field">
                  <span>Количество отметок</span>
                  <Input
                    min="1"
                    step="1"
                    type="number"
                    value={manualAdjustmentAmount}
                    disabled={manualAdjustmentSaving}
                    onChange={(event) => setManualAdjustmentAmount(event.target.value)}
                  />
                </label>
                <label className="club-modal-field">
                  <span>Причина</span>
                  <Textarea
                    placeholder="Например: компенсация, ручное исправление, возврат отметки"
                    rows={3}
                    value={manualAdjustmentDescription}
                    disabled={manualAdjustmentSaving}
                    onChange={(event) => setManualAdjustmentDescription(event.target.value)}
                  />
                </label>
              </>
            ) : (
              <>
                <div className="club-modal-segmented">
                  <button
                    className={`club-modal-segmented-btn ${giftMode === "earn" ? "is-active is-accent" : ""}`}
                    type="button"
                    disabled={manualAdjustmentSaving}
                    onClick={() => setGiftMode("earn")}
                  >
                    Выдать подарок
                  </button>
                  <button
                    className={`club-modal-segmented-btn ${giftMode === "writeoff" ? "is-active is-accent" : ""}`}
                    type="button"
                    disabled={manualAdjustmentSaving}
                    onClick={() => setGiftMode("writeoff")}
                  >
                    Подарки клиента
                  </button>
                </div>

                {giftMode === "earn" ? (
                  <>
                    <label className="club-modal-field">
                      <span>Шаблон подарка</span>
                      <Select
                        value={selectedTemplateId}
                        disabled={manualAdjustmentSaving}
                        onChange={(event) => {
                          const val = event.target.value;
                          setSelectedTemplateId(val);
                          if (val && val !== "custom") {
                            const tpl = rewardTemplates.find(t => String(t.id) === String(val));
                            setCustomGiftName(tpl?.name || "");
                            setCustomGiftDescription(tpl?.description || "");
                          } else {
                            setCustomGiftName("");
                            setCustomGiftDescription("");
                          }
                        }}
                      >
                        <option value="">Выберите шаблон...</option>
                        {rewardTemplates.map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.name} ({template.tier})
                          </option>
                        ))}
                        <option value="custom">Свой подарок...</option>
                      </Select>
                    </label>
                    <label className="club-modal-field">
                      <span>Название подарка</span>
                      <Input
                        type="text"
                        value={customGiftName}
                        disabled={manualAdjustmentSaving || (selectedTemplateId && selectedTemplateId !== "custom")}
                        onChange={(event) => setCustomGiftName(event.target.value)}
                        placeholder="Например: Массаж лица 30 мин"
                      />
                    </label>
                    <label className="club-modal-field">
                      <span>Описание</span>
                      <Textarea
                        value={customGiftDescription}
                        disabled={manualAdjustmentSaving || (selectedTemplateId && selectedTemplateId !== "custom")}
                        onChange={(event) => setCustomGiftDescription(event.target.value)}
                        placeholder="Дополнительные условия или детали подарка"
                        rows={3}
                      />
                    </label>
                  </>
                ) : (
                  <>
                    {clientRewardsLoading ? (
                      <p style={{ textAlign: "center", padding: "16px 0", fontSize: "12px", color: "var(--text-muted, #a4a4ac)" }}>
                        Загрузка подарков...
                      </p>
                    ) : !clientRewards.filter(r => r.status === "available").length ? (
                      <p style={{ textAlign: "center", padding: "24px 0", fontSize: "12px", color: "var(--text-muted, #a4a4ac)" }}>
                        У клиента нет доступных подарков
                      </p>
                    ) : (
                      <div className="club-client-gift-list">
                        {clientRewards.filter(r => r.status === "available").map((reward) => (
                          <div key={reward.id} className="club-client-gift-item">
                            <div className="club-client-gift-info">
                              <strong>{reward.name}</strong>
                              {reward.description && <span>{reward.description}</span>}
                            </div>
                            <div className="club-client-gift-actions">
                              <Button
                                size="sm"
                                variant="subtle"
                                type="button"
                                onClick={async () => {
                                  if (!window.confirm(`Использовать подарок "${reward.name}"?`)) return;
                                  setManualAdjustmentSaving(true);
                                  try {
                                    await redeemIssuedLoyaltyReward(reward.id);
                                    notify("Подарок использован");
                                    await refreshClientRewards(manualAdjustmentCard.id);
                                    await loadCards();
                                  } catch (err) {
                                    notify("Не удалось использовать подарок", err.message || "");
                                  } finally {
                                    setManualAdjustmentSaving(false);
                                  }
                                }}
                              >
                                Списать
                              </Button>
                              <IconButton
                                size="sm"
                                variant="ghost"
                                icon="trash"
                                label="Удалить подарок"
                                type="button"
                                onClick={async () => {
                                  if (!window.confirm(`Аннулировать/удалить подарок "${reward.name}"?`)) return;
                                  setManualAdjustmentSaving(true);
                                  try {
                                    await deleteLoyaltyGift(reward.id);
                                    notify("Подарок аннулирован");
                                    await refreshClientRewards(manualAdjustmentCard.id);
                                    await loadCards();
                                  } catch (err) {
                                    notify("Не удалось аннулировать подарок", err.message || "");
                                  } finally {
                                    setManualAdjustmentSaving(false);
                                  }
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {adjustTab === "stamps" && (
              <div className="club-modal-summary">
                <span>Будет сохранено в истории операций</span>
                <strong>{manualAdjustmentMode === "writeoff" ? "-" : "+"}{Math.abs(Number(manualAdjustmentAmount) || 0)}</strong>
              </div>
            )}

            <div className="club-modal-footer">
              <Button disabled={manualAdjustmentSaving} type="button" variant="secondary" onClick={closeManualAdjustment}>
                {adjustTab === "gifts" && giftMode === "writeoff" ? "Закрыть" : "Отмена"}
              </Button>
              {!(adjustTab === "gifts" && giftMode === "writeoff") && (
                <Button disabled={manualAdjustmentSaving} type="submit" variant="primary">
                  {manualAdjustmentSaving ? "Сохраняю..." : "Сохранить"}
                </Button>
              )}
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
