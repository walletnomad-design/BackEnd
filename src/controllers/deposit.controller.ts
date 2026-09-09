import type { Request, Response } from "express";
import type { Currency } from "../types";
import { sendTransactionEmail } from "../services/email-notification.service";

import {
  deposit,
  InvalidMoneyOpError,
} from "../services/money-ops.service";

export const depositController = async (
  req: Request,
  res: Response
): Promise<void> => {
  const userId = res.locals.userId as number;
  const { currency, amount } = req.body;

  try {
    const transaction = await deposit({
      userId,
      currency: currency as Currency,
      amount,
    });

  await sendTransactionEmail(userId, transaction);

    res.status(201).json({ transaction });
  } catch (error) {
    if (error instanceof InvalidMoneyOpError) {
      res.status(400).json({
        error: "INVALID_MONEY_OPERATION",
        message: error.message,
      });
      return;
    }

    console.error("Error en depósito:", error);

    res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "Error al realizar el depósito",
    });
  }
};