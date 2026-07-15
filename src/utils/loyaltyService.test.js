import {createRequire} from "node:module";
import {beforeEach, describe, expect, it, vi} from "vitest";

const require = createRequire(import.meta.url);
const loyaltyService = require("../../backend/services/loyaltyService.js");

const makePrismaStub = () => {
  let cardId = 1;
  let chestId = 1;
  let transactionId = 1;
  const db = {
    cards: [],
    chests: [],
    clients: [
      {
        email: "anna@example.com",
        id: 1,
        name: "Anna Kowalska",
        note: "private medical note",
        phone: "+48123456789",
      },
    ],
    systemState: {
      key: "loyaltyProgramSettings",
      payload: {
        bookingUrl: "https://nuarr.pl/book",
        targetStamps: 6,
      },
    },
    transactions: [],
    rewards: [],
    visits: [],
  };

  const cloneCard = (card, include = {}) => {
    if (!card) return null;
    const next = {...card};
    if (include.client) {
      next.client = {name: db.clients.find((client) => client.id === card.clientId)?.name};
    }
    if (include.transactions) {
      next.transactions = db.transactions
        .filter((transaction) => transaction.loyaltyCardId === card.id)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, include.transactions.take ?? db.transactions.length);
    }
    if (include.chests) {
      next.chests = db.chests.filter((chest) => chest.loyaltyCardId === card.id);
    }
    return next;
  };

  const findCard = (where) => {
    if (where.id) return db.cards.find((card) => card.id === where.id) ?? null;
    if (where.clientId) {
      return db.cards.find((card) =>
        card.clientId === where.clientId &&
        (where.isActive === undefined || card.isActive === where.isActive) &&
        (where.id?.not === undefined || card.id !== where.id.not),
      ) ?? null;
    }
    if (where.publicTokenHash) {
      return db.cards.find((card) => card.publicTokenHash === where.publicTokenHash) ?? null;
    }
    if (where.publicCode) {
      return db.cards.find((card) => card.publicCode === where.publicCode) ?? null;
    }
    return null;
  };

  const prisma = {
    $transaction: (callback) => callback(prisma),
    client: {
      findUnique: vi.fn(async ({where}) => db.clients.find((client) => client.id === where.id) ?? null),
    },
    loyaltyCard: {
      create: vi.fn(async ({data, include}) => {
        const now = new Date();
        const card = {
          createdAt: now,
          archivedAt: null,
          archiveReason: null,
          cycleNumber: data.cycleNumber ?? 1,
          id: cardId,
          isActive: true,
          lifetimeVisits: data.lifetimeVisits ?? 0,
          rewardAvailable: false,
          stamps: data.stamps ?? 0,
          updatedAt: now,
          ...data,
          targetStamps: data.targetStamps ?? 6,
        };
        cardId += 1;
        db.cards.push(card);
        return cloneCard(card, include);
      }),
      findUnique: vi.fn(async ({where, select, include}) => {
        const card = findCard(where);
        if (!card) return null;
        if (select) {
          return Object.fromEntries(Object.keys(select).map((key) => [key, card[key]]));
        }
        return cloneCard(card, include);
      }),
      findFirst: vi.fn(async ({where, include}) => cloneCard(findCard(where), include)),
      update: vi.fn(async ({where, data, include}) => {
        const card = findCard(where);
        if (!card) return null;
        const nextData = {...data};
        if (nextData.lifetimeVisits?.increment) {
          nextData.lifetimeVisits = card.lifetimeVisits + nextData.lifetimeVisits.increment;
        } else if (nextData.lifetimeVisits?.decrement) {
          nextData.lifetimeVisits = Math.max(0, card.lifetimeVisits - nextData.lifetimeVisits.decrement);
        }
        Object.assign(card, nextData, {updatedAt: new Date()});
        return cloneCard(card, include);
      }),
      updateMany: vi.fn(async ({where, data}) => {
        const cards = db.cards.filter((card) =>
          card.clientId === where.clientId &&
          (where.isActive === undefined || card.isActive === where.isActive) &&
          (where.id?.not === undefined || card.id !== where.id.not),
        );
        cards.forEach((card) => {
          const nextData = {...data};
          if (nextData.lifetimeVisits?.increment) {
            nextData.lifetimeVisits = card.lifetimeVisits + nextData.lifetimeVisits.increment;
          } else if (nextData.lifetimeVisits?.decrement) {
            nextData.lifetimeVisits = Math.max(0, card.lifetimeVisits - nextData.lifetimeVisits.decrement);
          }
          Object.assign(card, nextData, {updatedAt: new Date()});
        });
        return {count: cards.length};
      }),
    },
    loyaltyChest: {
      count: vi.fn(async ({where}) =>
        db.chests.filter((chest) =>
          Object.entries(where).every(([key, value]) => chest[key] === value),
        ).length,
      ),
      findMany: vi.fn(async ({where}) =>
        db.chests
          .filter((chest) => Object.entries(where).every(([key, value]) => chest[key] === value))
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
      ),
      upsert: vi.fn(async ({where, update, create}) => {
        const key = where.loyaltyCardId_visitNumber;
        const existing = db.chests.find((chest) =>
          chest.loyaltyCardId === key.loyaltyCardId && chest.visitNumber === key.visitNumber,
        );
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const chest = {
          createdAt: new Date(),
          id: chestId,
          openedAt: null,
          reward: null,
          status: "available",
          ...create,
        };
        chestId += 1;
        db.chests.push(chest);
        return chest;
      }),
    },
    loyaltyReward: {
      count: vi.fn(async ({where}) =>
        db.rewards.filter((reward) =>
          Object.entries(where).every(([key, value]) => reward[key] === value),
        ).length,
      ),
      findMany: vi.fn(async ({where}) =>
        db.rewards.filter((reward) =>
          Object.entries(where).every(([key, value]) => reward[key] === value),
        ),
      ),
    },
    loyaltyTransaction: {
      create: vi.fn(async ({data}) => {
        if (
          data.appointmentId &&
          db.transactions.some(
            (transaction) =>
              transaction.appointmentId === data.appointmentId && transaction.type === data.type,
          )
        ) {
          throw new Error("Unique constraint failed");
        }
        const transaction = {
          createdAt: new Date(),
          id: transactionId,
          ...data,
        };
        transactionId += 1;
        db.transactions.push(transaction);
        return transaction;
      }),
      findFirst: vi.fn(async ({where, include}) => {
        const transaction =
          db.transactions.find((item) =>
            Object.entries(where).every(([key, value]) => item[key] === value),
          ) ?? null;
        if (!transaction) return null;
        return include?.loyaltyCard
          ? {...transaction, loyaltyCard: findCard({id: transaction.loyaltyCardId})}
          : transaction;
      }),
    },
    systemState: {
      findUnique: vi.fn(async ({where}) => (where.key === db.systemState.key ? db.systemState : null)),
    },
    visit: {
      findMany: vi.fn(async () => db.visits),
    },
    __db: db,
  };

  return prisma;
};

describe("loyalty service safety helpers", () => {
  beforeEach(() => {
    process.env.LOYALTY_PUBLIC_BASE_URL = "https://nuarr.pl";
  });

  it("hashes public token deterministically without exposing original token", () => {
    const token = "client-secret-token";
    const hash = loyaltyService.hashPublicToken(token);

    expect(hash).toHaveLength(64);
    expect(hash).not.toContain(token);
    expect(loyaltyService.hashPublicToken(token)).toBe(hash);
  });

  it("formats public display name without full surname", () => {
    expect(loyaltyService.__testing.getDisplayName("Anna Kowalska")).toBe("Anna K.");
    expect(loyaltyService.__testing.getDisplayName("Olga")).toBe("Olga");
  });

  it("does not treat free loyalty reward visits as paid stamp visits", () => {
    expect(
      loyaltyService.__testing.isPaidVisitPayload({
        amount: 400,
        payment: "NUAR loyalty reward",
      }),
    ).toBe(false);

    expect(
      loyaltyService.__testing.isPaidVisitPayload({
        paidAmount: 400,
        payment: "Card",
      }),
    ).toBe(true);
  });

  it("creates a card once and keeps the current public URL available", async () => {
    const prisma = makePrismaStub();
    const result = await loyaltyService.createCardForClient(prisma, 1, {cardLanguage: "pl"});

    expect(result.publicToken).toHaveLength(43);
    expect(result.publicCode).toMatch(/^[A-Z0-9]{8}$/);
    expect(result.publicUrl).toBe(`https://nuarr.pl/club/${result.publicCode}`);
    expect(result.card.cardLanguage).toBe("pl");
    expect(result.card.publicCode).toBe(result.publicCode);
    expect(result.card.publicToken).toBe(result.publicToken);
    expect(result.card.publicTokenHash).toBe(loyaltyService.hashPublicToken(result.publicToken));
    expect(result.card.publicTokenHash).not.toContain(result.publicToken);
    expect(loyaltyService.serializeCard(result.card).publicUrl).toBe(result.publicUrl);
    expect(loyaltyService.serializeCard(result.card).cardLanguage).toBe("pl");

    await expect(loyaltyService.createCardForClient(prisma, 1)).rejects.toThrow(
      "Loyalty card already exists",
    );
  });

  it("opens active public cards by token and returns no private client fields", async () => {
    const prisma = makePrismaStub();
    const {publicCode, publicToken} = await loyaltyService.createCardForClient(prisma, 1);
    const publicCard = await loyaltyService.getPublicCardByToken(prisma, publicToken);
    const shortPublicCard = await loyaltyService.getPublicCardByToken(prisma, publicCode);

    expect(publicCard).toMatchObject({
      bookingUrl: "https://nuarr.pl/book",
      cardLanguage: "ru",
      cardStatus: "active",
      displayName: "Anna K.",
      tier: "MEMBER",
      stamps: 0,
      targetStamps: 6,
    });
    expect(shortPublicCard).toMatchObject({
      displayName: "Anna K.",
      publicCode,
      publicUrl: `https://nuarr.pl/club/${publicCode}`,
    });
    expect(publicCard.cardNumber).toMatch(/^\d{4} • \d{4} • \d{4}$/);
    expect(publicCard).not.toHaveProperty("clientId");
    expect(publicCard).not.toHaveProperty("phone");
    expect(publicCard).not.toHaveProperty("email");
    expect(publicCard).not.toHaveProperty("note");
    expect(await loyaltyService.getPublicCardByToken(prisma, "wrong-token")).toBeNull();
  });

  it("derives visual loyalty tiers from lifetime visits", () => {
    expect(loyaltyService.__testing.getCardTier({lifetimeVisits: 0, stamps: 6})).toBe("MEMBER");
    expect(loyaltyService.__testing.getCardTier({lifetimeVisits: 3, stamps: 0})).toBe("SILVER");
    expect(loyaltyService.__testing.getCardTier({lifetimeVisits: 10, stamps: 0})).toBe("GOLD");
    expect(loyaltyService.__testing.getCardTier({lifetimeVisits: 20, stamps: 0})).toBe("DIAMOND");
    expect(loyaltyService.__testing.getCardTier({lifetimeVisits: 50, stamps: 0})).toBe("ROYAL");
  });

  it("normalizes loyalty card languages", () => {
    expect(loyaltyService.__testing.normalizeCardLanguage("pl")).toBe("pl");
    expect(loyaltyService.__testing.normalizeCardLanguage("EN")).toBe("en");
    expect(loyaltyService.__testing.normalizeCardLanguage("de")).toBe("ru");
  });

  it("does not open disabled cards or old tokens after reissue", async () => {
    const prisma = makePrismaStub();
    const {card, publicToken} = await loyaltyService.createCardForClient(prisma, 1);
    await prisma.loyaltyCard.update({where: {id: card.id}, data: {isActive: false}});

    expect(await loyaltyService.getPublicCardByToken(prisma, publicToken)).toBeNull();

    await prisma.loyaltyCard.update({where: {id: card.id}, data: {isActive: true}});
    const nextToken = await loyaltyService.createUniqueTokenPayload(prisma);
    const nextPublicCode = await loyaltyService.createUniquePublicCode(prisma);
    await prisma.loyaltyCard.update({
      where: {id: card.id},
      data: {
        publicCode: nextPublicCode,
        publicToken: nextToken.publicToken,
        publicTokenHash: nextToken.publicTokenHash,
      },
    });

    expect(await loyaltyService.getPublicCardByToken(prisma, publicToken)).toBeNull();
    expect(await loyaltyService.getPublicCardByToken(prisma, nextToken.publicToken)).toMatchObject({
      displayName: "Anna K.",
    });
    expect(await loyaltyService.getPublicCardByToken(prisma, nextPublicCode)).toMatchObject({
      displayName: "Anna K.",
    });
  });

  it("earns one stamp for an eligible paid visit and stays idempotent", async () => {
    const prisma = makePrismaStub();
    const {card} = await loyaltyService.createCardForClient(prisma, 1);
    const visit = {
      clientId: 1,
      id: 77,
      payload: {
        paidAmount: 400,
        service: "Massage",
      },
      serviceId: 10,
    };

    const first = await loyaltyService.earnForCompletedVisit(prisma, visit);
    const second = await loyaltyService.earnForCompletedVisit(prisma, visit);
    const stored = await prisma.loyaltyCard.findUnique({where: {id: card.id}});

    expect(first).toMatchObject({earned: true, reason: "earned"});
    expect(first.transaction.type).toBe("EARN");
    expect(second).toMatchObject({earned: false, idempotent: true, reason: "already_earned"});
    expect(stored.stamps).toBe(1);
    expect(stored.lifetimeVisits).toBe(1);
  });

  it("skips unpaid, cancelled-like and reward visits", async () => {
    const prisma = makePrismaStub();
    await loyaltyService.createCardForClient(prisma, 1);

    await expect(
      loyaltyService.earnForCompletedVisit(prisma, {clientId: 1, id: 11, payload: {amount: 0}}),
    ).resolves.toMatchObject({earned: false, reason: "not_eligible"});

    await expect(
      loyaltyService.earnForCompletedVisit(prisma, {
        clientId: 1,
        id: 12,
        payload: {amount: 400, payment: "loyalty reward"},
      }),
    ).resolves.toMatchObject({earned: false, reason: "not_eligible"});
  });

  it("redeems only when enough stamps are available", async () => {
    const prisma = makePrismaStub();
    const {card} = await loyaltyService.createCardForClient(prisma, 1);

    await expect(
      loyaltyService.applyTransaction(prisma, {
        amount: -5,
        cardId: card.id,
        description: "too early",
        type: "REDEEM",
      }),
    ).rejects.toThrow("Not enough loyalty stamps");

    await loyaltyService.applyTransaction(prisma, {
      amount: 5,
      cardId: card.id,
      description: "manual setup",
      type: "CORRECTION",
    });
    const redeemed = await loyaltyService.applyTransaction(prisma, {
      amount: -5,
      cardId: card.id,
      description: "reward used",
      type: "REDEEM",
    });

    expect(redeemed.card.stamps).toBe(0);
    expect(redeemed.card.rewardAvailable).toBe(false);
  });

  it("archives a filled reward card and reissues a fresh active card", async () => {
    const prisma = makePrismaStub();
    const {card} = await loyaltyService.createCardForClient(prisma, 1);

    for (let index = 0; index < 6; index += 1) {
      await loyaltyService.earnForCompletedVisit(prisma, {
        clientId: 1,
        id: 100 + index,
        payload: {paidAmount: 400},
      });
    }

    const filled = await prisma.loyaltyCard.findUnique({where: {id: card.id}});
    expect(filled.stamps).toBe(0);
    expect(filled.lifetimeVisits).toBe(6);
    expect(filled.rewardAvailable).toBe(true);

    const redeemed = await loyaltyService.redeemRewardAndReissue(prisma, card.id);

    expect(redeemed.archivedCard).toMatchObject({
      id: card.id,
      isActive: false,
      rewardAvailable: false,
      stamps: 0,
    });
    expect(redeemed.archivedCard.archivedAt).toBeInstanceOf(Date);
    expect(redeemed.transaction).toMatchObject({
      amount: 0,
      balanceAfter: 0,
      balanceBefore: 0,
      type: "REDEEM",
    });
    expect(redeemed.card).toMatchObject({
      clientId: 1,
      cycleNumber: 2,
      isActive: true,
      lifetimeVisits: 6,
      rewardAvailable: false,
      stamps: 0,
      targetStamps: 6,
    });
    expect(await loyaltyService.findCardForClient(prisma, 1)).toMatchObject({
      id: redeemed.card.id,
      stamps: 0,
    });
  });

  it("reverses earned stamps after reverting a completed visit once", async () => {
    const prisma = makePrismaStub();
    const {card} = await loyaltyService.createCardForClient(prisma, 1);
    const visit = {clientId: 1, id: 88, payload: {paidAmount: 500}};

    await loyaltyService.earnForCompletedVisit(prisma, visit);
    const reversed = await loyaltyService.reverseEarnForVisit(prisma, visit);
    const repeated = await loyaltyService.reverseEarnForVisit(prisma, visit);
    const stored = await prisma.loyaltyCard.findUnique({where: {id: card.id}});

    expect(reversed).toMatchObject({reason: "reversed", reversed: true});
    expect(repeated).toMatchObject({idempotent: true, reason: "already_reversed", reversed: false});
    expect(stored.stamps).toBe(0);
    expect(stored.lifetimeVisits).toBe(0);
  });

  it("recognizes owner-only correction permissions", () => {
    expect(loyaltyService.isOwner({auth: {role: "owner"}})).toBe(true);
    expect(loyaltyService.isOwner({auth: {role: "admin"}})).toBe(false);
  });
});
