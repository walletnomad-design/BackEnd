import type { Request, Response } from "express";
import type { Currency, TransactionType } from "../types";

import {
  exchange,
  InsufficientBalanceError,
  InvalidExchangeError,
  ExchangeRateError,
} from "../services/exchange.service";

import { WalletNotFoundError } from "../services/wallet.service";

const SUPPORTED_CURRENCIES: Currency[] = ["USD", "EUR", "COP"];
const SUPPORTED_TYPES: TransactionType[] = ["buy", "sell", "exchange"];

export const exchangeCurrency = async (
  req: Request,
  res: Response
): Promise<void> => {
  const userId = res.locals.userId;

  const { type, fromCurrency, toCurrency, amount } = req.body;

  if (
    !SUPPORTED_TYPES.includes(type as TransactionType) ||
    !SUPPORTED_CURRENCIES.includes(fromCurrency as Currency) ||
    !SUPPORTED_CURRENCIES.includes(toCurrency as Currency) ||
    typeof amount !== "number"
  ) {
    res.status(400).json({
      error: "INVALID_INPUT",
      message: "Datos de operación inválidos",
    });
    return;
  }

  try {
    const transaction = await exchange({
      userId,
      type: type as TransactionType,
      fromCurrency: fromCurrency as Currency,
      toCurrency: toCurrency as Currency,
      amount,
    });

    res.status(200).json({ transaction });
  } catch (error) {
    if (error instanceof InvalidExchangeError) {
      res.status(400).json({
        error: "INVALID_EXCHANGE",
        message: error.message,
      });
      return;
    }

    if (error instanceof WalletNotFoundError) {
      res.status(404).json({
        error: "WALLET_NOT_FOUND",
        message: error.message,
      });
      return;
    }

    if (error instanceof InsufficientBalanceError) {
      res.status(409).json({
        error: "INSUFFICIENT_BALANCE",
        message: error.message,
      });
      return;
    }

    if (error instanceof ExchangeRateError) {
      res.status(502).json({
        error: "RATES_UNAVAILABLE",
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "Error interno del servidor",
    });
  }
};