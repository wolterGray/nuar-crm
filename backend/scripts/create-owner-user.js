const path = require('path');
require('dotenv').config({path: path.join(__dirname, '..', '.env')});

const {PrismaClient} = require('@prisma/client');
const {
  hashPassword,
  normalizeEmail,
  validatePasswordStrength,
} = require('../utils/passwordAuth');

const prisma = new PrismaClient();

async function main() {
  const email = normalizeEmail(process.env.ADMIN_EMAIL);
  const password = String(process.env.ADMIN_PASSWORD ?? '');

  if (!email || !password) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required to create the owner user');
  }

  const strength = validatePasswordStrength(password, {email, role: 'owner'});
  if (!strength.ok) {
    const message = `ADMIN_PASSWORD does not meet the future owner password policy: ${strength.failures.join('; ')}`;
    if (process.env.AUTH_BOOTSTRAP_ENFORCE_STRENGTH === 'true') {
      throw new Error(message);
    }
    console.warn(`[auth-bootstrap] ${message}`);
    console.warn('[auth-bootstrap] Continuing to avoid deployment lockout. Rotate owner password after DB auth is verified.');
  }

  const existing = await prisma.user.findUnique({where: {email}});
  if (existing) {
    const updated = await prisma.user.update({
      where: {id: existing.id},
      data: {
        isActive: true,
        role: 'owner',
      },
      select: {
        email: true,
        id: true,
        isActive: true,
        role: true,
      },
    });
    console.log('[auth-bootstrap] Owner user already exists; ensured owner role and active status:', updated);
    return;
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: 'owner',
      isActive: true,
      passwordChangedAt: new Date(),
    },
    select: {
      email: true,
      id: true,
      isActive: true,
      role: true,
    },
  });

  console.log('[auth-bootstrap] Owner user created:', user);
}

main()
  .catch((error) => {
    console.error('[auth-bootstrap] Failed to create owner user:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
