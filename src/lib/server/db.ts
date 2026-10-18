import { PrismaClient } from '@prisma/client'
const globalDb = globalThis as unknown as { contribchainDb?: PrismaClient }
export const db = globalDb.contribchainDb ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') globalDb.contribchainDb = db
