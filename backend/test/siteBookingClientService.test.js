const assert = require('node:assert/strict');
const test = require('node:test');
const {
  findOrCreateSiteBookingClient,
  reconcileSiteBookingWaitlistClients,
} = require('../services/siteBookingClientService');

test('finds an existing client by normalized phone without creating a duplicate', async () => {
  let created = false;
  const tx = {
    client: {
      create: async () => { created = true; },
      findMany: async () => [{id: 7, phone: '+48 123 456 789', email: null}],
    },
  };

  const client = await findOrCreateSiteBookingClient(tx, {
    clientName: 'Anna',
    clientPhone: '+48123456789',
  });

  assert.equal(client.id, 7);
  assert.equal(created, false);
});

test('creates a missing site client with its source', async () => {
  let createData = null;
  const tx = {
    client: {
      create: async ({data}) => {
        createData = data;
        return {id: 11, ...data};
      },
      findMany: async () => [],
    },
  };

  const client = await findOrCreateSiteBookingClient(tx, {
    clientEmail: 'anna@example.com',
    clientName: 'Anna',
    clientPhone: '+48123456789',
    preferredMaster: 'Olha',
  });

  assert.equal(client.id, 11);
  assert.equal(createData.source, 'Сайт');
  assert.equal(createData.note, 'Заявка с nuarr.pl');
  assert.equal(createData.tags, 'site');
});

test('reconciles an old site request that has no linked client', async () => {
  const entry = {
    id: 3,
    clientId: null,
    clientName: 'Anna',
    payload: {clientPhone: '+48123456789', source: 'site-booking'},
    preferredMaster: 'Olha',
  };
  const tx = {
    client: {
      findMany: async () => [{id: 7, phone: '+48 123 456 789', email: null}],
    },
    waitlistEntry: {
      update: async ({data}) => ({...entry, ...data}),
    },
  };
  const prisma = {$transaction: async (callback) => callback(tx)};

  const [result] = await reconcileSiteBookingWaitlistClients(prisma, [entry]);

  assert.equal(result.clientId, 7);
});
