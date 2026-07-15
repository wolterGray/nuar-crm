import {Crown, Gift} from "lucide-react";
import {
  cardCopyByLanguage,
  getCardLanguage,
  getTierProgressInfo,
  physicalCardTiers,
} from "../utils/loyaltyCardDesign.jsx";

export function LoyaltyCard({card, tier = physicalCardTiers[0]}) {
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
