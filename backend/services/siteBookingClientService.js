const normalizeText = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');

const normalizePhone = (value) => String(value ?? '').replace(/[^\d+]/g, '');

const findOrCreateSiteBookingClient = async (tx, booking) => {
  const phone = normalizePhone(booking?.clientPhone);
  const email = String(booking?.clientEmail ?? '').trim();
  const normalizedEmail = normalizeText(email);
  const candidates = await tx.client.findMany({
    select: {email: true, id: true, phone: true},
    where: {
      OR: [
        {phone: {not: null}},
        ...(email ? [{email: {equals: email, mode: 'insensitive'}}] : []),
      ],
    },
  });
  const existing = candidates.find((client) =>
    (phone && normalizePhone(client.phone) === phone) ||
    (normalizedEmail && normalizeText(client.email) === normalizedEmail),
  );

  if (existing) return existing;

  return tx.client.create({
    data: {
      email: email || null,
      name: String(booking?.clientName ?? '').trim() || 'Клиент с сайта',
      note: 'Заявка с nuarr.pl',
      phone: phone || null,
      preference: String(booking?.preferredMaster ?? '').trim() || null,
      source: 'Сайт',
      status: 'Новый',
      tags: 'site',
    },
    select: {email: true, id: true, phone: true},
  });
};

const reconcileSiteBookingWaitlistClients = async (prisma, entries = []) => {
  const reconciled = [];

  for (const entry of entries) {
    const payload = entry?.payload && typeof entry.payload === 'object' ? entry.payload : {};
    if (entry?.clientId || payload.source !== 'site-booking') {
      reconciled.push(entry);
      continue;
    }

    const clientPhone = normalizePhone(payload.clientPhone);
    if (!clientPhone) {
      reconciled.push(entry);
      continue;
    }

    try {
      const linkedEntry = await prisma.$transaction(async (tx) => {
        const client = await findOrCreateSiteBookingClient(tx, {
          clientEmail: payload.clientEmail,
          clientName: entry.clientName,
          clientPhone,
          preferredMaster: entry.preferredMaster,
        });
        return tx.waitlistEntry.update({
          data: {clientId: client.id},
          where: {id: entry.id},
        });
      });
      reconciled.push(linkedEntry);
    } catch (error) {
      console.error('Failed to link site booking client:', error);
      reconciled.push(entry);
    }
  }

  return reconciled;
};

module.exports = {
  findOrCreateSiteBookingClient,
  normalizeSiteBookingClientPhone: normalizePhone,
  reconcileSiteBookingWaitlistClients,
};
