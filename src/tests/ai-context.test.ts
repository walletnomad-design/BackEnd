import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import {
  createUser,
  createWalletForUser,
  createInitialBalances,
  createTransaction,
} from "../repositories";
import { goalsService } from "../services/goals.service";
import {
  buildUserAiContext,
  aiContextService,
  AiContextUserNotFoundError,
} from "../services/ai-context.service";
import type { RatesProviderForContext } from "../services/ai-context.service";
import type { Queryable } from "../repositories/queryable";
import type { Currency, RatesResult } from "../types";

let pg: PGlite;
let db: Queryable;
let userId1: number;
let userId2: number;
const rateCalls: string[] = [];

const fixedRates: RatesResult = {
  base: "USD",
  rates: { USD: 1, EUR: 0.93, COP: 4000 },
  source: "fallback",
  timestamp: "2026-09-05T12:00:00.000Z",
};

const ratesProvider: RatesProviderForContext = async (base: Currency) => {
  rateCalls.push(base);
  return { ...fixedRates, base };
};

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(fs.readFileSync(path.join(process.cwd(), "src", "db", "schema.sql"), "utf8"));
  db = pg as unknown as Queryable;

  const user1 = await createUser(
    { email: "ai-user1@x.com", password: "hash1", firstName: "Juan", lastName: "Perez", dni: "30000001" },
    db
  );
  const user2 = await createUser({ email: "ai-user2@x.com", password: "hash2" }, db);

  const wallet1 = await createWalletForUser(user1.id, db);
  await createInitialBalances(wallet1.id, db);
  await goalsService.createGoal(
    { userId: user1.id, name: "Viaje a España", currency: "EUR", targetAmount: 1000 },
    db
  );
  await createTransaction(
    {
      userId: user1.id,
      walletId: wallet1.id,
      type: "buy",
      fromCurrency: "USD",
      toCurrency: "EUR",
      fromAmount: 100,
      toAmount: 93,
      rate: 0.93,
      status: "completed",
    },
    db
  );

  const wallet2 = await createWalletForUser(user2.id, db);
  await createInitialBalances(wallet2.id, db);

  userId1 = user1.id;
  userId2 = user2.id;
});

afterAll(async () => {
  await pg.close();
});

describe("ai-context.service", () => {
  it("aiContextService expone el contrato del servicio", async () => {
    await expect(
      aiContextService.buildUserAiContext(userId1, db, ratesProvider)
    ).resolves.toBeDefined();
  });

  it("arma el contexto completo del usuario: identidad, balances, metas y tasas", async () => {
    const context = await buildUserAiContext(userId1, db, ratesProvider);

    expect(context.userId).toBe(userId1);
    expect(context.user.email).toBe("ai-user1@x.com");
    expect(context.user.firstName).toBe("Juan");
    expect(context.user.lastName).toBe("Perez");
    expect(context.user.dni).toBe("30000001");
    expect("password" in context.user).toBe(false);

    expect(context.balances).toEqual([
      { currency: "COP", amount: 2000000 },
      { currency: "EUR", amount: 500 },
      { currency: "USD", amount: 1000 },
    ]);

    expect(context.recentTransactions.length).toBeGreaterThan(0);
    expect(context.recentTransactions[0].userId).toBe(userId1);

    expect(context.goals.length).toBeGreaterThan(0);
    expect(context.goals[0].name).toBe("Viaje a España");
    expect(context.goals[0].progress).toBe(0);
    expect(context.goals[0].completed).toBe(false);

    expect(context.supportedCurrencies).toEqual(["USD", "EUR", "COP"]);
    expect(context.rates.USD.rates.EUR).toBe(0.93);
    expect(context.rates.EUR.base).toBe("EUR");
    expect(context.rates.COP.rates.USD).toBe(1);
    expect(context.builtAt).toBeTypeOf("string");
  });

  it("aísla el contexto: no filtra datos de otro usuario", async () => {
    await goalsService.createGoal(
      { userId: userId2, name: "Meta privada", currency: "USD", targetAmount: 500 },
      db
    );

    const context = await buildUserAiContext(userId2, db, ratesProvider);

    expect(context.userId).toBe(userId2);
    expect(context.user.email).toBe("ai-user2@x.com");
    expect(context.user.firstName).toBeUndefined();

    const otherContext = await buildUserAiContext(userId1, db, ratesProvider);
    expect(context.recentTransactions.length).toBe(0);
    expect(context.goals.length).toBe(1);
    expect(context.goals.every((g) => g.userId === userId2)).toBe(true);
    expect(context.balances.every((b) => b.amount <= 2000000)).toBe(true);

    const user1Transactions = otherContext.recentTransactions.map((t) => t.id);
    expect(context.recentTransactions.every((t) => !user1Transactions.includes(t.id))).toBe(true);
    expect(otherContext.userId).not.toBe(context.userId);
  });

  it("la caché evita golpear al proveedor de tasas dentro del TTL", async () => {
    rateCalls.length = 0;

    const first = await buildUserAiContext(userId1, db, ratesProvider);
    const second = await buildUserAiContext(userId1, db, ratesProvider);

    expect(second.builtAt).toBe(first.builtAt);
    expect(rateCalls.length).toBe(0);
  });

  it("lanza AiContextUserNotFoundError si el usuario no existe", async () => {
    await expect(buildUserAiContext(999999, db, ratesProvider)).rejects.toBeInstanceOf(
      AiContextUserNotFoundError
    );
  });
});