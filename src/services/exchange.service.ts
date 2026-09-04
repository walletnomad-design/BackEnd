import type { Currency, Transaction, TransactionType } from "../types";
import { pool } from "../db/connection";
import { withTransaction } from "../repositories/queryable";
import type { Queryable } from "../repositories/queryable";
import { getWalletByUserId } from "./wallet.service";
import { ratesService } from "./rates.service";
import { getBalanceByWalletAndCurrency, addToBalance, createTransaction } from "../repositories";

/**
 * Errores de negocio del exchange. El controller de P3 los traduce a códigos HTTP
 * según el contrato maestro: 400 inválido, 401 no autenticado, 404 wallet inexistente,
 * 409 saldo insuficiente, 500 interno, 502 servicio de tasas no disponible.
 */

export class InsufficientBalanceError extends Error {
  constructor(currency: Currency) {
    super(`Saldo insuficiente en ${currency}`);
    this.name = "InsufficientBalanceError";
  }
}

export class InvalidExchangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidExchangeError";
  }
}

export class ExchangeRateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExchangeRateError";
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const round6 = (n: number) => Math.round(n * 1000000) / 1000000;

export interface ExchangeInput {
  userId: number;
  type: TransactionType;
  fromCurrency: Currency;
  toCurrency: Currency;
  amount: number;
}

export type RatesProvider = (base: Currency) => Promise<{
  rates: Record<Currency, number>;
}>;

export const exchange = async (
  input: ExchangeInput,
  db: Queryable = pool,
  ratesProvider: RatesProvider = (base) => ratesService.getRates(base)
): Promise<Transaction> => {
  const { userId, type, fromCurrency, toCurrency, amount } = input;

  if (fromCurrency === toCurrency) {
    throw new InvalidExchangeError(
      "La moneda de origen y la de destino no pueden ser la misma."
    );
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new InvalidExchangeError("El monto debe ser un número positivo.");
  }

  return withTransaction(db, async (client) => {
    const wallet = await getWalletByUserId(userId, client);

    const fromBalance = await getBalanceByWalletAndCurrency(
      wallet.id,
      fromCurrency,
      client
    );
    if (!fromBalance) {
      throw new InvalidExchangeError(
        `No hay saldo registrado en ${fromCurrency}.`
      );
    }
    if (fromBalance.amount < amount) {
      throw new InsufficientBalanceError(fromCurrency);
    }

    let rate: number;
    try {
      const rates = (await ratesProvider(fromCurrency)).rates;
      rate = rates[toCurrency];
      if (!Number.isFinite(rate) || rate <= 0) {
        throw new Error("tasa no válida");
      }
    } catch {
      throw new ExchangeRateError("No se pudo obtener la tasa de cambio.");
    }

    const toAmount = round2(amount * rate);
    const rateRounded = round6(rate);

    await addToBalance(wallet.id, fromCurrency, -amount, client);
    await addToBalance(wallet.id, toCurrency, toAmount, client);

    const transaction = await createTransaction(
      {
        userId,
        walletId: wallet.id,
        type,
        fromCurrency,
        toCurrency,
        fromAmount: amount,
        toAmount,
        rate: rateRounded,
        status: "completed",
      },
      client
    );

    return transaction;
  });
};

export const exchangeService = {
  exchange,
};
