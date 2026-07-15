import {Crown, Gem, Medal, ShieldCheck, Star} from "lucide-react";

export const pluralizeVisits = (count) => {
  const value = Math.abs(Number(count) || 0);
  const lastTwo = value % 100;
  const last = value % 10;

  if (lastTwo >= 11 && lastTwo <= 14) return `${count} визитов`;
  if (last === 1) return `${count} визит`;
  if (last >= 2 && last <= 4) return `${count} визита`;
  return `${count} визитов`;
};

export const physicalCardTiers = [
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

export const cardLanguageOptions = [
  {value: "ru", label: "Русский"},
  {value: "pl", label: "Polski"},
  {value: "en", label: "English"},
];

export const designPreviewCard = {
  cardLanguage: "ru",
  client: null,
  displayName: "Имя клиента",
  lifetimeVisits: 0,
  rewardAvailable: false,
  stamps: 0,
};

export const cardCopyByLanguage = {
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

export const getLoyaltyTierForCard = (card) => {
  const tier = String(card?.tier || "").toLowerCase();
  if (tier) {
    return physicalCardTiers.find((item) => item.id === (tier === "royalty" ? "royal" : tier)) || physicalCardTiers[0];
  }
  const visits = Math.max(0, Number(card?.lifetimeVisits ?? card?.totalVisits ?? card?.stamps) || 0);
  if (visits >= 50) return physicalCardTiers.find((item) => item.id === "royal");
  if (visits >= 20) return physicalCardTiers.find((item) => item.id === "diamond");
  if (visits >= 10) return physicalCardTiers.find((item) => item.id === "gold");
  if (visits >= 3) return physicalCardTiers.find((item) => item.id === "silver");
  return physicalCardTiers[0];
};

export const getTierProgressInfo = (tier, visits = tier.minVisits, {publicView = false} = {}) => {
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

export const getCardLanguage = (card) =>
  cardLanguageOptions.some((option) => option.value === card?.cardLanguage)
    ? card.cardLanguage
    : "ru";
