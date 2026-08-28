import type { Request, Response } from "express";

export const getBalances = async (
  _req: Request,
  res: Response
): Promise<void> => {
  res.status(501).json({
    message: "Balances pendientes de conexión con servicio",
  });
};