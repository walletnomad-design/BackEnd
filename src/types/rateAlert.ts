import type { Currency } from "./currency";

/**
 * Dirección de la alerta:
 *  - `gte`: se dispara cuando la tasa >= umbral (sube hasta el valor pedido).
 *  - `lte`: se dispara cuando la tasa <= umbral (baja hasta el valor pedido).
 */
export type RateAlertCondition = "gte" | "lte";

/** Mini-máquina de estados: active -> triggered; se puede rearmar a active. */
export type RateAlertStatus = "active" | "triggered";

export interface RateAlert {
  id: number;
  userId: number;
  fromCurrency: Currency;
  toCurrency: Currency;
  threshold: number;
  condition: RateAlertCondition;
  status: RateAlertStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRateAlertInput {
  userId: number;
  fromCurrency: Currency;
  toCurrency: Currency;
  threshold: number;
  condition?: RateAlertCondition;
}

/** Salida de `evaluateRateAlerts`: la alerta evaluada contra la tasa actual. */
export interface RateAlertEvaluation {
  alertId: number;
  fromCurrency: Currency;
  toCurrency: Currency;
  threshold: number;
  condition: RateAlertCondition;
  currentRate: number;
  triggered: boolean;
}