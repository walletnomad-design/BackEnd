import type { Request, Response } from "express";
import type { Currency } from "../types";
import { sendTransactionEmail } from "../services/email-notification.service";

import {
  transfer,
  InvalidMoneyOpError,
  MoneyOpRecipientNotFoundError,
  MoneyOpInsufficientBalanceError,
} from "../services/money-ops.service";

export const transferController = async (
  req: Request,
  res: Response
): Promise<void> => {
  const userId = res.locals.userId as number;
  const { toEmail, currency, amount } = req.body;

  try {
      const transaction = await transfer({
        userId,
        toEmail,
        currency: currency as Currency,
        amount,
      });

      await sendTransactionEmail(userId, transaction, "sent");

      if (transaction.toUserId) {
        await sendTransactionEmail(
          transaction.toUserId,
          transaction,
          "received"
        );
      }

      res.status(201).json({ transaction });

  } catch (error) {
    if (error instanceof InvalidMoneyOpError) {
      res.status(400).json({
        error: "INVALID_MONEY_OPERATION",
        message: error.message,
      });
      return;
    }

    if (error instanceof MoneyOpRecipientNotFoundError) {
      res.status(404).json({
        error: "RECIPIENT_NOT_FOUND",
        message: error.message,
      });
      return;
    }

    if (error instanceof MoneyOpInsufficientBalanceError) {
      res.status(409).json({
        error: "INSUFFICIENT_BALANCE",
        message: error.message,
        currency: error.currency,
        available: error.available,
      });
      return;
    }

    console.error("Error en transferencia:", error);

    res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "Error al realizar la transferencia",
    });
  }
};