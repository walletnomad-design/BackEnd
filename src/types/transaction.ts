import type { Currency } from "./currency";

export interface Transaction {
  id: number;
  userId: number;
  walletId: number;
  currency: Currency;
  amount: number;
  type: string;
  createdAt: string;
}

export interface NewTransactionInput {
  userId: number;
  walletId: number;
  currency: Currency;
  amount: number;
  type: string;
}