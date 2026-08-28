import type { Request, Response } from "express";

export const getWallet = async (
  _req: Request,
  res: Response
): Promise<void> => {
  res.status(501).json({
    message: "Wallet pendiente de conexión con servicio",
  });
};