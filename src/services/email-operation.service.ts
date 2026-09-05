import type { Transaction } from "../types";
import type { OperationEmailData } from "../types/operationEmail";

const round2 = (n: number) => Math.round(n * 100) / 100;
const round6 = (n: number) => Math.round(n * 1000000) / 1000000;

const TYPE_LABELS: Record<OperationEmailData["type"], string> = {
  buy: "Compraste",
  sell: "Vendiste",
  exchange: "Intercambiaste",
};

/**
 * Mapea una `Transaction` persistida (compra/venta/intercambio) al payload del
 * email de confirmación: monedas y montos claros, tasa redondeada a 6, monto a 2,
 * estado y fecha ISO. No toca la base de datos: es una proyección pura.
 */
export const buildOperationEmailData = (
  transaction: Transaction
): OperationEmailData => ({
  transactionId: transaction.id,
  type: transaction.type,
  fromCurrency: transaction.fromCurrency,
  fromAmount: round2(transaction.fromAmount),
  toCurrency: transaction.toCurrency,
  toAmount: round2(transaction.toAmount),
  rate: round6(transaction.rate),
  status: transaction.status,
  createdAt: new Date(transaction.createdAt).toISOString(),
});

/**
 * Línea de texto legible para el cuerpo del email, determinística y sin locale
 * (puntos/commas estándar), para que P1/P3 solo la interpoleen.
 * Ej.: "Compraste 100.00 USD por 91.30 EUR a tasa 0.913000 (completed)"
 */
export const operationEmailSummary = (data: OperationEmailData): string =>
  `${TYPE_LABELS[data.type]} ${data.fromAmount.toFixed(2)} ${data.fromCurrency} por ` +
  `${data.toAmount.toFixed(2)} ${data.toCurrency} a tasa ${data.rate.toFixed(6)} ` +
  `(${data.status})`;

export const emailOperationService = {
  buildOperationEmailData,
  operationEmailSummary,
};