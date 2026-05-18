const { PrismaClient } = require('./src/generated/prisma/client');
const prisma = new PrismaClient();
console.log('Prisma keys:', Object.keys(prisma).filter(k => !k.startsWith('_')));
process.exit(0);
