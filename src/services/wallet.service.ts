import type { Wallet } from "../types";
import { findWalletByUserId } from "../repositories";
import { pool } from "../db/connection";
import type { Queryable } from "../repositories/queryable";

export class WalletNotFoundError extends Error {
  constructor(userId: number) {
    super(`No existe la billetera para el usuario ${userId}`);
    this.name = "WalletNotFoundError";
  }
}

export const getWalletByUserId = async (
  userId: number,
  db: Queryable = pool
): Promise<Wallet> => {
  const wallet = await findWalletByUserId(userId, db);
  if (!wallet) {
    throw new WalletNotFoundError(userId);
  }
  return wallet;
};

export const walletService = {
  getWalletByUserId,
};