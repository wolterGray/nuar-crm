import { useEffect, useState } from "react";
import AppIcon from "../../ui/AppIcon.jsx";
import { LoyaltyCard } from "../../LoyaltyCardPreview.jsx";
import { getLoyaltyTierForCard } from "../../../utils/loyaltyCardDesign.jsx";
import { fetchClientLoyaltyCard } from "../../../api/loyalty.js";

export default function ClientLoyaltyCard({ client }) {
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadLoyalty = async () => {
    if (!client?.id) return;
    setLoading(true);
    setError("");
    try {
      const cardResponse = await fetchClientLoyaltyCard(client.id);
      const nextCard = cardResponse?.data ?? null;
      setCard(nextCard);
    } catch (err) {
      setError(err.message || "Не удалось загрузить карту");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      loadLoyalty();
    }, 0);
    return () => window.clearTimeout(loadTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client?.id]);

  const clientVisits = Number(client.completedVisitsCount ?? client.visitsCount ?? 0) || 0;
  const previewCard = card
    ? {
      ...card,
      client: card.client || { name: client.name },
      displayName: card.displayName || client.name,
      lifetimeVisits: card.lifetimeVisits ?? card.totalVisits ?? clientVisits,
      totalVisits: card.totalVisits ?? card.lifetimeVisits ?? clientVisits,
    }
    : null;
  const activeTier = previewCard ? getLoyaltyTierForCard(previewCard) : null;

  return (
    <section className="client-loyalty-card">
      <div className="client-loyalty-header">
        <span className="client-loyalty-icon">
          <AppIcon name="shield" size="sm" />
        </span>
        <div>
          <strong>NUAR Club</strong>
          <small>Электронная карта лояльности</small>
        </div>
      </div>

      {error ? <p className="client-loyalty-error">{error}</p> : null}

      {!card ? (
        <p className="client-loyalty-empty">
          {loading ? "Загружаем карту..." : "Карта лояльности пока не создана."}
        </p>
      ) : (
        <div className="client-loyalty-preview">
          <LoyaltyCard card={previewCard} tier={activeTier} />
        </div>
      )}
    </section>
  );
}
