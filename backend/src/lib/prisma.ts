import { PrismaClient } from '@prisma/client';

import { env } from '../config/env';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  global.__prisma ??
  new PrismaClient({
    log: env.nodeEnv === 'development' ? ['warn', 'error'] : ['error'],
  });

// Reuse a single client across (serverless) invocations to avoid exhausting
// the database's connection pool. Safe in all environments.
global.__prisma = prisma;
