import {
  Copy,
  Crown,
  ExternalLink,
  Gem,
  Gift,
  PencilLine,
  Medal,
  Link2,
  Plus,
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
  earnLoyaltyStamp,
  fetchLoyaltyCards,
  fetchLoyaltyTransactions,
  redeemLoyaltyReward,
  reissueLoyaltyLink,
  updateLoyaltyCardLanguage,
  updateLoyaltyCardStatus,
} from "../../api/loyalty.js";
import LoyaltyQrCode from "../LoyaltyQrCode.jsx";
import PageHeader from "../PageHeader.jsx";

const transactionLabels = {
  CORRECTION: "Коррекция",
  EARN: "Начисление",
  REDEEM: "Награда",
  REVERSAL: "Откат",
};

const formatClubDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

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
    badge: "VIP",
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
    badge: "ELITE",
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

export default function ClubPage({clients = [], pushNotification}) {
  const [cards, setCards] = useState([]);
  const [transactions, setTransactions] = useState([]);
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

  const selectedCard = useMemo(
    () => cards.find((card) => card.id === selectedCardId) ?? cards[0] ?? null,
    [cards, selectedCardId],
  );
  const selectedPublicUrl = selectedCard
    ? createdPublicUrls[selectedCard.id] || selectedCard.publicUrl || ""
    : "";
  const showSelectedQr = Boolean(selectedCard?.id && visibleQrCardId === selectedCard.id);

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

  useEffect(() => {
    if (!selectedCard?.id) {
      return undefined;
    }

    let cancelled = false;
    fetchLoyaltyTransactions(selectedCard.id, {pageSize: 12})
      .then((response) => {
        if (!cancelled) {
          setTransactions(response?.data?.items ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTransactions([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedCard?.id]);

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

  const handleEarn = async (card) => {
    const description = window.prompt("Причина ручного начисления отметки");
    if (!description?.trim()) return;
    await refreshAfterAction(await earnLoyaltyStamp(card.id, {description}));
  };

  const handleRedeem = async (card) => {
    if (!window.confirm("Выдать подарок, отправить заполненную карту в архив и выпустить новую?")) return;
    await refreshAfterAction(await redeemLoyaltyReward(card.id, {
      description: "Использование награды NUAR Club",
    }));
  };

  const handleCorrect = async (card) => {
    const amount = Number(window.prompt("Изменение баланса, например 1 или -1"));
    if (!Number.isInteger(amount) || amount === 0) return;
    const description = window.prompt("Причина корректировки");
    if (!description?.trim()) return;
    await refreshAfterAction(await correctLoyaltyBalance(card.id, {amount, description}));
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
      setTransactions([]);
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
            {physicalCardTiers.map((tier) => (
              <article className="club-physical-tier" key={tier.id}>
                <LoyaltyCard card={designPreviewCard} tier={tier} />
                <div className="club-physical-level-info">
                  <span>
                    <strong>{getTierProgressInfo(tier).title}</strong>
                    <small>{tier.threshold}</small>
                  </span>
                  <p>{getTierProgressInfo(tier).next}</p>
                  {tier.description ? <em>{tier.description}</em> : null}
                  <ul>
                    {tier.benefits?.map((benefit) => (
                      <li key={benefit}>{benefit}</li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
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
                <div className="club-card-main">
                  <span className="club-card-icon">
                    <ShieldCheck size={16} />
                  </span>
                  <div>
                    <strong>{card.client?.name || "Клиент"}</strong>
                    <small>{tier.title} · {card.client?.phone || card.client?.smsName || "Без телефона"}</small>
                  </div>
                </div>
                <div className="club-card-progress">
                  <span style={{width: `${progress}%`}} />
                </div>
                <div className="club-card-meta">
                  <span>{card.stamps}/{card.targetStamps}</span>
                  <span>{card.rewardAvailable ? "Подарок" : "В процессе"}</span>
                  <span>{card.isActive ? "Активна" : "Архив"}</span>
                </div>
                <div className="club-card-actions">
                  <button type="button" onClick={(event) => {
                    event.stopPropagation();
                    handleEarn(card);
                  }}>
                    +1
                  </button>
                  <button disabled={!card.rewardAvailable || !card.isActive} type="button" onClick={(event) => {
                    event.stopPropagation();
                    handleRedeem(card);
                  }}>
                    Награда
                  </button>
                  <button type="button" onClick={(event) => {
                    event.stopPropagation();
                    handleReissue(card);
                  }}>
                    <Link2 size={13} />
                  </button>
                  <button disabled={!publicUrl || !card.isActive} type="button" onClick={(event) => {
                    event.stopPropagation();
                    handleCopy(card);
                  }}>
                    <Copy size={13} />
                  </button>
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

        <aside className="club-details">
          {selectedCard ? (
            <>
              <div className="club-details-head">
                <div>
                  <span>Карта клиента</span>
                  <strong>{selectedCard.client?.name || "Клиент"}</strong>
                </div>
                <b>{selectedCard.stamps}/{selectedCard.targetStamps}</b>
              </div>
              <div className="club-details-progress">
                <span style={{width: `${getCardProgress(selectedCard)}%`}} />
              </div>
              <LoyaltyCard card={selectedCard} tier={getTierForCard(selectedCard)} />
              <div className="club-details-grid">
                <span>
                  <small>Статус</small>
                  <b>{selectedCard.isActive ? "Активна" : "Архив"}</b>
                </span>
                <span>
                  <small>Награда</small>
                  <b>{selectedCard.rewardAvailable ? "Подарок доступен" : "Пока нет"}</b>
                </span>
                <span>
                  <small>Всего визитов</small>
                  <b>{selectedCard.lifetimeVisits ?? selectedCard.stamps}</b>
                </span>
                <span>
                  <small>Последняя операция</small>
                  <b>{formatClubDate(selectedCard.lastTransactionAt)}</b>
                </span>
              </div>

              {selectedPublicUrl ? (
                <div className="club-link-actions" aria-label="Ссылка карты">
                  <button type="button" title="Скопировать ссылку" onClick={() => handleCopy(selectedCard)}>
                    <Copy size={15} />
                  </button>
                  <button
                    className={showSelectedQr ? "is-active" : ""}
                    type="button"
                    title="Показать QR"
                    onClick={() =>
                      setVisibleQrCardId((current) =>
                        current === selectedCard.id ? null : selectedCard.id,
                      )
                    }
                  >
                    <QrCode size={15} />
                  </button>
                  <a href={selectedPublicUrl} rel="noreferrer" target="_blank">
                    <ExternalLink size={15} />
                  </a>
                </div>
              ) : (
                <p className="club-link-hint">
                  Персональная ссылка показывается только после создания или перевыпуска.
                </p>
              )}

              {selectedPublicUrl && showSelectedQr ? (
                <div className="club-qr-box">
                  <LoyaltyQrCode value={selectedPublicUrl} />
                </div>
              ) : null}

              <div className="club-card-settings">
                <label>
                  <span>Язык карты</span>
                  <select
                    value={getCardLanguage(selectedCard)}
                    onChange={(event) => handleLanguageChange(selectedCard, event.target.value)}
                  >
                    {cardLanguageOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <button type="button" onClick={() => handleStatus(selectedCard)}>
                  <Power size={14} />
                  <span>{selectedCard.isActive ? "Откл." : "Вкл."}</span>
                </button>
              </div>

              <div className="club-details-actions">
                <button type="button" title="Начислить отметку" onClick={() => handleEarn(selectedCard)}>
                  <Plus size={15} />
                  <span>Отметка</span>
                </button>
                <button disabled={!selectedCard.rewardAvailable || !selectedCard.isActive} type="button" onClick={() => handleRedeem(selectedCard)}>
                  <Gift size={15} />
                  <span>Награда</span>
                </button>
                <button type="button" title="Корректировка баланса" onClick={() => handleCorrect(selectedCard)}>
                  <PencilLine size={15} />
                  <span>Правка</span>
                </button>
                <button type="button" title="Перевыпустить ссылку" onClick={() => handleReissue(selectedCard)}>
                  <Link2 size={15} />
                  <span>Ссылка</span>
                </button>
                <button className="is-danger" type="button" onClick={() => handleDeleteCard(selectedCard)}>
                  <Trash2 size={14} />
                  <span>Удалить</span>
                </button>
              </div>

              <div className="club-transactions">
                <strong>История операций</strong>
                <div className="club-transactions-list">
                  {transactions.map((transaction) => (
                    <div key={transaction.id}>
                      <span>
                        <b>{transactionLabels[transaction.type] || transaction.type}</b>
                        <small>{formatClubDate(transaction.createdAt)} · {transaction.comment || "Без комментария"}</small>
                      </span>
                      <em>{transaction.amount > 0 ? `+${transaction.amount}` : transaction.amount}</em>
                    </div>
                  ))}
                </div>
                {!transactions.length ? <small>Операций пока нет.</small> : null}
              </div>
            </>
          ) : (
            <div className="club-empty">
              <Sparkles size={18} />
              <strong>Выберите карту</strong>
              <span>Здесь появятся ссылка, QR и история операций.</span>
            </div>
          )}
        </aside>
      </div> : null}
    </section>
  );
}
