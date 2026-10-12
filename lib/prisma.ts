import { PrismaClient } from '@prisma/client'
import type { Prisma } from '@prisma/client'

const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export async function withSerializableRetry<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
  attempts = 3
): Promise<T> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await prisma.$transaction(operation, { isolationLevel: 'Serializable' })
    } catch (error) {
      const isSerializationConflict =
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2034'

      if (!isSerializationConflict || attempt === attempts - 1) throw error
      await new Promise(resolve => setTimeout(resolve, 20 * (attempt + 1)))
    }
  }

  throw new Error('Transaksi gagal setelah beberapa percobaan.')
}
