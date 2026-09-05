import type { Request, Response } from "express";
import type { Currency, RateAlertCondition } from "../types";

import {
  createRateAlert,
  listRateAlertsByUserId,
  removeRateAlert,
  reactivateRateAlert,
  evaluateRateAlerts,
  RateAlertValidationError,
  RateAlertNotFoundError,
  RateAlertRateError,
} from "../services/rate-alert.service";

const SUPPORTED_CURRENCIES: Currency[] = ["USD", "EUR", "COP"];
const SUPPORTED_CONDITIONS: RateAlertCondition[] = ["gte", "lte"];

const getAlertId = (
  value: string | string[] | undefined
): number | null => {
  if (typeof value !== "string") {
    return null;
  }

  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
};

export const createRateAlertController = async (
  req: Request,
  res: Response
): Promise<void> => {
  const userId = res.locals.userId;
  const { fromCurrency, toCurrency, threshold, condition } = req.body;

  if (
    !SUPPORTED_CURRENCIES.includes(fromCurrency as Currency) ||
    !SUPPORTED_CURRENCIES.includes(toCurrency as Currency) ||
    typeof threshold !== "number" ||
    (condition !== undefined &&
      !SUPPORTED_CONDITIONS.includes(condition as RateAlertCondition))
  ) {
    res.status(400).json({
      error: "INVALID_INPUT",
      message: "Datos de alerta inválidos",
    });
    return;
  }

  try {
    const alert = await createRateAlert({
      userId,
      fromCurrency: fromCurrency as Currency,
      toCurrency: toCurrency as Currency,
      threshold,
      condition: condition as RateAlertCondition | undefined,
    });

    res.status(201).json({ alert });
  } catch (error) {
    if (error instanceof RateAlertValidationError) {
      res.status(400).json({
        error: "RATE_ALERT_VALIDATION_ERROR",
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "Error interno del servidor",
    });
  }
};

export const listRateAlertsController = async (
  _req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = res.locals.userId;
    const alerts = await listRateAlertsByUserId(userId);

    res.status(200).json({ alerts });
  } catch {
    res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "Error interno del servidor",
    });
  }
};

export const removeRateAlertController = async (
  req: Request,
  res: Response
): Promise<void> => {
  const userId = res.locals.userId;
  const alertId = getAlertId(req.params.id);

  if (alertId === null) {
    res.status(400).json({
      error: "INVALID_ALERT_ID",
      message: "ID de alerta inválido",
    });
    return;
  }

  try {
    await removeRateAlert(userId, alertId);

    res.status(204).send();
  } catch (error) {
    if (error instanceof RateAlertNotFoundError) {
      res.status(404).json({
        error: "RATE_ALERT_NOT_FOUND",
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "Error interno del servidor",
    });
  }
};

export const reactivateRateAlertController = async (
  req: Request,
  res: Response
): Promise<void> => {
  const userId = res.locals.userId;
  const alertId = getAlertId(req.params.id);

  if (alertId === null) {
    res.status(400).json({
      error: "INVALID_ALERT_ID",
      message: "ID de alerta inválido",
    });
    return;
  }

  try {
    const alert = await reactivateRateAlert(userId, alertId);

    res.status(200).json({ alert });
  } catch (error) {
    if (error instanceof RateAlertNotFoundError) {
      res.status(404).json({
        error: "RATE_ALERT_NOT_FOUND",
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "Error interno del servidor",
    });
  }
};

export const evaluateRateAlertsController = async (
  _req: Request,
  res: Response
): Promise<void> => {
  const userId = res.locals.userId;

  try {
    const evaluations = await evaluateRateAlerts(userId);

    res.status(200).json({ evaluations });
  } catch (error) {
    if (error instanceof RateAlertRateError) {
      res.status(502).json({
        error: "RATES_UNAVAILABLE",
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "Error interno del servidor",
    });
  }
};