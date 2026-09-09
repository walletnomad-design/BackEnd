import type { Transaction } from "../types";
import { findUserById } from "../repositories";
import { buildOperationEmailData } from "./email-operation.service";

export const sendTransactionEmail = async (
  userId: number,
  transaction: Transaction,
  perspective: "sent" | "received" = "sent"
): Promise<void> => {
  try {
    const functionUrl = process.env.EMAIL_FUNCTION_URL;
    const secret = process.env.EMAIL_FUNCTION_SECRET;

    if (!functionUrl || !secret) {
      console.error("SES: faltan EMAIL_FUNCTION_URL o EMAIL_FUNCTION_SECRET");
      return;
    }

    const user = await findUserById(userId);

    if (!user) {
      console.error(`SES: usuario ${userId} no encontrado`);
      return;
    }

    const data = buildOperationEmailData(transaction);

    const response = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-email-secret": secret,
      },
      body: JSON.stringify({
        email: user.email,
        type: data.type,
        fromAmount: data.fromAmount,
        fromCurrency: data.fromCurrency,
        toAmount: data.toAmount,
        toCurrency: data.toCurrency,
        rate: data.rate,
        timestamp: data.createdAt,
        perspective,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();

      console.error(
        "SES: error desde Vercel:",
        response.status,
        errorText
      );

      return;
    }

    console.log(
      `SES: email enviado para transacción ${transaction.id} a ${user.email}`
    );
  } catch (error) {
    console.error("SES: error enviando confirmación:", error);
  }
};