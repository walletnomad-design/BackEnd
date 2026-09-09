import type { Currency, Rates, RatesResult, CurrencyFreaksResponse } from "../types";

/**
 * Servicio de tasas de cambio (Sprint 2 · P2).
 *
 * Consulta la API de CurrencyFreaks SIEMPRE con USD como base (el plan free solo
 * permite base USD) y normaliza las tasas reales a la moneda base pedida. Incluye:
 *   - Caché en memoria con TTL (evita gastar cuota/requests).
 *   - Fallback con tasas fijas si la API falla de verdad o no hay API key configurada.
 *
 * La API key vive SOLO en el backend (process.env.CURRENCYFREAKS_API_KEY),
 * nunca en el frontend.
 */

const SUPPORTED: Currency[] = ["USD", "EUR", "COP"];

/** CurrencyFreaks (plan free) solo calcula tasas con USD como base. */
const PROVIDER_BASE = "USD" as const;

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

const round = (n: number) => Math.round(n * 100000000) / 100000000;

const toRates = (
  base: Currency,
  raw: Record<string, string | number>
): Rates => {
  const baseValue = Number(raw[base]);
  const rates = {} as Rates;
  for (const currency of SUPPORTED) {
    if (currency === base) {
      rates[currency] = 1;
      continue;
    }
    const value = Number(raw[currency]);
    const normalized =
      Number.isFinite(baseValue) && baseValue > 0 ? value / baseValue : value;
    rates[currency] =
      Number.isFinite(normalized) && normalized > 0 ? round(normalized) : 1;
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
  apiKey: string,
  fetcher: RatesFetcher = (input) => fetch(input)
): Promise<Rates> => {
  const url =
    `https://api.currencyfreaks.com/v2.0/rates/latest` +
    `?apikey=${encodeURIComponent(apiKey)}` +
    `&base=${PROVIDER_BASE}` +
    `&symbols=${SUPPORTED.join(",")}`;

  const response = await fetcher(url);
  if (!response.ok) {
    throw new RatesProviderError(
      `CurrencyFreaks respondió ${response.status}`
    );
  }

  const data = (await response.json()) as CurrencyFreaksResponse;
  return toRates(PROVIDER_BASE, data.rates);
};

/**
 * Re-escalea unas tasas relativas a USD para que queden relativas a la base
 * pedida: normalized[target] = usdRates[target] / usdRates[requestedBase].
 */
const normalizeFromUsd = (usdRates: Rates, base: Currency): Rates => {
  const baseValue = usdRates[base];
  const rates = {} as Rates;
  for (const currency of SUPPORTED) {
    if (currency === base) {
      rates[currency] = 1;
      continue;
    }
    const value = usdRates[currency];
    const normalized =
      Number.isFinite(baseValue) && baseValue > 0 ? value / baseValue : value;
    rates[currency] =
      Number.isFinite(normalized) && normalized > 0 ? round(normalized) : 1;
  }
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
      const usdRates = await fetchFromProvider(apiKey, options.fetcher);
      const rates =
        base === PROVIDER_BASE
          ? usdRates
          : normalizeFromUsd(usdRates, base);
      storeInCache(base, rates);
      return { base, rates, source: "currencyfreaks", timestamp: new Date().toISOString() };
    } catch {
      // Si la API falla de verdad (respuesta no OK o JSON inválido) → fallback.
    }
  }

  const rates = toRates(base, FALLBACK_RATES);
  storeInCache(base, rates);
  return { base, rates, source: "fallback", timestamp: new Date().toISOString() };
};

export const ratesService = {
  getRates,
};
