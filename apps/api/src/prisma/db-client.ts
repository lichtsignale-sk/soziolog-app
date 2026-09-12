import type { Prisma, PrismaClient } from '@prisma/client';
import type { PrismaService } from './prisma.service';

/**
 * Prisma-Client ODER Transaktions-Client. Services akzeptieren diesen Typ,
 * damit sie an einer umschließenden interaktiven Transaktion teilnehmen können
 * (z. B. der Setup-Assistent legt alles in EINER Transaktion an).
 */
export type DbClient = PrismaService | PrismaClient | Prisma.TransactionClient;
