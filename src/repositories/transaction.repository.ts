import type { Currency, Transaction } from "../types";
import { pool } from "../db/connection";
import type { Queryable } from "./queryable";

interface TransactionRow {
  id: number;
  user_id: number;
  wallet_id: number;
  currency: Currency;
  amount: number;
  type: string;
  created_at: string | Date;
}

const toTransaction = (row: TransactionRow): Transaction => ({
  id: row.id,
  userId: row.user_id,
  walletId: row.wallet_id,
  currency: row.currency,
  amount: row.amount,
  type: row.type,
  createdAt: new Date(row.created_at).toISOString(),
});

export const findTransactionsByUserId = async (
  userId: number,
  db: Queryable = pool
): Promise<Transaction[]> => {
  const result = await db.query<TransactionRow>(
    `SELECT id, user_id, wallet_id, currency, amount::float8 AS amount, type, created_at
     FROM transactions
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows.map(toTransaction);
};