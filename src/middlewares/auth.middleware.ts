import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt";

export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({
      error: "UNAUTHORIZED",
      message: "Token requerido",
    });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = verifyToken(token);

    if (typeof decoded === "string" || typeof decoded.userId !== "number") {
      res.status(401).json({
        error: "UNAUTHORIZED",
        message: "Token inválido",
      });
      return;
    }

    res.locals.userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({
      error: "UNAUTHORIZED",
      message: "Token inválido",
    });
  }
};