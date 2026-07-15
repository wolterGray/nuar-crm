import {
  Copy,
  Crown,
  ExternalLink,
  Gem,
  Gift,
  PencilLine,
  Medal,
  Link2,
  MoreHorizontal,
  Power,
  QrCode,
  ShieldCheck,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  Trash2,
  X,
} from "lucide-react";
import {useEffect, useMemo, useState} from "react";
import {
  correctLoyaltyBalance,
  createClientLoyaltyCard,
  createLoyaltyRewardTemplate,
  deleteLoyaltyCard,
  deleteLoyaltyRewardTemplate,
  earnLoyaltyStamp,
  fetchLoyaltyClubDetails,
  fetchLoyaltyCards,
  fetchLoyaltyRewardTemplates,
  openLoyaltyChest,
  redeemIssuedLoyaltyReward,
  redeemLoyaltyReward,
  reissueLoyaltyLink,
  updateLoyaltyRewardTemplate,
  updateLoyaltyCardLanguage,
  updateLoyaltyCardStatus,
} from "../../api/loyalty.js";
import RowActionMenuPortal from "../RowActionMenuPortal.jsx";
import LoyaltyQrCode from "../LoyaltyQrCode.jsx";
import PageHeader from "../PageHeader.jsx";
import {useRowActionMenu} from "../../hooks/useRowActionMenu.js";

const getCardProgress = (card) =>
  Math.min(100, Math.round(((card?.stamps ?? 0) / Math.max(1, card?.targetStamps ?? 6)) * 100));

const pluralizeVisits = (count) => {
  const value = Math.abs(Number(count) || 0);
  const lastTwo = value % 100;
  const last = value % 10;

  if (lastTwo >= 11 && lastTwo <= 14) return `${count} визитов`;
  if (last === 1) return `${count} визит`;
  if (last >= 2 && last <= 4) return `${count} визита`;
  return `${count} визитов`;
};

const physicalCardTiers = [
  {
    id: "member",
    name: "Member",
    displayName: "Member",
    signature: "NUAR MEMBER",
    title: "NUAR MEMBER",
    minVisits: 0,
    threshold: "От 0 визитов",
    badge: "MEMBER",
    benefits: ["Участие в NUAR Club"],
    icon: ShieldCheck,
  },
  {
    id: "silver",
    name: "Silver",
    displayName: "Silver",
    signature: "SILVER",
    title: "NUAR SILVER",
    minVisits: 3,
    threshold: "От 3 визитов",
    badge: "SILVER",
    benefits: ["Персональные предложения", "Дополнительные бонусы"],
    icon: Medal,
  },
  {
    id: "gold",
    name: "Gold",
    displayName: "Gold",
    signature: "GOLD",
    title: "NUAR GOLD",
    minVisits: 10,
    threshold: "От 10 визитов",
    badge: "GOLD",
    benefits: ["Повышенные привилегии", "Приоритетные предложения"],
    icon: Star,
  },
  {
    id: "diamond",
    name: "Diamond",
    displayName: "Diamond",
    signature: "DIAMOND",
    title: "NUAR DIAMOND",
    minVisits: 20,
    threshold: "От 20 визитов",
    badge: "DIAMOND",
    benefits: ["VIP-привилегии", "Приоритетная запись"],
    icon: Gem,
  },
  {
    id: "royal",
    name: "Royalty",
    displayName: "Royalty",
    signature: "ROYALTY",
    title: "NUAR ROYALTY",
    minVisits: 50,
    threshold: "От 50 визитов",
    badge: "ROYALTY",
    description: "Эксклюзивный статус",
    benefits: ["Эксклюзивные привилегии", "Особые предложения NUAR"],
    isSecret: true,
    icon: Crown,
  },
];

const cardLanguageOptions = [
  {value: "ru", label: "Русский"},
  {value: "pl", label: "Polski"},
  {value: "en", label: "English"},
];

const clubTabs = [
  {id: "cards", label: "Карты клиентов", icon: ShieldCheck},
  {id: "design", label: "Дизайн карт", icon: Sparkles},
  {id: "rewards", label: "Подарки", icon: Gift},
  {id: "stats", label: "Статистика", icon: Star},
];

const cardCopyByLanguage = {
  en: {
    gift: "gift",
    massageGift: "free massage",
    loyaltyCard: "loyalty card",
  },
  pl: {
    gift: "prezent",
    massageGift: "darmowy masaz",
    loyaltyCard: "karta lojalnosciowa",
  },
  ru: {
    gift: "подарок",
    massageGift: "бесплатный массаж",
    loyaltyCard: "карта лояльности",
  },
};

const getTierForCard = (card) => {
  const tier = String(card?.tier || "").toLowerCase();
  if (tier) {
    return physicalCardTiers.find((item) => item.id === (tier === "royalty" ? "royal" : tier)) || physicalCardTiers[0];
  }
  const visits = Math.max(0, Number(card?.lifetimeVisits ?? card?.stamps) || 0);
  if (visits >= 50) return physicalCardTiers.find((item) => item.id === "royal");
  if (visits >= 20) return physicalCardTiers.find((item) => item.id === "diamond");
  if (visits >= 10) return physicalCardTiers.find((item) => item.id === "gold");
  if (visits >= 3) return physicalCardTiers.find((item) => item.id === "silver");
  return physicalCardTiers[0];
};

const getTierProgressInfo = (tier, visits = tier.minVisits, {publicView = false} = {}) => {
  const tierIndex = physicalCardTiers.findIndex((item) => item.id === tier.id);
  const nextTier = physicalCardTiers[tierIndex + 1];
  const safeVisits = Math.max(0, Number(visits) || 0);

  if (tier.id === "royal") {
    return {
      title: tier.displayName,
      threshold: "Эксклюзивный уровень",
      next: "Максимальный статус NUAR Club",
    };
  }

  if (!nextTier || (publicView && nextTier.isSecret)) {
    return {
      title: tier.displayName,
      threshold: tier.threshold,
      next: "Дальнейшие привилегии открываются автоматически",
    };
  }

  const left = Math.max(0, nextTier.minVisits - safeVisits);
  return {
    title: tier.displayName,
    threshold: tier.threshold,
    next: left > 0
      ? `До ${nextTier.displayName} осталось ${pluralizeVisits(left)}`
      : `${nextTier.displayName} доступен`,
  };
};

const getCardLanguage = (card) =>
  cardLanguageOptions.some((option) => option.value === card?.cardLanguage)
    ? card.cardLanguage
    : "ru";

const designPreviewCard = {
  cardLanguage: "ru",
  client: null,
  displayName: "Имя клиента",
  lifetimeVisits: 0,
  rewardAvailable: false,
  stamps: 0,
};

function LoyaltyCard({card, tier = physicalCardTiers[0]}) {
  const clientName = card?.client?.name || card?.displayName || "Имя клиента";
  const language = getCardLanguage(card);
  const copy = cardCopyByLanguage[language];
  const stamps = Math.min(6, Math.max(0, Number(card?.stamps) || 0));
  const visits = Math.max(0, Number(card?.lifetimeVisits ?? card?.totalVisits ?? card?.stamps) || 0);
  const tierInfo = getTierProgressInfo(tier, visits);
  const TierIcon = tier.icon;
  const isRewardReady = Boolean(card?.rewardAvailable) && stamps >= 6;
  const tierAria = `${tier.title}, ${clientName}, прогресс ${stamps} из 6`;
  const tierIndex = physicalCardTiers.findIndex((item) => item.id === tier.id);
  const nextTier = physicalCardTiers[tierIndex + 1];
  const visitLabel = language === "pl" ? "WIZYT" : language === "en" ? "VISITS" : "ВИЗИТОВ";
  const currentLabel = language === "pl"
    ? `${visits} wizyt`
    : language === "en"
      ? `${visits} visits`
      : `${visits} визит${visits === 1 ? "" : "ов"}`;
  const fromLabel = language === "pl"
    ? `OD ${tier.minVisits} ${visitLabel}`
    : language === "en"
      ? `FROM ${tier.minVisits} ${visitLabel}`
      : `ОТ ${tier.minVisits} ${visitLabel}`;
  const nextLabel = tier.id === "royal"
    ? language === "pl"
      ? "EKSKLUZYWNY STATUS"
      : language === "en"
        ? "EXCLUSIVE STATUS"
        : "ЭКСКЛЮЗИВНЫЙ СТАТУС"
    : nextTier
      ? language === "pl"
        ? `DO ${nextTier.badge}: ${nextTier.minVisits} ${visitLabel}`
        : language === "en"
          ? `TO ${nextTier.badge}: ${nextTier.minVisits} ${visitLabel}`
          : `ДО ${nextTier.badge}: ${nextTier.minVisits} ${visitLabel}`
      : tierInfo.next.replace(" осталось ", ": ");
  const footerStart = tier.id === "member" ? `${stamps} / 6` : fromLabel;
  const footerEnd = tier.id === "member" ? currentLabel : nextLabel;

  return (
    <article
      aria-label={tierAria}
      className={`club-physical-preview is-${tier.id} ${isRewardReady ? "is-reward-ready" : ""}`}
      tabIndex={0}>
      <span aria-hidden="true" className="club-physical-shine" />
      {TierIcon ? (
        <span aria-label={`Уровень ${tier.displayName}`} className="club-physical-tier-mark" role="img">
          <TierIcon size={27} strokeWidth={1.65} />
        </span>
      ) : null}
      {tier.id === "diamond" ? <span aria-hidden="true" className="club-physical-diamond-crystal" /> : null}
      <span className="club-physical-topline">
        <span className="club-physical-brand">
          <strong>Nuar</strong>
          <small>{tier.badge}</small>
        </span>
      </span>

      <span className="club-physical-signature">
        <small>{copy.loyaltyCard}</small>
        {tier.id === "royal" ? <Crown aria-hidden="true" className="club-physical-signature-crown" size={28} strokeWidth={1.55} /> : null}
        <strong>{clientName}</strong>
      </span>

      <span className="club-physical-bottomline">
        <span
          aria-label={`Отметки карты: ${stamps} из 6`}
          className="club-physical-stamps"
          role="list">
          {Array.from({length: 6}).map((_, index) => (
            <i
              aria-label={index === 5 ? `Наградная отметка: ${copy.gift}` : `Отметка ${index + 1}`}
              className={`${index < stamps ? "is-filled" : ""} ${index === 5 ? "is-gift" : ""} ${index === 5 && isRewardReady ? "is-ready" : ""}`}
              key={index}
              role="listitem"
              title={index === 5 ? copy.gift : undefined}
            >
              {index === 5 ? <Gift size={13} /> : ""}
            </i>
          ))}
        </span>
        <span className="club-physical-card-foot">
          <span aria-label={`Цифровой прогресс ${stamps} из 6`} className="club-physical-progress">{footerStart}</span>
          <span>{footerEnd}</span>
        </span>
      </span>
    </article>
  );
}

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
      <button
        ref={triggerRef}
        aria-label="Действия карты"
        aria-expanded={isOpen}
        className={isOpen ? "is-active" : ""}
        type="button"
        onClick={() => setOpenMenuId(isOpen ? null : card.id)}>
        <MoreHorizontal size={16} />
      </button>

      <RowActionMenuPortal isOpen={isOpen} menuRef={menuRef} menuStyle={menuStyle}>
        <button
          disabled={!isRewardActionAvailable}
          type="button"
          onClick={() => closeAndRun(onRedeem)}>
          <Gift size={15} />
          Награда
        </button>
        <button disabled={!card.isActive} type="button" onClick={() => closeAndRun(onManualAdjust)}>
          <PencilLine size={15} />
          Начислить / списать
        </button>
        <button type="button" onClick={() => closeAndRun(onReissue)}>
          <Link2 size={15} />
          Перевыпустить ссылку
        </button>
        <button disabled={!publicUrl || !card.isActive} type="button" onClick={() => closeAndRun(onCopy)}>
          <Copy size={15} />
          Скопировать ссылку
        </button>
        <button disabled={!publicUrl || !card.isActive} type="button" onClick={() => closeAndRun(onOpenQr)}>
          <QrCode size={15} />
          Показать QR
        </button>
        {publicUrl ? (
          <a href={publicUrl} rel="noreferrer" target="_blank">
            <ExternalLink size={15} />
            Открыть карту
          </a>
        ) : null}
        <button type="button" onClick={() => closeAndRun(onStatus)}>
          <Power size={15} />
          {card.isActive ? "Отключить карту" : "Включить карту"}
        </button>
        <button className="danger" type="button" onClick={() => closeAndRun(onDelete)}>
          <Trash2 size={15} />
          Удалить карту
        </button>
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
  const [clubDetails, setClubDetails] = useState(null);
  const [clubDetailsLoading, setClubDetailsLoading] = useState(false);
  const [rewardTemplateForm, setRewardTemplateForm] = useState({
    active: true,
    description: "",
    expiresAfterDays: "60",
    name: "",
    requiresOwnerApproval: false,
    rewardType: "gift",
    tier: "MEMBER",
    weight: "1",
  });

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

  const selectedCardDetails = useMemo(() => ({
    availableChests: clubDetails?.chests?.filter((chest) => chest.status === "available") ?? [],
    availableRewards: clubDetails?.rewards?.filter((item) => item.status === "available") ?? [],
    openedChests: clubDetails?.chests?.filter((chest) => chest.status === "opened") ?? [],
    redeemedRewards: clubDetails?.rewards?.filter((item) => item.status === "redeemed") ?? [],
  }), [clubDetails]);

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

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      loadCards();
    }, 120);
    return () => window.clearTimeout(loadTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reward, search, status]);

  const loadRewardTemplates = async () => {
    const response = await fetchLoyaltyRewardTemplates();
    setRewardTemplates(response?.data?.items ?? []);
  };

  const loadSelectedClubDetails = async (card = selectedCard) => {
    if (!card?.id) {
      setClubDetails(null);
      return;
    }
    setClubDetailsLoading(true);
    try {
      const response = await fetchLoyaltyClubDetails(card.id);
      setClubDetails(response?.data ?? null);
    } finally {
      setClubDetailsLoading(false);
    }
  };

  const notify = (title, message = "") => {
    pushNotification?.({message, title});
  };

  useEffect(() => {
    if (activeTab !== "rewards") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadRewardTemplates().catch((err) => {
      notify("Подарки не загрузились", err.message || "Проверьте права владельца");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "rewards" || !selectedCard?.id) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSelectedClubDetails(selectedCard).catch((err) => {
      notify("Подарки клиента не загрузились", err.message || "Проверьте карту клиента");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedCard?.id]);

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

  const handleRewardTemplateSubmit = async (event) => {
    event.preventDefault();
    const body = {
      ...rewardTemplateForm,
      expiresAfterDays: Number(rewardTemplateForm.expiresAfterDays) || null,
      weight: Number(rewardTemplateForm.weight) || 1,
    };
    await createLoyaltyRewardTemplate(body);
    setRewardTemplateForm((current) => ({...current, description: "", name: "", weight: "1"}));
    await loadRewardTemplates();
    notify("Подарок добавлен");
  };

  const handleOpenChest = async (chest) => {
    if (!selectedCard?.id || !chest?.id) return;
    await openLoyaltyChest(selectedCard.id, chest.id);
    await Promise.all([loadSelectedClubDetails(selectedCard), loadCards()]);
    notify("Сундук открыт", selectedCard.client?.name || "");
  };

  const handleRedeemIssuedReward = async (rewardItem) => {
    if (!rewardItem?.id) return;
    await redeemIssuedLoyaltyReward(rewardItem.id);
    await Promise.all([loadSelectedClubDetails(selectedCard), loadCards()]);
    notify("Подарок использован", rewardItem.name || "");
  };

  const toggleRewardTemplate = async (template) => {
    await updateLoyaltyRewardTemplate(template.id, {...template, active: !template.active});
    await loadRewardTemplates();
  };

  const removeRewardTemplate = async (template) => {
    if (!window.confirm(`Удалить шаблон подарка “${template.name}”? Уже выданные подарки сохранятся.`)) return;
    await deleteLoyaltyRewardTemplate(template.id);
    await loadRewardTemplates();
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

  return (
    <section className="club-page">
      <PageHeader
        className="club-page-header"
        description="Центр управления электронными картами лояльности NUAR Club"
        title="Club"
        headerActions={
          <button className="club-icon-button" disabled={loading} type="button" onClick={loadCards}>
            <RefreshCw size={16} />
          </button>
        }
      />

      <div className="club-summary">
        <article>
          <span>Всего карт</span>
          <strong>{stats.total}</strong>
        </article>
        <article>
          <span>Активные</span>
          <strong>{stats.active}</strong>
        </article>
        <article>
          <span>Награды</span>
          <strong>{stats.rewards}</strong>
        </article>
        <article>
          <span>Отметки</span>
          <strong>{stats.stamps}</strong>
        </article>
      </div>

      <div className="club-tabs">
        {clubTabs.map((tab) => {
          const TabIcon = tab.icon;
          const badge = tab.id === "rewards" ? stats.rewards : tab.id === "cards" ? stats.total : null;
          return (
            <button
              className={activeTab === tab.id ? "is-active" : ""}
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
            >
              <TabIcon size={15} />
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
              <Gift size={15} />
              Создать карту
            </button>
          </div>

          <div className="club-toolbar">
            <label className="club-search">
              <Search size={15} />
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
                        <Gift size={15} />
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
        <section className="club-physical-designs">
          <div className="club-physical-title">
            <span>Шаблоны подарков</span>
            <strong>Что выпадает из сундуков</strong>
          </div>
          <form className="club-reward-template-form" onSubmit={handleRewardTemplateSubmit}>
            <select
              value={rewardTemplateForm.tier}
              onChange={(event) => setRewardTemplateForm((current) => ({...current, tier: event.target.value}))}
            >
              {physicalCardTiers.map((tier) => (
                <option key={tier.id} value={tier.id.toUpperCase()}>{tier.badge}</option>
              ))}
            </select>
            <input
              placeholder="Название подарка"
              value={rewardTemplateForm.name}
              onChange={(event) => setRewardTemplateForm((current) => ({...current, name: event.target.value}))}
            />
            <input
              placeholder="Описание"
              value={rewardTemplateForm.description}
              onChange={(event) => setRewardTemplateForm((current) => ({...current, description: event.target.value}))}
            />
            <input
              min="1"
              placeholder="Вес"
              type="number"
              value={rewardTemplateForm.weight}
              onChange={(event) => setRewardTemplateForm((current) => ({...current, weight: event.target.value}))}
            />
            <label>
              <input
                checked={rewardTemplateForm.requiresOwnerApproval}
                type="checkbox"
                onChange={(event) => setRewardTemplateForm((current) => ({...current, requiresOwnerApproval: event.target.checked}))}
              />
              Требует владельца
            </label>
            <button disabled={!rewardTemplateForm.name.trim()} type="submit">
              <Gift size={15} />
              Добавить
            </button>
          </form>
          <div className="club-reward-template-list">
            {rewardTemplates.map((template) => (
              <article className="club-reward-template-row" key={template.id}>
                <span className={`club-tier-badge is-${String(template.tier).toLowerCase()}`}>{template.tier === "ROYAL" ? "ROYALTY" : template.tier}</span>
                <strong>{template.name}</strong>
                <small>{template.description || "Без описания"}</small>
                <em>Вес {template.weight}</em>
                <button type="button" onClick={() => toggleRewardTemplate(template)}>
                  {template.active ? "Отключить" : "Включить"}
                </button>
                <button className="is-danger" type="button" onClick={() => removeRewardTemplate(template)}>
                  Удалить
                </button>
              </article>
            ))}
            {!rewardTemplates.length ? <p className="club-empty-text">Шаблонов пока нет.</p> : null}
          </div>
          <div className="club-reward-accounting">
            <div className="club-physical-title">
              <span>Подарки клиента</span>
              <strong>{selectedCard?.client?.name || "Выберите карту"}</strong>
            </div>
            {selectedCard ? (
              <div className="club-reward-account-grid">
                <article className="club-reward-client-card">
                  <LoyaltyCard card={selectedCard} tier={getTierForCard(selectedCard)} />
                  <div>
                    <strong>{selectedCard.client?.name || "Клиент"}</strong>
                    <span>{selectedCard.client?.phone || selectedCard.client?.smsName || "Без телефона"}</span>
                    <small>{selectedCard.stamps}/{selectedCard.targetStamps} отметок · {pluralizeVisits(selectedCard.lifetimeVisits || 0)}</small>
                  </div>
                </article>
                <div className="club-reward-columns">
                  <section>
                    <h3>Сундуки</h3>
                    {selectedCardDetails.availableChests.map((chest) => (
                      <article className="club-reward-item" key={chest.id}>
                        <span className={`club-tier-badge is-${String(chest.tier).toLowerCase()}`}>{chest.tier}</span>
                        <strong>Сундук за {chest.visitNumber || 6} визит</strong>
                        <button disabled={clubDetailsLoading} type="button" onClick={() => handleOpenChest(chest)}>
                          Открыть
                        </button>
                      </article>
                    ))}
                    {!selectedCardDetails.availableChests.length ? <p className="club-empty-text">Доступных сундуков нет.</p> : null}
                  </section>
                  <section>
                    <h3>Подарки</h3>
                    {selectedCardDetails.availableRewards.map((item) => (
                      <article className="club-reward-item" key={item.id}>
                        <span className={`club-tier-badge is-${String(item.tier).toLowerCase()}`}>{item.tier === "ROYAL" ? "ROYALTY" : item.tier}</span>
                        <strong>{item.name}</strong>
                        <small>{item.description || "Без описания"}</small>
                        <button disabled={clubDetailsLoading} type="button" onClick={() => handleRedeemIssuedReward(item)}>
                          Использовать
                        </button>
                      </article>
                    ))}
                    {!selectedCardDetails.availableRewards.length ? <p className="club-empty-text">Активных подарков нет.</p> : null}
                  </section>
                  <section>
                    <h3>История</h3>
                    {[...selectedCardDetails.openedChests, ...selectedCardDetails.redeemedRewards].slice(0, 8).map((item) => (
                      <article className="club-reward-item is-muted" key={`${item.reward ? "chest" : "reward"}-${item.id}`}>
                        <span>{item.reward ? "Сундук" : "Подарок"}</span>
                        <strong>{item.reward?.name || item.name || "NUAR Club"}</strong>
                        <small>{new Date(item.openedAt || item.redeemedAt || item.createdAt).toLocaleDateString("ru-RU")}</small>
                      </article>
                    ))}
                    {![...selectedCardDetails.openedChests, ...selectedCardDetails.redeemedRewards].length ? (
                      <p className="club-empty-text">Истории подарков пока нет.</p>
                    ) : null}
                  </section>
                </div>
              </div>
            ) : (
              <p className="club-empty-text">Создайте или выберите карту клиента.</p>
            )}
          </div>
        </section>
      ) : (
        <section className="club-physical-designs">
          <div className="club-physical-title">
            <span>Статистика NUAR Club</span>
            <strong>Учет карт, визитов и подарков</strong>
          </div>
          <div className="club-stats-grid">
            <article>
              <span>Всего визитов по клубу</span>
              <strong>{stats.lifetimeVisits}</strong>
            </article>
            <article>
              <span>Доступные подарки</span>
              <strong>{stats.rewards}</strong>
            </article>
            <article>
              <span>Использованные подарки</span>
              <strong>{stats.openedGifts}</strong>
            </article>
            <article>
              <span>Архивные карты</span>
              <strong>{stats.archived}</strong>
            </article>
          </div>
          <div className="club-tier-stat-list">
            {physicalCardTiers.map((tier) => (
              <article key={tier.id}>
                <span className={`club-tier-badge is-${tier.id}`}>{tier.badge}</span>
                <strong>{stats.tiers[tier.id] || 0}</strong>
                <small>{tier.threshold}</small>
              </article>
            ))}
          </div>
          <div className="club-client-ledger">
            {cards.map((card) => {
              const tier = getTierForCard(card);
              const gifts = (Number(card.chestCounts?.available) || 0) + (Number(card.rewardCounts?.available) || 0);
              return (
                <article key={card.id}>
                  <span className={`club-tier-badge is-${tier.id}`}>{tier.badge}</span>
                  <strong>{card.client?.name || "Клиент"}</strong>
                  <small>{pluralizeVisits(card.lifetimeVisits || 0)} · {card.stamps}/{card.targetStamps} отметок</small>
                  <em>{gifts ? `${gifts} подарков` : "без подарков"}</em>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {error ? <p className="club-error">{error}</p> : null}

      {activeTab === "cards" ? <div className={`club-layout ${selectedCard ? "has-selected-card" : ""}`}>
        <div className="club-list">
          {cards.map((card) => {
            const publicUrl = createdPublicUrls[card.id] || card.publicUrl || "";
            const progress = getCardProgress(card);
            const tier = getTierForCard(card);
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
                <div className="club-card-preview">
                  <LoyaltyCard card={card} tier={tier} />
                </div>
                <div className="club-card-main">
                  <div>
                    <span className="club-card-tierline">
                      <em className={`club-tier-badge is-${tier.id}`}>{tier.badge}</em>
                    </span>
                    <b>{card.client?.name || "Клиент"}</b>
                    <small>{card.client?.phone || card.client?.smsName || "Без телефона"}</small>
                    <div className="club-card-progress" aria-label={`Прогресс ${card.stamps} из ${card.targetStamps}`}>
                      <span style={{width: `${progress}%`}} />
                    </div>
                  </div>
                </div>
                <div className="club-card-meta">
                  <span>{card.stamps}/{card.targetStamps}</span>
                  <span>{pluralizeVisits(card.lifetimeVisits || 0)}</span>
                  <span>{card.chestCounts?.available ? `Сундук ${card.chestCounts.available}` : card.rewardCounts?.available ? `Подарок ${card.rewardCounts.available}` : "В процессе"}</span>
                  <span>{card.isActive ? "Активна" : "Архив"}</span>
                </div>
                <div className="club-card-language" onClick={(event) => event.stopPropagation()}>
                  <select
                    aria-label="Язык карты"
                    value={getCardLanguage(card)}
                    onChange={(event) => handleLanguageChange(card, event.target.value)}
                  >
                    {cardLanguageOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
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
              <Sparkles size={18} />
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
                <Copy size={15} />
                Скопировать ссылку
              </button>
              <a href={qrPublicUrl} rel="noreferrer" target="_blank">
                <ExternalLink size={15} />
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
                <X size={17} />
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
