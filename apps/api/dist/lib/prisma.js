import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';
const globalForPrisma = globalThis;
export const prisma = globalForPrisma.prisma ??
    new PrismaClient({
        log: env.isDev ? ['query', 'error', 'warn'] : ['error'],
    });
if (!env.isProd) {
    globalForPrisma.prisma = prisma;
}
export default prisma;
//# sourceMappingURL=prisma.js.map