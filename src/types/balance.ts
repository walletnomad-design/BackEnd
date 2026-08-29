import type { Currency } from "./currency";

export interface Balance {
  id: number;
  walletId: number;
  currency: Currency;
  amount: number;
  createdAt: string;
  updatedAt: string;
}

export interface BalanceListItem {
  currency: Currency;
  amount: number;
}

export interface NewBalanceInput {
  walletId: number;
  currency: Currency;
  amount: number;
}