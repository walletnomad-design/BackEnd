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

describe("rates.service", () => {
  it("devuelve las 3 monedas cuando hay API key y el proveedor responde", async () => {
    const { getRates } = mod;
    const fetcher = makeFetcher(() =>
      mockProviderResponse({
        base: "USD",
        date: "2026-01-01",
        rates: { USD: "1", EUR: "0.92", COP: "4000" },
      })
    );

    const res = await getRates("USD", { apiKey: "test-key", fetcher });

    expect(res.base).toBe("USD");
    expect(res.rates.USD).toBe(1);
    expect(res.rates.EUR).toBe(0.92);
    expect(res.rates.COP).toBe(4000);
    expect(res.source).toBe("currencyfreaks");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("usa la caché en peticiones repetidas (no llama al proveedor de nuevo)", async () => {
    const { getRates } = mod;
    const fetcher = makeFetcher(() =>
      mockProviderResponse({ base: "EUR", rates: { USD: "1.09", EUR: "1", COP: "4350" } })
    );

    const first = await getRates("EUR", { apiKey: "test-key", fetcher });
    const second = await getRates("EUR", { apiKey: "test-key", fetcher });

    expect(first.source).toBe("currencyfreaks");
    expect(second.source).toBe("cache");
    expect(fetcher).toHaveBeenCalledTimes(1); // solo llamó al proveedor la primera vez
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

  it("cae al fallback cuando el proveedor responde con error", async () => {
    const { getRates } = mod;
    const fetcher = makeFetcher(() => new Response("error", { status: 500 }));

    const res = await getRates("USD", { apiKey: "test-key", fetcher });

    expect(res.source).toBe("fallback");
    expect(res.rates.USD).toBeDefined();
  });

  it("la moneda base tiene tasa 1", async () => {
    const { getRates } = mod;
    const fetcher = makeFetcher(() =>
      mockProviderResponse({ base: "COP", rates: { USD: "0.00025", EUR: "0.00023", COP: "1" } })
    );

    const res = await getRates("COP", { apiKey: "test-key", fetcher });

    expect(res.rates.COP).toBe(1);
    expect(res.source).toBe("currencyfreaks");
  });

  it("expone el objeto ratesService con getRates (contrato con P3)", () => {
    expect(typeof mod.ratesService.getRates).toBe("function");
  });
});
