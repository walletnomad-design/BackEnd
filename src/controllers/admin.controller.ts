import type { Request, Response } from "express";
import { getAdminMetrics } from "../services/admin.service";

export const getAdminSummaryController = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const metrics = await getAdminMetrics();

    res.status(200).json(metrics);
  } catch {
    res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "Error al obtener las métricas administrativas",
    });
  }
};