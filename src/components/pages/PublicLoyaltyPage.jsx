import {Copy, ExternalLink, Gift, ShieldCheck} from "lucide-react";
import {useEffect, useState} from "react";
import {fetchPublicLoyaltyCard} from "../../api/loyalty.js";
import LoyaltyQrCode from "../LoyaltyQrCode.jsx";

const strings = {
  booking: "Zarezerwuj wizytę",
  cardInactive: "Karta jest nieaktywna",
  failed: "Nie udało się otworzyć karty",
  remaining: "Do nagrody pozostało",
  rewardAvailable: "Nagroda jest dostępna",
  stamps: "Wizyty",
  subtitle: "Twoja karta lojalnościowa",
  title: "NUAR CLUB",
};

const getTokenFromPath = () => {
  const match = window.location.pathname.match(/^\/club\/([^/]+)\/?$/);
  return match?.[1] ? decodeURIComponent(match[1]) : "";
};

function PublicLoyaltyPage() {
  const [card, setCard] = useState(null);
  const [error, setError] = useState(() => (getTokenFromPath() ? "" : strings.failed));
  const [loading, setLoading] = useState(() => Boolean(getTokenFromPath()));
  const [token] = useState(getTokenFromPath);
  const publicUrl = typeof window === "undefined" ? "" : window.location.href;

  useEffect(() => {
    let meta = document.querySelector('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "robots");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", "noindex, nofollow");
    document.title = "NUAR CLUB";
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!token) {
      return undefined;
    }

    fetchPublicLoyaltyCard(token)
      .then((response) => {
        if (!cancelled) {
          setCard(response?.data ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(strings.failed);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const target = Math.max(1, Number(card?.targetStamps) || 5);
  const stamps = Math.max(0, Number(card?.stamps) || 0);
  const remaining = Math.max(0, target - stamps);
  const progress = Math.min(100, Math.round((stamps / target) * 100));

  const copyLink = async () => {
    await navigator.clipboard?.writeText(publicUrl);
  };

  return (
    <main className="public-loyalty-page">
      <section className="public-loyalty-card">
        <div className="public-loyalty-brand">
          <span>
            <ShieldCheck size={18} />
          </span>
          <div>
            <h1>{strings.title}</h1>
            <p>{strings.subtitle}</p>
          </div>
        </div>

        {loading ? (
          <div className="public-loyalty-state">Ładowanie karty...</div>
        ) : error || !card ? (
          <div className="public-loyalty-state">
            <strong>{strings.failed}</strong>
            <span>{strings.cardInactive}</span>
          </div>
        ) : (
          <>
            <div className="public-loyalty-person">
              <small>Karta</small>
              <strong>{card.displayName}</strong>
            </div>

            <div className="public-loyalty-progress-ring">
              <div>
                <strong>{stamps}/{target}</strong>
                <span>{strings.stamps}</span>
              </div>
            </div>

            <div className="public-loyalty-progress">
              <span style={{width: `${progress}%`}} />
            </div>

            <div className="public-loyalty-reward">
              <Gift size={18} />
              <div>
                <strong>
                  {card.rewardAvailable
                    ? strings.rewardAvailable
                    : `${strings.remaining}: ${remaining}`}
                </strong>
                <span>
                  Ostatnia aktualizacja:{" "}
                  {card.lastTransactionAt
                    ? new Date(card.lastTransactionAt).toLocaleDateString("pl-PL")
                    : "—"}
                </span>
              </div>
            </div>

            <div className="public-loyalty-qr-wrap">
              <LoyaltyQrCode value={publicUrl} />
            </div>

            <div className="public-loyalty-actions">
              <a href={card.bookingUrl || "https://nuarr.pl"} rel="noreferrer" target="_blank">
                {strings.booking}
                <ExternalLink size={15} />
              </a>
              <button type="button" onClick={copyLink}>
                <Copy size={15} />
                Kopiuj link
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

export default PublicLoyaltyPage;
