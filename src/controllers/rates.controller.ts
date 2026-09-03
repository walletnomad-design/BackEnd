import type { Request, Response } from "express";
import type { Currency } from "../types";
import { getRates } from "../services/rates.service";

const SUPPORTED_CURRENCIES: Currency[] = ["USD", "EUR", "COP"];

export const getRatesController = async (
  req: Request,
  res: Response
): Promise<void> => {
  const from = String(req.query.from ?? "USD").toUpperCase();

  if (!SUPPORTED_CURRENCIES.includes(from as Currency)) {
    res.status(400).json({
      error: "UNSUPPORTED_CURRENCY",
      message: "Moneda no soportada",
    });
    return;
  }

  const result = await getRates(from as Currency);

  res.status(200).json(result);
};