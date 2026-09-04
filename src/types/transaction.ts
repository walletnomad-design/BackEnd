import type { Currency } from "./currency";

export type TransactionType = "buy" | "sell" | "exchange";
export type TransactionStatus = "completed" | "failed";

export interface Transaction {
  id: number;
  userId: number;
  walletId: number;
  type: TransactionType;
  fromCurrency: Currency;
  toCurrency: Currency;
  fromAmount: number;
  toAmount: number;
  rate: number;
  status: TransactionStatus;
  createdAt: string;
}

export interface CreateTransactionInput {
  userId: number;
  walletId: number;
  type: TransactionType;
  fromCurrency: Currency;
  toCurrency: Currency;
  fromAmount: number;
  toAmount: number;
  rate: number;
  status: TransactionStatus;
}
