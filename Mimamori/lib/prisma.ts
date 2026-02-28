/**
 * Prisma client singleton for server-side database access.
 * Re-uses the same instance across hot-reloads in development.
 * Uses the better-sqlite3 driver adapter for Prisma 7.x compatibility.
 */

import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '@/app/generated/prisma/client';

const connectionString = process.env.DATABASE_URL ?? 'file:./dev.db';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: connectionString }),
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
