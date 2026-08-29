import type { BalanceListItem } from "./balance";
import type { Transaction } from "./transaction";
import type { Wallet } from "./wallet";

export interface BalanceResponse {
  balances: BalanceListItem[];
}

export interface TransactionResponse {
  transactions: Transaction[];
}

export interface WalletResponse {
  wallet: Wallet;
}

export interface ApiErrorBody {
  error: string;
  message: string;
}