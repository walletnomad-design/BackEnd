import type { Currency, Transaction } from "../types";
import { pool } from "../db/connection";
import type { Queryable } from "../repositories/queryable";
import { withTransaction } from "../repositories/queryable";
import { getWalletByUserId } from "./wallet.service";
import {
  addToBalance,
  createTransaction,
  findUserByEmail,
  getBalanceByWalletAndCurrency,
} from "../repositories";

/**
 * Errores de negocio de depósitos y transferencias. El controller de P3 los
 * traduce a códigos HTTP según el contrato del Sprint 3:
 * 400 inválido, 401 no autenticado, 404 destinatario inexistente,
 * 409 saldo insuficiente, 500 interno.
 */

export class InvalidMoneyOpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidMoneyOpError";
  }
}

export class MoneyOpRecipientNotFoundError extends Error {
  constructor(email: string) {
    super(`No existe un usuario con el email ${email}`);
    this.name = "MoneyOpRecipientNotFoundError";
  }
}

export class MoneyOpInsufficientBalanceError extends Error {
  readonly currency: Currency;
  readonly available: number;

  constructor(currency: Currency, available: number) {
    super(
      `Saldo insuficiente en ${currency}. Máximo disponible: ${available} ${currency}`
    );
    this.name = "MoneyOpInsufficientBalanceError";
    this.currency = currency;
    this.available = available;
  }
}

const SUPPORTED_CURRENCIES = ["USD", "EUR", "COP"] as const;

export interface DepositInput {
  userId: number;
  currency: Currency;
  amount: number;
}

export interface TransferInput {
  userId: number;
  toEmail: string;
  currency: Currency;
  amount: number;
}

const assertValidCurrency = (currency: Currency): void => {
  if (!SUPPORTED_CURRENCIES.includes(currency)) {
    throw new InvalidMoneyOpError(
      "La moneda debe ser una de las soportadas: USD, EUR o COP."
    );
  }
};

const assertValidAmount = (amount: number): void => {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new InvalidMoneyOpError("El monto debe ser un número positivo.");
  }
};

/**
 * Acredita `amount` de `currency` en la billetera del usuario y registra una
 * transacción tipo `deposit` (es un ingreso simulado del Sprint 3, no una
 * compra/venta real). Devuelve la transacción persistida.
 */
export const deposit = async (
  input: DepositInput,
  db: Queryable = pool
): Promise<Transaction> => {
  const { userId, currency, amount } = input;

  assertValidCurrency(currency);
  assertValidAmount(amount);

  return withTransaction(db, async (client) => {
    const wallet = await getWalletByUserId(userId, client);

    await addToBalance(wallet.id, currency, amount, client);

    const transaction = await createTransaction(
      {
        userId,
        walletId: wallet.id,
        type: "deposit",
        fromCurrency: currency,
        toCurrency: currency,
        fromAmount: amount,
        toAmount: amount,
        rate: 1,
        status: "completed",
      },
      client
    );

    return transaction;
  });
};

/**
 * Transfiere `amount` de `currency` desde la billetera del usuario hacia la
 * del destinatario (por email) y registra una transacción tipo `transfer` con
 * `toUserId` (para que el historial del destinatario la incluya también, vía
 * findTransactionsByUserId con user_id OR to_user_id). Es atómico: o se
 * debita y acredita junto con el historial, o no pasa nada.
 */
export const transfer = async (
  input: TransferInput,
  db: Queryable = pool
): Promise<Transaction> => {
  const { userId, toEmail, currency, amount } = input;

  if (typeof toEmail !== "string" || toEmail.trim() === "") {
    throw new InvalidMoneyOpError("El email del destinatario es obligatorio.");
  }
  assertValidCurrency(currency);
  assertValidAmount(amount);

  return withTransaction(db, async (client) => {
    const wallet = await getWalletByUserId(userId, client);

    const recipient = await findUserByEmail(toEmail.trim(), client);
    if (!recipient) {
      throw new MoneyOpRecipientNotFoundError(toEmail.trim());
    }
    if (recipient.id === userId) {
      throw new InvalidMoneyOpError(
        "No se puede transferir dinero a la propia cuenta."
      );
    }

    const fromBalance = await getBalanceByWalletAndCurrency(
      wallet.id,
      currency,
      client
    );
    if (!fromBalance) {
      throw new InvalidMoneyOpError(`No hay saldo registrado en ${currency}.`);
    }
    if (fromBalance.amount < amount) {
      throw new MoneyOpInsufficientBalanceError(currency, fromBalance.amount);
    }

    const toWallet = await getWalletByUserId(recipient.id, client);

    await addToBalance(wallet.id, currency, -amount, client);
    await addToBalance(toWallet.id, currency, amount, client);

    const transaction = await createTransaction(
      {
        userId,
        walletId: wallet.id,
        toUserId: recipient.id,
        type: "transfer",
        fromCurrency: currency,
        toCurrency: currency,
        fromAmount: amount,
        toAmount: amount,
        rate: 1,
        status: "completed",
      },
      client
    );

    return transaction;
  });
};

export const moneyOpsService = {
  deposit,
  transfer,
};