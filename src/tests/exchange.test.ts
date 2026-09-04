import type { Pool } from "pg";
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { createUser, createWalletForUser, createInitialBalances, findBalancesByWalletId } from "../repositories";
import {
  exchange,
  exchangeService,
  InsufficientBalanceError,
  InvalidExchangeError,
  ExchangeRateError,
  type ExchangeInput,
} from "../services/exchange.service";
import type { Queryable } from "../repositories/queryable";
import type { Currency } from "../types";

let pg: PGlite;
let db: Pool;

const VALID_INPUT: ExchangeInput = {
  userId: 1,
  type: "exchange",
  fromCurrency: "USD",
  toCurrency: "EUR",
  amount: 100,
};

const ratesProvider = async (base: Currency) => ({
  base,
  rates: { USD: 1, EUR: 0.93, COP: 4000 } as Record<Currency, number>,
});

const balanceOf = async (currency: Currency): Promise<number> => {
  const balances = await findBalancesByWalletId(1, db);
  return balances.find((b) => b.currency === currency)?.amount ?? 0;
};

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(fs.readFileSync(path.join(process.cwd(), "src", "db", "schema.sql"), "utf8"));
  db = pg as unknown as Pool;

  const user = await createUser({ email: "exch@x.com", password: "hash1" }, db);
  const wallet = await createWalletForUser(user.id, db);
  await createInitialBalances(wallet.id, db);
});

afterAll(async () => {
  await pg.close();
});

/** Proxy de query que falla al ejecutar el INSERT de la transacción. */
function failingOnTransactionInsert(wrapped: Queryable): Queryable {
  const proxy = {
    query: (text: unknown, values?: unknown) => {
      const sql = typeof text === "string" ? text : "";
      if (sql.includes("INSERT INTO transactions")) {
        return Promise.reject(new Error("fallo forzado en createTransaction"));
      }
      return wrapped.query(text as string, values as never[]);
    },
  };
  return proxy as unknown as Queryable;
}

describe("exchange.service", () => {
  it("exchangeService.exchange funciona como objeto de contrato", async () => {
    await expect(exchangeService.exchange(VALID_INPUT, db, ratesProvider)).resolves.toBeDefined();
  });

  it("intercambio exitoso debita origen y acredita destino", async () => {
    const beforeUsd = await balanceOf("USD");
    const beforeEur = await balanceOf("EUR");

    const tx = await exchange(VALID_INPUT, db, ratesProvider);

    expect(tx.fromCurrency).toBe("USD");
    expect(tx.toCurrency).toBe("EUR");
    expect(tx.fromAmount).toBe(100);
    expect(tx.toAmount).toBe(93);
    expect(tx.rate).toBe(0.93);
    expect(tx.status).toBe("completed");

    const afterUsd = await balanceOf("USD");
    const afterEur = await balanceOf("EUR");
    expect(afterUsd).toBeCloseTo(beforeUsd - 100);
    expect(afterEur).toBeCloseTo(beforeEur + 93);
  });

  it("saldo insuficiente lanza InsufficientBalanceError y no modifica saldos", async () => {
    const before = await findBalancesByWalletId(1, db);

    await expect(
      exchange(
        { ...VALID_INPUT, fromCurrency: "EUR", toCurrency: "USD", amount: 999999 },
        db,
        ratesProvider
      )
    ).rejects.toBeInstanceOf(InsufficientBalanceError);

    const after = await findBalancesByWalletId(1, db);
    expect(after).toEqual(before);
  });

  it("misma moneda de origen y destino lanza InvalidExchangeError", async () => {
    await expect(
      exchange(
        { ...VALID_INPUT, fromCurrency: "USD", toCurrency: "USD" },
        db,
        ratesProvider
      )
    ).rejects.toBeInstanceOf(InvalidExchangeError);
  });

  it("monto no positivo lanza InvalidExchangeError", async () => {
    await expect(
      exchange({ ...VALID_INPUT, amount: 0 }, db, ratesProvider)
    ).rejects.toBeInstanceOf(InvalidExchangeError);
    await expect(
      exchange({ ...VALID_INPUT, amount: -5 }, db, ratesProvider)
    ).rejects.toBeInstanceOf(InvalidExchangeError);
  });

  it("si el proveedor de tasas falla lanza ExchangeRateError y no toca saldos", async () => {
    const before = await findBalancesByWalletId(1, db);
    const failing: typeof ratesProvider = async () => {
      throw new Error("provider down");
    };

    await expect(
      exchange(VALID_INPUT, db, failing)
    ).rejects.toBeInstanceOf(ExchangeRateError);

    const after = await findBalancesByWalletId(1, db);
    expect(after).toEqual(before);
  });

  it("si falla al crear la transacción, se hace ROLLBACK (no queda dinero descontado)", async () => {
    const before = await findBalancesByWalletId(1, db);
    const badDb = failingOnTransactionInsert(db);

    await expect(
      exchange(VALID_INPUT, badDb, ratesProvider)
    ).rejects.toThrow("fallo forzado");

    const after = await findBalancesByWalletId(1, db);
    expect(after).toEqual(before);
  });
});
