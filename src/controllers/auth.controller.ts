import type { Request, Response } from "express";

export const registerUser = async (
  _req: Request,
  res: Response
): Promise<void> => {
  res.status(501).json({
    message: "Register pendiente de conexión con base de datos",
  });
};

export const loginUser = async (
  _req: Request,
  res: Response
): Promise<void> => {
  res.status(501).json({
    message: "Login pendiente de conexión con base de datos",
  });
};