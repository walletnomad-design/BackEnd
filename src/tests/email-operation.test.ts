import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { createUser, createWalletForUser, createTransaction } from "../repositories";
import {
  buildOperationEmailData,
  operationEmailSummary,
  emailOperationService,
} from "../services/email-operation.service";
import type { Queryable } from "../repositories/queryable";
import type { Transaction } from "../types";

let pg: PGlite;
let db: Queryable;
let userId: number;
let walletId: number;

const buyTransaction: Transaction = {
  id: 1,
  userId: 0,
  walletId: 0,
  type: "buy",
  fromCurrency: "USD",
  toCurrency: "EUR",
  fromAmount: 100,
  toAmount: 91.3,
  rate: 0.913,
  status: "completed",
  createdAt: "2026-09-05T12:00:00.000Z",
};

const sellTransaction: Transaction = {
  id: 2,
  userId: 0,
  walletId: 0,
  type: "sell",
  fromCurrency: "EUR",
  toCurrency: "USD",
  fromAmount: 50,
  toAmount: 54.79,
  rate: 1.09589,
  status: "completed",
  createdAt: "2026-09-05T12:30:00.000Z",
};

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(fs.readFileSync(path.join(process.cwd(), "src", "db", "schema.sql"), "utf8"));
  db = pg as unknown as Queryable;

  const user = await createUser({ email: "email@x.com", password: "hash" }, db);
  const wallet = await createWalletForUser(user.id, db);
  userId = user.id;
  walletId = wallet.id;
});

afterAll(async () => {
  await pg.close();
});

describe("email-operation.service", () => {
  it("emailOperationService expone el contrato del servicio", () => {
    expect(emailOperationService.buildOperationEmailData).toBeTypeOf("function");
    expect(emailOperationService.operationEmailSummary).toBeTypeOf("function");
  });

  it("mapea la transacción de compra (buy) al payload del email", () => {
    const data = buildOperationEmailData(buyTransaction);

    expect(data.transactionId).toBe(1);
    expect(data.type).toBe("buy");
    expect(data.fromCurrency).toBe("USD");
    expect(data.fromAmount).toBe(100);
    expect(data.toCurrency).toBe("EUR");
    expect(data.toAmount).toBe(91.3);
    expect(data.rate).toBe(0.913);
    expect(data.status).toBe("completed");
    expect(data.createdAt).toBe("2026-09-05T12:00:00.000Z");
  });

  it("mapea la venta (sell) y mantiene monto a 2 decimales y tasa a 6", () => {
    const data = buildOperationEmailData({
      ...sellTransaction,
      toAmount: 54.799999,
      rate: 1.0958914,
    });

    expect(data.type).toBe("sell");
    expect(data.toAmount).toBe(54.8);
    expect(data.rate).toBe(1.095891);
  });

  it("genera un resumen legible y determinístico por tipo de operación", () => {
    const summary = operationEmailSummary(buildOperationEmailData(buyTransaction));
    expect(summary).toBe(
      "Compraste 100.00 USD por 91.30 EUR a tasa 0.913000 (completed)"
    );

    const sellSummary = operationEmailSummary(buildOperationEmailData(sellTransaction));
    expect(sellSummary).toBe(
      "Vendiste 50.00 EUR por 54.79 USD a tasa 1.095890 (completed)"
    );
  });

  it("normaliza a ISO la fecha de la transacción persistida", () => {
    const data = buildOperationEmailData({
      ...buyTransaction,
      createdAt: "2026-09-05T12:00:00.000Z",
    });
    expect(data.createdAt).toBe("2026-09-05T12:00:00.000Z");
  });

  it("end-to-end: mapea datos desde una transacción realmente persistida en DB", async () => {
    const persisted = await createTransaction(
      {
        userId,
        walletId,
        type: "exchange",
        fromCurrency: "USD",
        toCurrency: "COP",
        fromAmount: 10,
        toAmount: 40000,
        rate: 4000,
        status: "completed",
      },
      db
    );

    const data = buildOperationEmailData(persisted);
    expect(data.type).toBe("exchange");
    expect(data.fromCurrency).toBe("USD");
    expect(data.toCurrency).toBe("COP");
    expect(data.fromAmount).toBe(10);
    expect(data.toAmount).toBe(40000);
    expect(data.status).toBe("completed");
    expect(data.transactionId).toBe(persisted.id);
  });
});