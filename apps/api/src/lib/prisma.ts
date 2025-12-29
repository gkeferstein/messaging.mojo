import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.isDev ? ['query', 'error', 'warn'] : ['error'],
  });

if (!env.isProd) {
  globalForPrisma.prisma = prisma;
}

export default prisma;


