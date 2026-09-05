import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { createUser } from "../repositories";
import {
  createRateAlert,
  listRateAlertsByUserId,
  removeRateAlert,
  reactivateRateAlert,
  evaluateRateAlerts,
  rateAlertService,
  RateAlertValidationError,
  RateAlertNotFoundError,
  RateAlertRateError,
} from "../services/rate-alert.service";
import type { Queryable } from "../repositories/queryable";
import type { Currency } from "../types";

let pg: PGlite;
let db: Queryable;
let userId1: number;
let userId2: number;

const ratesProvider = async (base: Currency) => ({
  base,
  rates: { USD: 1, EUR: 0.93, COP: 4000 } as Record<Currency, number>,
});

const statusOf = async (alertId: number, userId: number): Promise<string | undefined> => {
  const alerts = await listRateAlertsByUserId(userId, db);
  return alerts.find((a) => a.id === alertId)?.status;
};

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(fs.readFileSync(path.join(process.cwd(), "src", "db", "schema.sql"), "utf8"));
  db = pg as unknown as Queryable;

  const user1 = await createUser({ email: "alerts1@x.com", password: "hash1" }, db);
  const user2 = await createUser({ email: "alerts2@x.com", password: "hash2" }, db);
  userId1 = user1.id;
  userId2 = user2.id;
});

afterAll(async () => {
  await pg.close();
});

describe("rate-alert.service", () => {
  it("rateAlertService expone el contrato del servicio", async () => {
    await expect(
      rateAlertService.createRateAlert(
        { userId: userId1, fromCurrency: "USD", toCurrency: "EUR", threshold: 0.9 },
        db
      )
    ).resolves.toBeDefined();
  });

  it("crea una alerta con dirección gte por defecto y redondea el umbral", async () => {
    const alert = await createRateAlert(
      { userId: userId1, fromCurrency: "USD", toCurrency: "EUR", threshold: 0.9000004 },
      db
    );

    expect(alert.userId).toBe(userId1);
    expect(alert.fromCurrency).toBe("USD");
    expect(alert.toCurrency).toBe("EUR");
    expect(alert.threshold).toBe(0.9);
    expect(alert.condition).toBe("gte");
    expect(alert.status).toBe("active");
  });

  it("crea una alerta con dirección lte y redondea el umbral", async () => {
    const alert = await createRateAlert(
      { userId: userId1, fromCurrency: "EUR", toCurrency: "USD", threshold: 1.1, condition: "lte" },
      db
    );

    expect(alert.condition).toBe("lte");
    expect(alert.threshold).toBe(1.1);
  });

  it("rechaza mismas monedas, moneda no soportada, umbral no positivo y condición inválida", async () => {
    await expect(
      createRateAlert({ userId: userId1, fromCurrency: "USD", toCurrency: "USD", threshold: 1 }, db)
    ).rejects.toBeInstanceOf(RateAlertValidationError);

    await expect(
      createRateAlert(
        { userId: userId1, fromCurrency: "ARS" as never, toCurrency: "EUR", threshold: 1 },
        db
      )
    ).rejects.toBeInstanceOf(RateAlertValidationError);

    await expect(
      createRateAlert({ userId: userId1, fromCurrency: "USD", toCurrency: "EUR", threshold: 0 }, db)
    ).rejects.toBeInstanceOf(RateAlertValidationError);

    await expect(
      createRateAlert(
        { userId: userId1, fromCurrency: "USD", toCurrency: "EUR", threshold: Number.NaN },
        db
      )
    ).rejects.toBeInstanceOf(RateAlertValidationError);

    await expect(
      createRateAlert(
        { userId: userId1, fromCurrency: "USD", toCurrency: "EUR", threshold: 1, condition: "foo" as never },
        db
      )
    ).rejects.toBeInstanceOf(RateAlertValidationError);
  });

  it("lista solo las alertas del usuario, más recientes primero", async () => {
    const a1 = await createRateAlert(
      { userId: userId1, fromCurrency: "USD", toCurrency: "EUR", threshold: 1 },
      db
    );
    const a2 = await createRateAlert(
      { userId: userId1, fromCurrency: "USD", toCurrency: "COP", threshold: 4000 },
      db
    );

    const alerts = await listRateAlertsByUserId(userId1, db);
    expect(alerts.length).toBeGreaterThanOrEqual(5);
    expect(alerts[0].id).toBe(a2.id);
    expect(alerts[1].id).toBe(a1.id);
    expect(alerts.every((a) => a.userId === userId1)).toBe(true);

    const other = await listRateAlertsByUserId(userId2, db);
    expect(other.some((a) => a.id === a1.id)).toBe(false);
    expect(other.some((a) => a.id === a2.id)).toBe(false);
  });

  it("la condición gte dispara cuando la tasa actual alcanza o supera el umbral", async () => {
    const alert = await createRateAlert(
      { userId: userId1, fromCurrency: "USD", toCurrency: "EUR", threshold: 0.9 },
      db
    );

    const evaluations = await evaluateRateAlerts(userId1, db, ratesProvider);
    const evaluation = evaluations.find((e) => e.alertId === alert.id);

    expect(evaluation?.alertId).toBe(alert.id);
    expect(evaluation?.currentRate).toBe(0.93);
    expect(evaluation?.triggered).toBe(true);
    expect(await statusOf(alert.id, userId1)).toBe("triggered");
  });

  it("la condición gte no dispara mientras la tasa esté por debajo del umbral", async () => {
    const alert = await createRateAlert(
      { userId: userId1, fromCurrency: "USD", toCurrency: "EUR", threshold: 0.95 },
      db
    );

    const evaluations = await evaluateRateAlerts(userId1, db, ratesProvider);
    const evaluation = evaluations.find((e) => e.alertId === alert.id);

    expect(evaluation?.triggered).toBe(false);
    expect(await statusOf(alert.id, userId1)).toBe("active");
  });

  it("la condición lte dispara cuando la tasa baja hasta el umbral o menos", async () => {
    const alert = await createRateAlert(
      { userId: userId1, fromCurrency: "USD", toCurrency: "EUR", threshold: 0.95, condition: "lte" },
      db
    );

    const evaluations = await evaluateRateAlerts(userId1, db, ratesProvider);
    const evaluation = evaluations.find((e) => e.alertId === alert.id);

    expect(evaluation?.triggered).toBe(true);
    expect(await statusOf(alert.id, userId1)).toBe("triggered");
  });

  it("solo evalúa alertas activas (las triggered ya dispararon)", async () => {
    const alert = await createRateAlert(
      { userId: userId1, fromCurrency: "USD", toCurrency: "EUR", threshold: 0.95, condition: "lte" },
      db
    );

    await evaluateRateAlerts(userId1, db, ratesProvider);
    const fired = await createRateAlert(
      { userId: userId1, fromCurrency: "EUR", toCurrency: "USD", threshold: 1.0 },
      db
    );

    const evaluations = await evaluateRateAlerts(userId1, db, ratesProvider);
    expect(evaluations.some((e) => e.alertId === alert.id)).toBe(false);
    expect(evaluations.some((e) => e.alertId === fired.id)).toBe(true);
  });

  it("se puede rearmar una alerta disparada", async () => {
    const alert = await createRateAlert(
      { userId: userId1, fromCurrency: "USD", toCurrency: "EUR", threshold: 0.9 },
      db
    );
    await evaluateRateAlerts(userId1, db, ratesProvider);
    expect(await statusOf(alert.id, userId1)).toBe("triggered");

    const rearmed = await reactivateRateAlert(userId1, alert.id, db);
    expect(rearmed.status).toBe("active");
  });

  it("no deja borrar ni rearmar alertas de otro usuario", async () => {
    const alert = await createRateAlert(
      { userId: userId1, fromCurrency: "USD", toCurrency: "EUR", threshold: 1.2 },
      db
    );

    await expect(removeRateAlert(userId2, alert.id, db)).rejects.toBeInstanceOf(
      RateAlertNotFoundError
    );
    await expect(reactivateRateAlert(userId2, alert.id, db)).rejects.toBeInstanceOf(
      RateAlertNotFoundError
    );
  });

  it("elimina la alerta del dueño y falla si no existe", async () => {
    const alert = await createRateAlert(
      { userId: userId1, fromCurrency: "EUR", toCurrency: "COP", threshold: 4000 },
      db
    );

    await expect(removeRateAlert(userId1, alert.id, db)).resolves.toBeUndefined();

    const remaining = await listRateAlertsByUserId(userId1, db);
    expect(remaining.some((a) => a.id === alert.id)).toBe(false);

    await expect(removeRateAlert(userId1, 999999, db)).rejects.toBeInstanceOf(
      RateAlertNotFoundError
    );
  });

  it("si el proveedor de tasas falla, lanza RateAlertRateError", async () => {
    await createRateAlert(
      { userId: userId1, fromCurrency: "COP", toCurrency: "USD", threshold: 0.2 },
      db
    );
    const failing: typeof ratesProvider = async () => {
      throw new Error("provider down");
    };

    await expect(evaluateRateAlerts(userId1, db, failing)).rejects.toBeInstanceOf(
      RateAlertRateError
    );
  });
});