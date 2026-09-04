import type { CreateTransactionInput, Currency, Transaction } from "../types";
import { pool } from "../db/connection";
import type { Queryable } from "./queryable";

interface TransactionRow {
  id: number;
  user_id: number;
  wallet_id: number;
  type: string;
  currency: Currency;
  to_currency: Currency;
  amount: number;
  to_amount: number;
  rate: number;
  status: string;
  created_at: string | Date;
}

const toTransaction = (row: TransactionRow): Transaction => ({
  id: row.id,
  userId: row.user_id,
  walletId: row.wallet_id,
  type: row.type as Transaction["type"],
  fromCurrency: row.currency,
  toCurrency: row.to_currency,
  fromAmount: row.amount,
  toAmount: row.to_amount,
  rate: row.rate,
  status: row.status as Transaction["status"],
  createdAt: new Date(row.created_at).toISOString(),
});

export const createTransaction = async (
  data: CreateTransactionInput,
  db: Queryable = pool
): Promise<Transaction> => {
  const result = await db.query<TransactionRow>(
    `INSERT INTO transactions
       (user_id, wallet_id, type, currency, amount, to_currency, to_amount, rate, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, user_id, wallet_id, type,
               currency, to_currency,
               amount::float8 AS amount, to_amount::float8 AS to_amount,
               rate::float8 AS rate, status, created_at`,
    [
      data.userId,
      data.walletId,
      data.type,
      data.fromCurrency,
      data.fromAmount,
      data.toCurrency,
      data.toAmount,
      data.rate,
      data.status,
    ]
  );
  return toTransaction(result.rows[0]);
};

export const findTransactionsByUserId = async (
  userId: number,
  db: Queryable = pool
): Promise<Transaction[]> => {
  const result = await db.query<TransactionRow>(
    `SELECT id, user_id, wallet_id, type,
            currency, to_currency,
            amount::float8 AS amount, to_amount::float8 AS to_amount,
            rate::float8 AS rate, status, created_at
     FROM transactions
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows.map(toTransaction);
};
