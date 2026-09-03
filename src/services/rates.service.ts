import type { Currency, Rates, RatesResult, CurrencyFreaksResponse } from "../types";

/**
 * Servicio de tasas de cambio (Sprint 2 · P2).
 *
 * Consulta la API de CurrencyFreaks para obtener cuánto vale 1 unidad de una
 * moneda base en USD, EUR y COP. Incluye:
 *   - Caché en memoria con TTL (evita gastar cuota/requests).
 *   - Fallback con tasas fijas si la API falla o no hay API key configurada.
 *
 * La API key vive SOLO en el backend (process.env.CURRENCYFREAKS_API_KEY),
 * nunca en el frontend.
 */

const SUPPORTED: Currency[] = ["USD", "EUR", "COP"];

/** Tasas de respaldo (aproximadas, para que la app siga viva si el proveedor cae). */
const FALLBACK_RATES: Record<Currency, number> = {
  USD: 1,
  EUR: 0.93,
  COP: 4000,
};

/** Duración de la caché en milisegundos (5 minutos). */
const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  base: Currency;
  rates: Rates;
  createdAt: number;
}

const cache = new Map<string, CacheEntry>();

export class RatesProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RatesProviderError";
  }
}

const round = (n: number) => Math.round(n * 10000) / 10000;

const toRates = (
  base: Currency,
  raw: Record<string, string | number>
): Rates => {
  const rates = {} as Rates;
  for (const currency of SUPPORTED) {
    if (currency === base) {
      rates[currency] = 1;
      continue;
    }
    const value = Number(raw[currency]);
    rates[currency] = Number.isFinite(value) && value > 0 ? round(value) : 1;
  }
  return rates;
};

const formatBase = (base: Currency): string => `CURRENCYFREAKS:${base}`;

const readCached = (base: Currency): RatesResult | null => {
  const entry = cache.get(formatBase(base));
  if (!entry) return null;
  if (Date.now() - entry.createdAt > CACHE_TTL_MS) {
    cache.delete(formatBase(base));
    return null;
  }
  return {
    base,
    rates: entry.rates,
    source: "cache",
    timestamp: new Date(entry.createdAt).toISOString(),
  };
};

const storeInCache = (base: Currency, rates: Rates) => {
  cache.set(formatBase(base), { base, rates, createdAt: Date.now() });
};

/** Firma simplificada del fetch, aislada del tipo global para facilitar el mock en tests. */
export type RatesFetcher = (input: string) => Promise<Response>;

const fetchFromProvider = async (
  base: Currency,
  apiKey: string,
  fetcher: RatesFetcher = (input) => fetch(input)
): Promise<Rates> => {
  const url =
    `https://api.currencyfreaks.com/v2.0/rates/latest` +
    `?apikey=${encodeURIComponent(apiKey)}` +
    `&base=${base}` +
    `&symbols=${SUPPORTED.join(",")}`;

  const response = await fetcher(url);
  if (!response.ok) {
    throw new RatesProviderError(
      `CurrencyFreaks respondió ${response.status}`
    );
  }

  const data = (await response.json()) as CurrencyFreaksResponse;
  const rates = toRates(base, data.rates);
  return rates;
};

/**
 * Devuelve las tasas para una moneda base. Prioriza: caché -> provider -> fallback.
 */
export const getRates = async (
  base: Currency,
  options: { apiKey?: string; fetcher?: RatesFetcher } = {}
): Promise<RatesResult> => {
  const cached = readCached(base);
  if (cached) return cached;

  const apiKey = options.apiKey ?? process.env.CURRENCYFREAKS_API_KEY;

  if (apiKey) {
    try {
      const rates = await fetchFromProvider(base, apiKey, options.fetcher);
      storeInCache(base, rates);
      return { base, rates, source: "currencyfreaks", timestamp: new Date().toISOString() };
    } catch {
      // Si la API falla y no hay caché → caer al fallback (el negocio no debe romperse).
    }
  }

  const rates = toRates(base, FALLBACK_RATES);
  storeInCache(base, rates);
  return { base, rates, source: "fallback", timestamp: new Date().toISOString() };
};

export const ratesService = {
  getRates,
};
