import type { Wallet } from "../types";
import { pool } from "../db/connection";
import type { Queryable } from "./queryable";

interface WalletRow {
  id: number;
  user_id: number;
  created_at: string | Date;
}

const toWallet = (row: WalletRow): Wallet => ({
  id: row.id,
  userId: row.user_id,
  createdAt: new Date(row.created_at).toISOString(),
});

export const createWalletForUser = async (
  userId: number,
  db: Queryable = pool
): Promise<Wallet> => {
  const result = await db.query<WalletRow>(
    `INSERT INTO wallets (user_id)
     VALUES ($1)
     RETURNING id, user_id, created_at`,
    [userId]
  );
  return toWallet(result.rows[0]);
};

export const findWalletByUserId = async (
  userId: number,
  db: Queryable = pool
): Promise<Wallet | null> => {
  const result = await db.query<WalletRow>(
    "SELECT id, user_id, created_at FROM wallets WHERE user_id = $1",
    [userId]
  );
  return result.rows[0] ? toWallet(result.rows[0]) : null;
};