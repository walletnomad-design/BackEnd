import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import {
  createGoal,
  createRateAlert,
  createTransaction,
  createUser,
  createWalletForUser,
} from "../repositories";
import { getAdminMetrics } from "../services/admin.service";
import type { Queryable } from "../repositories/queryable";

let pg: PGlite;
let db: Queryable;

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(fs.readFileSync(path.join(process.cwd(), "src", "db", "schema.sql"), "utf8"));
  db = pg as unknown as Queryable;

  const userA = await createUser(
    { email: "admin-a@x.com", password: "hashA", firstName: "Ana" },
    db
  );
  const userB = await createUser({ email: "admin-b@x.com", password: "hashB" }, db);
  await pg.query("UPDATE users SET role = 'admin' WHERE id = $1", [userB.id]);

  const walletA = await createWalletForUser(userA.id, db);
  const walletB = await createWalletForUser(userB.id, db);

  await createTransaction(
    { userId: userA.id, walletId: walletA.id, type: "buy", fromCurrency: "USD", toCurrency: "EUR", fromAmount: 100, toAmount: 93, rate: 0.93, status: "completed" },
    db
  );
  await createTransaction(
    { userId: userA.id, walletId: walletA.id, type: "sell", fromCurrency: "EUR", toCurrency: "USD", fromAmount: 200, toAmount: 215, rate: 1.075, status: "completed" },
    db
  );
  await createTransaction(
    { userId: userB.id, walletId: walletB.id, type: "exchange", fromCurrency: "USD", toCurrency: "COP", fromAmount: 300, toAmount: 1200000, rate: 4000, status: "completed" },
    db
  );

  await createRateAlert(
    { userId: userA.id, fromCurrency: "USD", toCurrency: "EUR", threshold: 0.95, condition: "gte" },
    db
  );
  await createRateAlert(
    { userId: userB.id, fromCurrency: "EUR", toCurrency: "USD", threshold: 1.1, condition: "lte" },
    db
  );
  await pg.query("UPDATE rate_alerts SET status = 'triggered' WHERE user_id = $1", [userB.id]);

  await createGoal(
    { userId: userA.id, name: "Meta cumplida", currency: "EUR", targetAmount: 1000 },
    db
  );
  await pg.query(
    "UPDATE goals SET current_amount = $1 WHERE name = $2",
    [1000, "Meta cumplida"]
  );
  await createGoal(
    { userId: userB.id, name: "Meta en curso", currency: "USD", targetAmount: 500 },
    db
  );
});

afterAll(async () => {
  await pg.close();
});

describe("admin.service", () => {
  it("el registro crea usuarios con role 'user' por defecto", async () => {
    const user = await createUser({ email: "default-role@x.com", password: "hash" }, db);
    expect(user.role).toBe("user");
  });

  it("getAdminMetrics agrega usuarios por rol", async () => {
    const metrics = await getAdminMetrics(db);
    expect(metrics.totalUsers).toBe(3);
    expect(metrics.adminUsers).toBe(1);
  });

  it("cuenta usuarios con al menos una operacion", async () => {
    const metrics = await getAdminMetrics(db);
    expect(metrics.usersWithOperations).toBe(2);
  });

  it("agrega transacciones por moneda origen y por tipo", async () => {
    const metrics = await getAdminMetrics(db);

    expect(metrics.totalTransactions).toBe(3);
    expect(metrics.volumeByCurrency).toEqual([
      { currency: "EUR", count: 1, totalAmount: 200 },
      { currency: "USD", count: 2, totalAmount: 400 },
    ]);
    expect(metrics.transactionsByType).toEqual([
      { type: "buy", count: 1 },
      { type: "exchange", count: 1 },
      { type: "sell", count: 1 },
    ]);
  });

  it("cuenta alertas por estado (active | triggered)", async () => {
    const metrics = await getAdminMetrics(db);
    expect(metrics.triggeredAlerts).toBe(1);
    expect(metrics.activeAlerts).toBe(1);
  });

  it("cuenta metas totales y completadas", async () => {
    const metrics = await getAdminMetrics(db);
    expect(metrics.totalGoals).toBe(2);
    expect(metrics.completedGoals).toBe(1);
  });

  it("devuelve la estructura completa del panel con valores numéricos", async () => {
    const metrics = await getAdminMetrics(db);
    expect(metrics).toMatchObject({
      totalUsers: expect.any(Number),
      adminUsers: expect.any(Number),
      totalTransactions: expect.any(Number),
      triggeredAlerts: expect.any(Number),
      activeAlerts: expect.any(Number),
      totalGoals: expect.any(Number),
      completedGoals: expect.any(Number),
    });
    expect(Array.isArray(metrics.volumeByCurrency)).toBe(true);
    expect(Array.isArray(metrics.transactionsByType)).toBe(true);
  });
});