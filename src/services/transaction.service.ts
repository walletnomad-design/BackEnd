import { findTransactionsByUserId } from "../repositories/transaction.repository";

export const getTransactionsByUserId = async (userId: number) => {
  return findTransactionsByUserId(userId);
};