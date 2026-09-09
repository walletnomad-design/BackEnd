import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RatesFetcher } from "../services/rates.service";

/** Simula una respuesta JSON válida de CurrencyFreaks. */
const mockProviderResponse = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

const makeFetcher = (handler: (url: string) => Response) =>
  vi.fn(async (url: string) => handler(url)) as unknown as RatesFetcher;

// La caché vive en la memoria del módulo importado. Para que cada test arranque
// con la caché vacía se resetena los módulos y se re-importa el servicio.
let mod: typeof import("../services/rates.service");

beforeEach(async () => {
  vi.resetModules();
  mod = await import("../services/rates.service");
});

// El plan free de CurrencyFreaks solo calcula tasas con base USD, así que la
// respuesta real del provider siempre trae US como referencia.
const usdResponse = () => ({
  base: "USD",
  date: "2026-01-01",
  rates: { USD: "1", EUR: "0.92", COP: "4000" },
});

describe("rates.service", () => {
  it("consulta al proveedor siempre con base USD y devuelve las 3 monedas", async () => {
    const { getRates } = mod;
    const fetcher = makeFetcher(() => mockProviderResponse(usdResponse()));

    const res = await getRates("USD", { apiKey: "test-key", fetcher });

    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining("base=USD"));
    expect(res.base).toBe("USD");
    expect(res.rates.USD).toBe(1);
    expect(res.rates.EUR).toBe(0.92);
    expect(res.rates.COP).toBe(4000);
    expect(res.source).toBe("currencyfreaks");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("usa la caché en peticiones repetidas (no llama al proveedor de nuevo)", async () => {
    const { getRates } = mod;
    const fetcher = makeFetcher(() => mockProviderResponse(usdResponse()));

    const first = await getRates("EUR", { apiKey: "test-key", fetcher });
    const second = await getRates("EUR", { apiKey: "test-key", fetcher });

    expect(first.source).toBe("currencyfreaks");
    expect(first.rates.EUR).toBe(1);
    expect(second.source).toBe("cache");
    expect(fetcher).toHaveBeenCalledTimes(1); // solo llamó al proveedor la primera vez
  });

  it("normaliza las tasas reales de USD a EUR y mantiene source currencyfreaks", async () => {
    const { getRates } = mod;
    const fetcher = makeFetcher(() => mockProviderResponse(usdResponse()));

    const res = await getRates("EUR", { apiKey: "test-key", fetcher });

    expect(res.source).toBe("currencyfreaks");
    expect(res.rates.EUR).toBe(1);
    // 1 USD = 0.92 EUR y 4000 COP -> expresado en EUR: 1 EUR = 1.087 USD y 4347.83 COP
    expect(res.rates.USD).toBeCloseTo(1 / 0.92, 3);
    expect(res.rates.COP).toBeCloseTo(4000 / 0.92, 1);
  });

  it("normaliza las tasas reales de USD a COP y mantiene source currencyfreaks", async () => {
    const { getRates } = mod;
    const fetcher = makeFetcher(() => mockProviderResponse(usdResponse()));

    const res = await getRates("COP", { apiKey: "test-key", fetcher });

    expect(res.source).toBe("currencyfreaks");
    expect(res.rates.COP).toBe(1);
    // 1 USD = 4000 COP -> 1 COP = 0.00025 USD y 0.00023 EUR
    expect(res.rates.USD).toBeCloseTo(1 / 4000, 6);
    expect(res.rates.EUR).toBeCloseTo(0.92 / 4000, 6);
  });

  it("cae al fallback cuando no hay API key y sigue devolviendo las 3 monedas", async () => {
    const { getRates } = mod;
    const fetcher = makeFetcher(() => mockProviderResponse({}));

    const res = await getRates("USD", { fetcher });

    expect(res.source).toBe("fallback");
    expect(res.rates.USD).toBeDefined();
    expect(res.rates.EUR).toBeDefined();
    expect(res.rates.COP).toBeDefined();
    expect(fetcher).not.toHaveBeenCalled(); // sin key nunca consulta el proveedor
  });

  it("normaliza el fallback a la base pedida (EUR -> tasas relativas a EUR)", async () => {
    const { getRates } = mod;
    const fetcher = makeFetcher(() => mockProviderResponse({}));

    const res = await getRates("EUR", { fetcher });

    expect(res.source).toBe("fallback");
    expect(res.rates.EUR).toBe(1);
    // FALLBACK: 1 USD = 0.93 EUR / 4000 COP -> expresado en EUR: 1 EUR = 1.075 USD y 4301.08 COP
    expect(res.rates.USD).toBeCloseTo(1 / 0.93, 3);
    expect(res.rates.COP).toBeCloseTo(4000 / 0.93, 1);
  });

  it("normaliza el fallback a la base pedida (COP -> tasas relativas a COP)", async () => {
    const { getRates } = mod;
    const fetcher = makeFetcher(() => mockProviderResponse({}));

    const res = await getRates("COP", { fetcher });

    expect(res.source).toBe("fallback");
    expect(res.rates.COP).toBe(1);
    // FALLBACK: 1 USD = 4000 COP -> 1 COP = 0.00025 USD y 0.0002325 EUR
    expect(res.rates.USD).toBeCloseTo(1 / 4000, 6);
    expect(res.rates.EUR).toBeCloseTo(0.93 / 4000, 6);
  });

  it("cae al fallback cuando el proveedor responde con error", async () => {
    const { getRates } = mod;
    const fetcher = makeFetcher(() => new Response("error", { status: 500 }));

    const res = await getRates("USD", { apiKey: "test-key", fetcher });

    expect(res.source).toBe("fallback");
    expect(res.rates.USD).toBeDefined();
  });

  it("la moneda base pedida siempre queda en 1 con tasas reales validas", async () => {
    const { getRates } = mod;
    const fetcher = makeFetcher(() => mockProviderResponse(usdResponse()));

    const res = await getRates("EUR", { apiKey: "test-key", fetcher });

    expect(res.rates.EUR).toBe(1);
    expect(res.source).toBe("currencyfreaks");
  });

  it("expone el objeto ratesService con getRates (contrato con P3)", () => {
    expect(typeof mod.ratesService.getRates).toBe("function");
  });
});