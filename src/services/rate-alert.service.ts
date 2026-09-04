import type {
  CreateRateAlertInput,
  Currency,
  RateAlert,
  RateAlertCondition,
  RateAlertEvaluation,
} from "../types";
import { pool } from "../db/connection";
import type { Queryable } from "../repositories/queryable";
import {
  createRateAlert as createRateAlertRow,
  deleteRateAlert as deleteRateAlertRow,
  findActiveRateAlertsByUserId,
  findRateAlertsByUserId,
  markRateAlertTriggered,
  reactivateRateAlert as reactivateRateAlertRow,
} from "../repositories";
import { ratesService } from "./rates.service";

export class RateAlertValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateAlertValidationError";
  }
}

export class RateAlertNotFoundError extends Error {
  constructor(alertId: number) {
    super(`No existe la alerta ${alertId} para este usuario`);
    this.name = "RateAlertNotFoundError";
  }
}

export class RateAlertRateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateAlertRateError";
  }
}

const SUPPORTED_CURRENCIES: Currency[] = ["USD", "EUR", "COP"];
const SUPPORTED_CONDITIONS: RateAlertCondition[] = ["gte", "lte"];

const round6 = (n: number) => Math.round(n * 1000000) / 1000000;

export type RatesProvider = (
  base: Currency
) => Promise<{ rates: Record<Currency, number> }>;

export const createRateAlert = async (
  input: CreateRateAlertInput,
  db: Queryable = pool
): Promise<RateAlert> => {
  const condition = input.condition ?? "gte";

  if (input.fromCurrency === input.toCurrency) {
    throw new RateAlertValidationError(
      "La moneda de origen y la de destino no pueden ser la misma."
    );
  }
  if (
    !SUPPORTED_CURRENCIES.includes(input.fromCurrency) ||
    !SUPPORTED_CURRENCIES.includes(input.toCurrency)
  ) {
    throw new RateAlertValidationError(
      "Solo se soportan las monedas USD, EUR y COP."
    );
  }
  if (!Number.isFinite(input.threshold) || input.threshold <= 0) {
    throw new RateAlertValidationError(
      "El umbral debe ser un número positivo."
    );
  }
  if (!SUPPORTED_CONDITIONS.includes(condition)) {
    throw new RateAlertValidationError(
      "La condición debe ser 'gte' (sube) o 'lte' (baja)."
    );
  }

  return createRateAlertRow(
    {
      userId: input.userId,
      fromCurrency: input.fromCurrency,
      toCurrency: input.toCurrency,
      threshold: round6(input.threshold),
      condition,
    },
    db
  );
};

export const listRateAlertsByUserId = async (
  userId: number,
  db: Queryable = pool
): Promise<RateAlert[]> => findRateAlertsByUserId(userId, db);

export const removeRateAlert = async (
  userId: number,
  alertId: number,
  db: Queryable = pool
): Promise<void> => {
  const deleted = await deleteRateAlertRow(alertId, userId, db);
  if (!deleted) {
    throw new RateAlertNotFoundError(alertId);
  }
};

export const reactivateRateAlert = async (
  userId: number,
  alertId: number,
  db: Queryable = pool
): Promise<RateAlert> => {
  const alert = await reactivateRateAlertRow(alertId, userId, db);
  if (!alert) {
    throw new RateAlertNotFoundError(alertId);
  }
  return alert;
};

const meetsCondition = (
  currentRate: number,
  threshold: number,
  condition: RateAlertCondition
): boolean =>
  condition === "gte" ? currentRate >= threshold : currentRate <= threshold;

/**
 * Evalúa las alertas ACTIVAS de un usuario contra la tasa actual y marca como
 * `triggered` las que se cumplieron (fired). Agrupa por moneda base para
 * hacer una sola llamada a la API de tasas por moneda y no una por alerta.
 *
 * Los errores del proveedor de tasas se propagan como RateAlertRateError
 * (el controller de P3 mapearía a 502 como en exchange).
 */
export const evaluateRateAlerts = async (
  userId: number,
  db: Queryable = pool,
  ratesProvider: RatesProvider = (base) => ratesService.getRates(base)
): Promise<RateAlertEvaluation[]> => {
  const active = await findActiveRateAlertsByUserId(userId, db);

  const byBase = new Map<Currency, RateAlert[]>();
  for (const alert of active) {
    const list = byBase.get(alert.fromCurrency);
    if (list) {
      list.push(alert);
    } else {
      byBase.set(alert.fromCurrency, [alert]);
    }
  }

  const evaluations: RateAlertEvaluation[] = [];

  for (const [base, alerts] of byBase) {
    let rates: Record<Currency, number>;
    try {
      rates = (await ratesProvider(base)).rates;
    } catch {
      throw new RateAlertRateError(
        `No se pudo obtener la tasa de ${base} para las alertas.`
      );
    }

    for (const alert of alerts) {
      const currentRate = rates[alert.toCurrency];
      if (!Number.isFinite(currentRate) || currentRate <= 0) {
        throw new RateAlertRateError(
          `Tasa inválida para ${alert.fromCurrency}->${alert.toCurrency}.`
        );
      }

      const triggered = meetsCondition(
        currentRate,
        alert.threshold,
        alert.condition
      );

      if (triggered) {
        await markRateAlertTriggered(alert.id, userId, db);
      }

      evaluations.push({
        alertId: alert.id,
        fromCurrency: alert.fromCurrency,
        toCurrency: alert.toCurrency,
        threshold: alert.threshold,
        condition: alert.condition,
        currentRate,
        triggered,
      });
    }
  }

  return evaluations;
};

export const rateAlertService = {
  createRateAlert,
  listRateAlertsByUserId,
  removeRateAlert,
  reactivateRateAlert,
  evaluateRateAlerts,
};