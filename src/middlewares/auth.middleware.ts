import type { Request, Response, NextFunction } from "express";
import { verifyToken, type UserRole } from "../utils/jwt";

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

    const role: UserRole =
      decoded.role === "admin" ? "admin" : "user";

    res.locals.userId = decoded.userId;
    res.locals.role = role;

    next();
  } catch {
    res.status(401).json({
      error: "UNAUTHORIZED",
      message: "Token inválido",
    });
  }
};

export const requireAdmin = (
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (res.locals.role !== "admin") {
    res.status(403).json({
      error: "FORBIDDEN",
      message: "Acceso exclusivo para administradores",
    });
    return;
  }

  next();
};