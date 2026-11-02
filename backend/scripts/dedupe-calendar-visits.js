#!/usr/bin/env node

require('dotenv').config();
const jwt = require('jsonwebtoken');
const {PrismaClient} = require('@prisma/client');

const prisma = new PrismaClient();

const main = async () => {
  const secret = String(process.env.JWT_SECRET || '').trim();
  if (!secret) throw new Error('JWT_SECRET is not configured');

  const owner = await prisma.user.findFirst({
    where: {isActive: true, role: 'owner'},
    orderBy: {id: 'asc'},
    select: {email: true, id: true, name: true, role: true},
  });
  if (!owner) throw new Error('No active owner user found');

  const token = jwt.sign(
    {
      email: owner.email,
      name: owner.name,
      role: owner.role,
      sub: String(owner.id),
      tokenType: 'maintenance',
    },
    secret,
    {expiresIn: '5m'},
  );
  const port = Number(process.env.PORT) || 3001;
  const response = await fetch(`http://127.0.0.1:${port}/api/visits/dedupe-calendar`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.success) {
    throw new Error(`Dedupe API failed (${response.status}): ${body.error || 'Unknown error'}`);
  }

  const cleaned = Array.isArray(body.data?.cleaned) ? body.data.cleaned : [];
  const skipped = Array.isArray(body.data?.skipped) ? body.data.skipped : [];
  console.log(JSON.stringify({cleaned, skipped}, null, 2));

  if (skipped.length > 0) {
    throw new Error('Unsafe duplicate groups remain; migration must not continue');
  }

  console.log(`Calendar visit dedupe complete: ${cleaned.length} group(s) cleaned, 0 skipped.`);
};

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
