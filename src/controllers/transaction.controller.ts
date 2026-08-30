import type { Request, Response } from "express";
import { getTransactionsByUserId } from "../services/transaction.service";

export const getTransactions = async (
  _req: Request,
  res: Response
): Promise<void> => {
  const userId = res.locals.userId;

  const transactions = await getTransactionsByUserId(userId);

  res.status(200).json({ transactions });
};