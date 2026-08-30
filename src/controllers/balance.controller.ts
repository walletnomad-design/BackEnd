import type { Request, Response } from "express";
import { getWalletByUserId } from "../services/wallet.service";
import { getBalancesByWalletId } from "../services/balance.service";

export const getBalances = async (
  _req: Request,
  res: Response
): Promise<void> => {
  const userId = res.locals.userId;

  const wallet = await getWalletByUserId(userId);
  const balances = await getBalancesByWalletId(wallet.id);

  res.status(200).json({ balances });
};