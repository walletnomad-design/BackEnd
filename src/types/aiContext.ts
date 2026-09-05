import type { Currency } from "./currency";
import type { Goal } from "./goal";
import type { Transaction } from "./transaction";

/**
 * Contexto del usuario para Nomad AI (Sprint 2 · Etapa 6).
 *
 * Snapshot único y aislado por usuario que el backend le entrega al asistente
 * cuando este responde sobre la cartera. Gemini NUNCA accede a PostgreSQL:
 * la capa de servicio arma este payload y P3 se lo pasa al endpoint
 * `/api/ai/chat` según la consulta.
 *
 * Nunca incluye `password` ni datos sensibles de otros usuarios.
 */
export interface AiContextUser {
  id: number;
  email: string;
  firstName?: string;
  lastName?: string;
  dni?: string;
}

export interface AiContextBalance {
  currency: Currency;
  amount: number;
}

export interface AiContextRates {
  base: Currency;
  rates: Record<Currency, number>;
  source: string;
  timestamp: string;
}

export interface UserAiContext {
  userId: number;
  user: AiContextUser;
  balances: AiContextBalance[];
  recentTransactions: Transaction[];
  goals: Goal[];
  supportedCurrencies: Currency[];
  rates: Record<Currency, AiContextRates>;
  builtAt: string;
}