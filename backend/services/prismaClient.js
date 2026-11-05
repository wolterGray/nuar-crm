const {PrismaClient} = require('@prisma/client');

// Every runtime route and worker must share one connection pool.
const prisma = new PrismaClient();

module.exports = {prisma};
