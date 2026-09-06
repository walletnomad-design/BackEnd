import type { Currency, RatesResult, UserAiContext } from "../types";
import { pool } from "../db/connection";
import type { Queryable } from "../repositories/queryable";
import { findUserById, findTransactionsByUserId } from "../repositories";
import { getWalletByUserId } from "./wallet.service";
import { getBalancesByWalletId } from "./balance.service";
import { listGoalsByUserId } from "./goals.service";
import { ratesService } from "./rates.service";

/**
 * Contexto del usuario para Nomad AI (Sprint 2 · Etapa 6).
 *
 * `buildUserAiContext(userId)` arma un snapshot aislado por usuario con
 * identidad, balances, transacciones recientes, metas con progreso y tasas
 * actuales de las monedas soportadas. Es la pieza que P2 entrega para que
 * P3 monte el endpoint `/api/ai/chat` sin exponer PostgreSQL a Gemini.
 *
 * - Nunca cruza datos de otro usuario (todo parte de `userId`).
 * - Nunca incluye `password`.
 * - Tiene caché con TTL corto para no pegar a CurrencyFreaks por cada pregunta.
 */

const SUPPORTED_CURRENCIES: Currency[] = ["USD", "EUR", "COP"];
const RECENT_TRANSACTIONS_LIMIT = 10;
const AI_CONTEXT_TTL_MS = 30 * 1000;

export class AiContextUserNotFoundError extends Error {
  constructor(userId: number) {
    super(`No existe el usuario ${userId}`);
    this.name = "AiContextUserNotFoundError";
  }
}

interface AiContextCacheEntry {
  context: UserAiContext;
  createdAt: number;
}

const cache = new Map<number, AiContextCacheEntry>();

export type RatesProviderForContext = (base: Currency) => Promise<RatesResult>;

const readCached = (userId: number): UserAiContext | null => {
  const entry = cache.get(userId);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > AI_CONTEXT_TTL_MS) {
    cache.delete(userId);
    return null;
  }
  return entry.context;
};

const storeInCache = (userId: number, context: UserAiContext) => {
  cache.set(userId, { context, createdAt: Date.now() });
};

const withRates = async (
  ratesProvider: RatesProviderForContext
): Promise<Record<Currency, RatesResult>> => {
  const entries = await Promise.all(
    SUPPORTED_CURRENCIES.map(async (base) => {
      const result = await ratesProvider(base);
      return [base, result] as const;
    })
  );
  return Object.fromEntries(entries) as Record<Currency, RatesResult>;
};

export const buildUserAiContext = async (
  userId: number,
  db: Queryable = pool,
  ratesProvider: RatesProviderForContext = (base) => ratesService.getRates(base)
): Promise<UserAiContext> => {
  const cached = readCached(userId);
  if (cached) return cached;

  const user = await findUserById(userId, db);
  if (!user) {
    throw new AiContextUserNotFoundError(userId);
  }

  const wallet = await getWalletByUserId(userId, db);
  const balances = await getBalancesByWalletId(wallet.id, db);
  const transactions = await findTransactionsByUserId(userId, db);
  const goals = await listGoalsByUserId(userId, db);

  const context: UserAiContext = {
    userId,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      dni: user.dni,
    },
    balances,
    recentTransactions: transactions.slice(0, RECENT_TRANSACTIONS_LIMIT),
    goals,
    supportedCurrencies: SUPPORTED_CURRENCIES,
    rates: await withRates(ratesProvider),
    builtAt: new Date().toISOString(),
  };

  storeInCache(userId, context);
  return context;
};

export const aiContextService = {
  buildUserAiContext,
};