import type { Currency } from "./currency";
import type { TransactionStatus, TransactionType } from "./transaction";

/**
 * Datos de una operación lista para el email de confirmación (AWS SES).
 * Quién lo envía y con qué SDK es decisión de P3 (Vercel Function); P2 entrega
 * este payload ya mapeado desde la `Transaction` persistida.
 */
export interface OperationEmailData {
  transactionId: number;
  type: TransactionType;
  fromCurrency: Currency;
  fromAmount: number;
  toCurrency: Currency;
  toAmount: number;
  rate: number;
  status: TransactionStatus;
  createdAt: string;
}