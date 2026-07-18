import {useEffect, useState} from "react";
import {fetchPublicLoyaltyCard} from "../../api/loyalty.js";
import LoyaltyQrCode from "../LoyaltyQrCode.jsx";
import {AppIcon, Button} from "../ui/index.js";

const stringsByLanguage = {
  en: {
    booking: "Book a visit",
    cardInactive: "The card is inactive",
    failed: "Could not open the card",
    remaining: "Remaining until reward",
    rewardAvailable: "Reward is available",
    stamps: "Visits",
    subtitle: "Your loyalty card",
    title: "NUAR CLUB",
    updated: "Last update",
  },
  pl: {
    booking: "Zarezerwuj wizytę",
    cardInactive: "Karta jest nieaktywna",
    failed: "Nie udało się otworzyć karty",
    remaining: "Do nagrody pozostało",
    rewardAvailable: "Nagroda jest dostępna",
    stamps: "Wizyty",
    subtitle: "Twoja karta lojalnościowa",
    title: "NUAR CLUB",
    updated: "Ostatnia aktualizacja",
  },
  ru: {
    booking: "Записаться",
    cardInactive: "Карта неактивна",
    failed: "Не удалось открыть карту",
    remaining: "До подарка осталось",
    rewardAvailable: "Подарок доступен",
    stamps: "Визиты",
    subtitle: "Ваша карта лояльности",
    title: "NUAR CLUB",
    updated: "Последнее обновление",
  },
};
const defaultStrings = stringsByLanguage.ru;

const getTokenFromPath = () => {
  const match = window.location.pathname.match(/^\/club\/([^/]+)\/?$/);
  return match?.[1] ? decodeURIComponent(match[1]) : "";
};

function PublicLoyaltyPage() {
  const [card, setCard] = useState(null);
  const [error, setError] = useState(() => (getTokenFromPath() ? "" : defaultStrings.failed));
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
          setError(defaultStrings.failed);
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

  const target = Math.max(1, Number(card?.targetStamps) || 6);
  const stamps = Math.max(0, Number(card?.stamps) || 0);
  const remaining = Math.max(0, target - stamps);
  const progress = Math.min(100, Math.round((stamps / target) * 100));
  const strings = stringsByLanguage[card?.cardLanguage] || stringsByLanguage.ru;

  const copyLink = async () => {
    await navigator.clipboard?.writeText(publicUrl);
  };

  return (
    <main className="public-loyalty-page">
      <section className="public-loyalty-card">
        <div className="public-loyalty-brand">
          <span>
            <AppIcon name="shield" size="md" />
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

            <div className={`public-loyalty-reward ${card.rewardAvailable ? "is-ready" : ""}`}>
              <AppIcon name="gift" size="md" />
              <div>
                <strong>
                  {card.rewardAvailable
                    ? strings.rewardAvailable
                    : `${strings.remaining}: ${remaining}`}
                </strong>
                <span>
                  {strings.updated}:{" "}
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
              <a href="https://nuarr.booksy.com/a" rel="noreferrer" target="_blank">
                {strings.booking}
                <AppIcon name="external" size="sm" />
              </a>
              <Button
                leftIcon="copy"
                size="lg"
                type="button"
                variant="ghost"
                onClick={copyLink}>
                Kopiuj link
              </Button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

export default PublicLoyaltyPage;
