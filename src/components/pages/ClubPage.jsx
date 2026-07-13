import {
  Copy,
  Crown,
  ExternalLink,
  Gem,
  Gift,
  Medal,
  Link2,
  ShieldCheck,
  RefreshCw,
  Search,
  Sparkles,
  Star,
} from "lucide-react";
import {useEffect, useMemo, useState} from "react";
import {
  correctLoyaltyBalance,
  createClientLoyaltyCard,
  earnLoyaltyStamp,
  fetchLoyaltyCards,
  fetchLoyaltyTransactions,
  redeemLoyaltyReward,
  reissueLoyaltyLink,
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
  Math.min(100, Math.round(((card?.stamps ?? 0) / Math.max(1, card?.targetStamps ?? 5)) * 100));

const physicalCardTiers = [
  {id: "member", name: "Basic", signature: "NUAR MEMBER", title: "NUAR MEMBER", threshold: "0 визитов", icon: ShieldCheck},
  {id: "silver", name: "Silver", signature: "SILVER", title: "NUAR SILVER", threshold: "3 визита", icon: Medal},
  {id: "gold", name: "Gold", signature: "GOLD", title: "NUAR GOLD", threshold: "10 визитов", icon: Star},
  {id: "diamond", name: "Diamond", signature: "DIAMOND", title: "NUAR DIAMOND", threshold: "20 визитов", icon: Gem},
  {id: "royal", name: "Royalty", signature: "ROYALTY", title: "NUAR ROYALTY", threshold: "50 визитов", icon: Crown},
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

const getCardLanguage = (card) =>
  cardLanguageOptions.some((option) => option.value === card?.cardLanguage)
    ? card.cardLanguage
    : "ru";

function RoyalRoseMark() {
  return (
    <svg className="club-physical-royal-rose" viewBox="0 0 420 240" aria-hidden="true">
      <path className="rose-leaf" d="M20 128C54 96 92 91 128 120C91 138 55 145 20 128Z" />
      <path className="rose-leaf" d="M305 91C335 58 366 55 398 76C369 98 338 107 305 91Z" />
      <path className="rose-leaf" d="M316 148C356 145 387 165 405 204C363 204 333 185 316 148Z" />
      <path className="rose-leaf" d="M72 170C92 141 120 131 151 145C129 171 102 181 72 170Z" />
      <path className="rose-petal" d="M146 65C173 27 223 28 248 66C215 58 181 59 146 65Z" />
      <path className="rose-petal" d="M101 105C111 65 153 48 187 73C151 80 125 91 101 105Z" />
      <path className="rose-petal" d="M246 67C286 51 327 77 330 120C300 99 276 82 246 67Z" />
      <path className="rose-petal" d="M82 139C91 102 132 83 171 100C134 111 105 124 82 139Z" />
      <path className="rose-petal" d="M262 101C307 102 341 139 324 183C301 146 284 122 262 101Z" />
      <path className="rose-petal" d="M111 178C124 139 167 119 205 139C164 151 137 164 111 178Z" />
      <path className="rose-petal" d="M205 139C241 120 286 139 296 179C260 166 232 152 205 139Z" />
      <path className="rose-petal" d="M155 206C173 167 215 151 250 178C221 207 187 216 155 206Z" />
      <path className="rose-core" d="M170 130C183 96 232 92 251 124C225 111 197 113 170 130Z" />
      <path className="rose-core" d="M168 132C196 118 230 125 239 154C211 153 188 146 168 132Z" />
      <path className="rose-core" d="M191 157C204 135 237 130 254 150C238 171 212 174 191 157Z" />
      <path className="rose-vein" d="M34 126C66 122 95 120 123 121" />
      <path className="rose-vein" d="M317 88C344 82 367 78 391 76" />
      <path className="rose-vein" d="M333 157C356 173 377 187 397 203" />
    </svg>
  );
}

function PhysicalCardPreview({card, tier = physicalCardTiers[0]}) {
  const clientName = card?.client?.name || card?.displayName || "Ira Kurylak";
  const copy = cardCopyByLanguage[getCardLanguage(card)];
  const stamps = Math.min(6, Math.max(0, Number(card?.stamps) || 0));
  const TierIcon = tier.icon;

  return (
    <article className={`club-physical-preview is-${tier.id}`}>
      <span className="club-physical-shine" />
      {TierIcon ? (
        <span className="club-physical-tier-mark">
          <TierIcon size={21} strokeWidth={1.35} />
        </span>
      ) : null}
      {tier.id === "royal" ? <RoyalRoseMark /> : null}
      {tier.id === "diamond" ? <span className="club-physical-diamond-crystal" /> : null}
      {tier.id === "silver" || tier.id === "gold" ? (
        <span className="club-physical-ingot" />
      ) : null}
      <span className="club-physical-topline">
        <span className="club-physical-card-title">{tier.title}</span>
      </span>

      <span className="club-physical-signature">
        <small>{copy.loyaltyCard}</small>
        <strong>{clientName}</strong>
      </span>

      <span className="club-physical-bottomline">
        <span className="club-physical-stamps">
          {Array.from({length: 6}).map((_, index) => (
            <i
              aria-label={index === 5 ? copy.gift : undefined}
              className={`${index < stamps ? "is-filled" : ""} ${index === 5 ? "is-gift" : ""}`}
              key={index}
              title={index === 5 ? copy.gift : undefined}
            >
              {index === 5 ? <Gift size={13} /> : ""}
            </i>
          ))}
        </span>
        <span className="club-physical-progress">{stamps}/6</span>
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

  const selectedCard = useMemo(
    () => cards.find((card) => card.id === selectedCardId) ?? cards[0] ?? null,
    [cards, selectedCardId],
  );
  const selectedPublicUrl = selectedCard
    ? createdPublicUrls[selectedCard.id] || selectedCard.publicUrl || ""
    : "";

  const cardClientIds = useMemo(
    () => new Set(cards.map((card) => card.clientId)),
    [cards],
  );

  const clientsWithoutCards = useMemo(
    () => clients.filter((client) => !cardClientIds.has(client.id)),
    [cardClientIds, clients],
  );

  const stats = useMemo(() => {
    const active = cards.filter((card) => card.isActive).length;
    const rewards = cards.filter((card) => card.rewardAvailable).length;
    const stamps = cards.reduce((total, card) => total + (Number(card.stamps) || 0), 0);
    return {active, rewards, stamps, total: cards.length};
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
    if (!window.confirm("Списать награду по карте клиента?")) return;
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
                <PhysicalCardPreview card={selectedCard} tier={tier} />
                <span>
                  <strong>{tier.name}</strong>
                  <small>{tier.threshold}</small>
                </span>
              </article>
            ))}
          </div>
        </section>
      )}

      {error ? <p className="club-error">{error}</p> : null}

      {activeTab === "cards" ? <div className="club-layout">
        <div className="club-list">
          {cards.map((card) => {
            const publicUrl = createdPublicUrls[card.id] || card.publicUrl || "";
            const progress = getCardProgress(card);
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
                    <small>{card.client?.phone || card.client?.smsName || "Без телефона"}</small>
                  </div>
                </div>
                <div className="club-card-progress">
                  <span style={{width: `${progress}%`}} />
                </div>
                <div className="club-card-meta">
                  <span>{card.stamps}/{card.targetStamps}</span>
                  <span>{card.rewardAvailable ? "Награда" : "В процессе"}</span>
                  <span>{card.isActive ? "Активна" : "Отключена"}</span>
                </div>
                <div className="club-card-actions">
                  <button type="button" onClick={(event) => {
                    event.stopPropagation();
                    handleEarn(card);
                  }}>
                    +1
                  </button>
                  <button disabled={!card.rewardAvailable} type="button" onClick={(event) => {
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
                  <button disabled={!publicUrl} type="button" onClick={(event) => {
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
              <div className="club-details-grid">
                <span>
                  <small>Статус</small>
                  <b>{selectedCard.isActive ? "Активна" : "Отключена"}</b>
                </span>
                <span>
                  <small>Награда</small>
                  <b>{selectedCard.rewardAvailable ? "Доступна" : "Пока нет"}</b>
                </span>
                <span>
                  <small>Последняя операция</small>
                  <b>{formatClubDate(selectedCard.lastTransactionAt)}</b>
                </span>
              </div>

              {selectedPublicUrl ? (
                <div className="club-public-link">
                  <span>{selectedPublicUrl}</span>
                  <button type="button" onClick={() => handleCopy(selectedCard)}>
                    <Copy size={13} />
                  </button>
                  <a href={selectedPublicUrl} rel="noreferrer" target="_blank">
                    <ExternalLink size={13} />
                  </a>
                </div>
              ) : (
                <p className="club-link-hint">
                  Персональная ссылка показывается только после создания или перевыпуска.
                </p>
              )}

              {selectedPublicUrl ? (
                <div className="club-qr-box">
                  <LoyaltyQrCode value={selectedPublicUrl} />
                </div>
              ) : null}

              <div className="club-details-actions">
                <button type="button" onClick={() => handleEarn(selectedCard)}>Начислить</button>
                <button disabled={!selectedCard.rewardAvailable} type="button" onClick={() => handleRedeem(selectedCard)}>
                  Использовать награду
                </button>
                <button type="button" onClick={() => handleCorrect(selectedCard)}>Корректировка</button>
                <button type="button" onClick={() => handleReissue(selectedCard)}>Перевыпустить ссылку</button>
                <button type="button" onClick={() => handleStatus(selectedCard)}>
                  {selectedCard.isActive ? "Отключить карту" : "Включить карту"}
                </button>
              </div>

              <div className="club-transactions">
                <strong>История операций</strong>
                {transactions.map((transaction) => (
                  <div key={transaction.id}>
                    <span>
                      <b>{transactionLabels[transaction.type] || transaction.type}</b>
                      <small>{formatClubDate(transaction.createdAt)} · {transaction.comment || "Без комментария"}</small>
                    </span>
                    <em>{transaction.amount > 0 ? `+${transaction.amount}` : transaction.amount}</em>
                  </div>
                ))}
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
