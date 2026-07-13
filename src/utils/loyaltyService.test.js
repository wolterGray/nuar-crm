import {createRequire} from "node:module";
import {beforeEach, describe, expect, it, vi} from "vitest";

const require = createRequire(import.meta.url);
const loyaltyService = require("../../backend/services/loyaltyService.js");

const makePrismaStub = () => {
  let cardId = 1;
  let transactionId = 1;
  const db = {
    cards: [],
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
        targetStamps: 5,
      },
    },
    transactions: [],
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
    return next;
  };

  const findCard = (where) => {
    if (where.id) return db.cards.find((card) => card.id === where.id) ?? null;
    if (where.clientId) return db.cards.find((card) => card.clientId === where.clientId) ?? null;
    if (where.publicTokenHash) {
      return db.cards.find((card) => card.publicTokenHash === where.publicTokenHash) ?? null;
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
          id: cardId,
          isActive: true,
          rewardAvailable: false,
          stamps: data.stamps ?? 0,
          updatedAt: now,
          ...data,
          targetStamps: data.targetStamps ?? 5,
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
      update: vi.fn(async ({where, data, include}) => {
        const card = findCard(where);
        if (!card) return null;
        Object.assign(card, data, {updatedAt: new Date()});
        return cloneCard(card, include);
      }),
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
    const result = await loyaltyService.createCardForClient(prisma, 1);

    expect(result.publicToken).toHaveLength(43);
    expect(result.publicUrl).toBe(`https://nuarr.pl/club/${result.publicToken}`);
    expect(result.card.publicToken).toBe(result.publicToken);
    expect(result.card.publicTokenHash).toBe(loyaltyService.hashPublicToken(result.publicToken));
    expect(result.card.publicTokenHash).not.toContain(result.publicToken);
    expect(loyaltyService.serializeCard(result.card).publicUrl).toBe(result.publicUrl);

    await expect(loyaltyService.createCardForClient(prisma, 1)).rejects.toThrow(
      "Loyalty card already exists",
    );
  });

  it("opens active public cards by token and returns no private client fields", async () => {
    const prisma = makePrismaStub();
    const {publicToken} = await loyaltyService.createCardForClient(prisma, 1);
    const publicCard = await loyaltyService.getPublicCardByToken(prisma, publicToken);

    expect(publicCard).toMatchObject({
      bookingUrl: "https://nuarr.pl/book",
      cardStatus: "active",
      displayName: "Anna K.",
      tier: "MEMBER",
      stamps: 0,
      targetStamps: 5,
    });
    expect(publicCard.cardNumber).toMatch(/^\d{4} • \d{4} • \d{4}$/);
    expect(publicCard).not.toHaveProperty("clientId");
    expect(publicCard).not.toHaveProperty("phone");
    expect(publicCard).not.toHaveProperty("email");
    expect(publicCard).not.toHaveProperty("note");
    expect(await loyaltyService.getPublicCardByToken(prisma, "wrong-token")).toBeNull();
  });

  it("derives visual loyalty tiers from stamp balance", () => {
    expect(loyaltyService.__testing.getCardTier({stamps: 0, targetStamps: 5})).toBe("MEMBER");
    expect(loyaltyService.__testing.getCardTier({stamps: 5, targetStamps: 5})).toBe("SILVER");
    expect(loyaltyService.__testing.getCardTier({stamps: 10, targetStamps: 5})).toBe("GOLD");
    expect(loyaltyService.__testing.getCardTier({stamps: 15, targetStamps: 5})).toBe("DIAMOND");
    expect(loyaltyService.__testing.getCardTier({stamps: 25, targetStamps: 5})).toBe("ROYAL");
  });

  it("does not open disabled cards or old tokens after reissue", async () => {
    const prisma = makePrismaStub();
    const {card, publicToken} = await loyaltyService.createCardForClient(prisma, 1);
    await prisma.loyaltyCard.update({where: {id: card.id}, data: {isActive: false}});

    expect(await loyaltyService.getPublicCardByToken(prisma, publicToken)).toBeNull();

    await prisma.loyaltyCard.update({where: {id: card.id}, data: {isActive: true}});
    const nextToken = await loyaltyService.createUniqueTokenPayload(prisma);
    await prisma.loyaltyCard.update({
      where: {id: card.id},
      data: {
        publicToken: nextToken.publicToken,
        publicTokenHash: nextToken.publicTokenHash,
      },
    });

    expect(await loyaltyService.getPublicCardByToken(prisma, publicToken)).toBeNull();
    expect(await loyaltyService.getPublicCardByToken(prisma, nextToken.publicToken)).toMatchObject({
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
  });

  it("recognizes owner-only correction permissions", () => {
    expect(loyaltyService.isOwner({auth: {role: "owner"}})).toBe(true);
    expect(loyaltyService.isOwner({auth: {role: "admin"}})).toBe(false);
  });
});
