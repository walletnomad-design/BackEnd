import type { Currency } from "./currency";

/**
 * Tasas de cambio: cuánto vale 1 unidad de la moneda base en cada moneda.
 * Ej: base USD -> { USD: 1, EUR: 0.92, COP: 4000 }
 */
export type Rates = Record<Currency, number>;

/** Fuente de la que salieron las tasas (para logs y debug). */
export type RatesSource = "currencyfreaks" | "fallback" | "cache";

export interface RatesResult {
  base: Currency;
  rates: Rates;
  source: RatesSource;
  timestamp: string;
}

/**
 * Forma que devuelve la API de CurrencyFreaks
 * (GET https://api.currencyfreaks.com/v2.0/rates/latest?apikey=...&base=X&symbols=USD,EUR,COP).
 */
export interface CurrencyFreaksResponse {
  base: string;
  date: string;
  rates: Record<string, string>;
}
