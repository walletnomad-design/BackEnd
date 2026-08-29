import type { Balance, Currency } from "../types";
import { pool } from "../db/connection";
import type { Queryable } from "./queryable";

export const INITIAL_BALANCES: { currency: Currency; amount: number }[] = [
  { currency: "USD", amount: 1000 },
  { currency: "EUR", amount: 500 },
  { currency: "COP", amount: 2000000 },
];

interface BalanceRow {
  id: number;
  wallet_id: number;
  currency: Currency;
  amount: number;
  created_at: string | Date;
  updated_at: string | Date;
}

const toBalance = (row: BalanceRow): Balance => ({
  id: row.id,
  walletId: row.wallet_id,
  currency: row.currency,
  amount: row.amount,
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString(),
});

export const createInitialBalances = async (
  walletId: number,
  db: Queryable = pool
): Promise<Balance[]> => {
  const params: unknown[] = [walletId];
  const valuesSql = INITIAL_BALANCES.map((balance, index) => {
    params.push(balance.currency, balance.amount);
    const currencyParam = index * 2 + 2;
    const amountParam = index * 2 + 3;
    return `($1, $${currencyParam}, $${amountParam})`;
  }).join(", ");

  const result = await db.query<BalanceRow>(
    `INSERT INTO balances (wallet_id, currency, amount)
     VALUES ${valuesSql}
     RETURNING id, wallet_id, currency, amount::float8 AS amount, created_at, updated_at`,
    params
  );
  return result.rows.map(toBalance);
};

export const findBalancesByWalletId = async (
  walletId: number,
  db: Queryable = pool
): Promise<Balance[]> => {
  const result = await db.query<BalanceRow>(
    `SELECT id, wallet_id, currency, amount::float8 AS amount, created_at, updated_at
     FROM balances
     WHERE wallet_id = $1
     ORDER BY currency`,
    [walletId]
  );
  return result.rows.map(toBalance);
};