import type { BalanceListItem } from "../types";
import { findBalancesByWalletId } from "../repositories";
import { pool } from "../db/connection";
import type { Queryable } from "../repositories/queryable";

export const getBalancesByWalletId = async (
  walletId: number,
  db: Queryable = pool
): Promise<BalanceListItem[]> => {
  const balances = await findBalancesByWalletId(walletId, db);
  return balances.map(({ currency, amount }) => ({ currency, amount }));
};

export const balanceService = {
  getBalancesByWalletId,
};