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
} from "lucide-react";
import {useEffect, useMemo, useState} from "react";
import {
  correctLoyaltyBalance,
  createClientLoyaltyCard,
  deleteLoyaltyCard,
  fetchLoyaltyCards,
  redeemLoyaltyReward,
  reissueLoyaltyLink,
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
  client: {name: "Имя клиента"},
  displayName: "Имя клиента",
  rewardAvailable: false,
  stamps: 0,
};

function LoyaltyCard({card, tier = physicalCardTiers[0]}) {
  const clientName = card?.client?.name || card?.displayName || "Имя клиента";
  const copy = cardCopyByLanguage[getCardLanguage(card)];
  const stamps = Math.min(6, Math.max(0, Number(card?.stamps) || 0));
  const TierIcon = tier.icon;
  const isRewardReady = Boolean(card?.rewardAvailable) && stamps >= 6;
  const tierAria = `${tier.title}, ${clientName}, прогресс ${stamps} из 6`;

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
        <span className="club-physical-card-title">{tier.title}</span>
        <span className="club-physical-badge">{tier.badge}</span>
      </span>

      <span className="club-physical-signature">
        <small>{copy.loyaltyCard}</small>
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
        <span aria-label={`Цифровой прогресс ${stamps} из 6`} className="club-physical-progress">{stamps}/6</span>
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
  const [manualAdjustmentCardId, setManualAdjustmentCardId] = useState(null);
  const [manualAdjustmentMode, setManualAdjustmentMode] = useState("earn");
  const [manualAdjustmentAmount, setManualAdjustmentAmount] = useState("1");
  const [manualAdjustmentDescription, setManualAdjustmentDescription] = useState("");

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
    const rewards = cards.filter((card) => card.rewardAvailable).length;
    const stamps = cards.reduce((total, card) => total + (Number(card.stamps) || 0), 0);
    return {active, archived, rewards, stamps, total: cards.length};
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

  const refreshAfterAction = async (response) => {
    const card = response?.data?.card ?? null;
    const publicUrl = response?.data?.publicUrl || card?.publicUrl || "";
    if (card?.id && publicUrl) {
      setCreatedPublicUrls((current) => ({...current, [card.id]: publicUrl}));
    }
    await loadCards();
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
    if (!window.confirm("Выдать подарок, отправить заполненную карту в архив и выпустить новую?")) return;
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

    if (!description) {
      notify("Добавьте причину", "Так будет понятно, почему баланс изменился вручную");
      return;
    }

    const amount = manualAdjustmentMode === "writeoff" ? -units : units;
    await refreshAfterAction(await correctLoyaltyBalance(manualAdjustmentCard.id, {
      amount,
      description,
    }));
    notify(
      manualAdjustmentMode === "writeoff" ? "Отметки списаны" : "Отметки начислены",
      manualAdjustmentCard.client?.name || "",
    );
    closeManualAdjustment();
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
        <button
          className={activeTab === "cards" ? "is-active" : ""}
          type="button"
          onClick={() => setActiveTab("cards")}
        >
          Карты клиентов
        </button>
        <button
          className={activeTab === "design" ? "is-active" : ""}
          type="button"
          onClick={() => setActiveTab("design")}
        >
          Дизайн карт
        </button>
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
      ) : (
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
                <article className="club-physical-tier" key={tier.id}>
                  <LoyaltyCard
                    card={{
                      ...designPreviewCard,
                      client: {name: tier.signature.replace("NUAR ", "")},
                      displayName: tier.signature.replace("NUAR ", ""),
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
                  <span>{card.rewardAvailable ? "Подарок" : "В процессе"}</span>
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
              <button type="button" onClick={closeManualAdjustment}>
                Закрыть
              </button>
            </div>
            <div className="club-adjust-mode" role="group" aria-label="Тип операции">
              <button
                className={manualAdjustmentMode === "earn" ? "is-active" : ""}
                type="button"
                onClick={() => setManualAdjustmentMode("earn")}>
                Начислить
              </button>
              <button
                className={manualAdjustmentMode === "writeoff" ? "is-active" : ""}
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
                onChange={(event) => setManualAdjustmentAmount(event.target.value)}
              />
            </label>
            <label className="club-adjust-field">
              <span>Причина</span>
              <textarea
                placeholder="Например: компенсация, ручное исправление, возврат отметки"
                rows={4}
                value={manualAdjustmentDescription}
                onChange={(event) => setManualAdjustmentDescription(event.target.value)}
              />
            </label>
            <div className="club-adjust-summary">
              <span>Будет сохранено в истории операций</span>
              <strong>{manualAdjustmentMode === "writeoff" ? "-" : "+"}{Math.abs(Number(manualAdjustmentAmount) || 0)}</strong>
            </div>
            <div className="club-adjust-actions">
              <button type="button" onClick={closeManualAdjustment}>
                Отмена
              </button>
              <button type="submit">
                Сохранить
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
