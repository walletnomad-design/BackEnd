import type { Request, Response } from "express";
import {
  getWalletByUserId,
  WalletNotFoundError,
} from "../services/wallet.service";

export const getWallet = async (
  _req: Request,
  res: Response
): Promise<void> => {
  const userId = res.locals.userId;

  try {
    const wallet = await getWalletByUserId(userId);
    res.status(200).json({ wallet });
  } catch (error) {
    if (error instanceof WalletNotFoundError) {
      res.status(404).json({
        error: "WALLET_NOT_FOUND",
        message: error.message,
      });
      return;
    }

    throw error;
  }
};