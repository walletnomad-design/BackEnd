import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import {
  createUser,
  createWalletForUser,
  createInitialBalances,
  findWalletByUserId,
  findBalancesByWalletId,
  addToBalance,
} from "../repositories";
import {
  createGoal,
  listGoalsByUserId,
  addContribution,
  withdrawFromGoal,
  removeGoal,
  goalsService,
  GoalValidationError,
  GoalNotFoundError,
  GoalInsufficientBalanceError,
} from "../services/goals.service";
import type { Queryable } from "../repositories/queryable";

let pg: PGlite;
let db: Queryable;
let userId1: number;
let userId2: number;

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(fs.readFileSync(path.join(process.cwd(), "src", "db", "schema.sql"), "utf8"));
  db = pg as unknown as Queryable;

  const user1 = await createUser({ email: "goals1@x.com", password: "hash1" }, db);
  const user2 = await createUser({ email: "goals2@x.com", password: "hash2" }, db);
  userId1 = user1.id;
  userId2 = user2.id;

  const wallet1 = await createWalletForUser(user1.id, db);
  const wallet2 = await createWalletForUser(user2.id, db);
  await createInitialBalances(wallet1.id, db);
  await createInitialBalances(wallet2.id, db);
  await addToBalance(wallet1.id, "USD", 5000, db);
  await addToBalance(wallet1.id, "EUR", 5000, db);
  await addToBalance(wallet1.id, "COP", 5000000, db);
  await addToBalance(wallet2.id, "USD", 5000, db);
  await addToBalance(wallet2.id, "EUR", 5000, db);
  await addToBalance(wallet2.id, "COP", 5000000, db);
});

afterAll(async () => {
  await pg.close();
});

describe("goals.service", () => {
  it("goalsService expone el contrato del servicio", async () => {
    await expect(
      goalsService.createGoal(
        { userId: userId1, name: "Viaje a Espana", currency: "EUR", targetAmount: 2000 },
        db
      )
    ).resolves.toBeDefined();
  });

  it("crea una meta con progreso 0 y no completada", async () => {
    const goal = await createGoal(
      { userId: userId1, name: "Viaje a Espana", currency: "EUR", targetAmount: 2000 },
      db
    );

    expect(goal.userId).toBe(userId1);
    expect(goal.name).toBe("Viaje a Espana");
    expect(goal.currency).toBe("EUR");
    expect(goal.targetAmount).toBe(2000);
    expect(goal.currentAmount).toBe(0);
    expect(goal.progress).toBe(0);
    expect(goal.completed).toBe(false);
    expect(goal.id).toBeGreaterThan(0);
  });

  it("recorta el nombre y redondea el objetivo a 2 decimales", async () => {
    const goal = await createGoal(
      { userId: userId1, name: "  Computador  ", currency: "USD", targetAmount: 999.999 },
      db
    );

    expect(goal.name).toBe("Computador");
    expect(goal.targetAmount).toBe(1000);
  });

  it("rechaza nombre vacío, moneda no soportada y objetivo no positivo", async () => {
    await expect(
      createGoal({ userId: userId1, name: "   ", currency: "EUR", targetAmount: 100 }, db)
    ).rejects.toBeInstanceOf(GoalValidationError);

    await expect(
      createGoal(
        { userId: userId1, name: "Meta", currency: "ARS" as never, targetAmount: 100 },
        db
      )
    ).rejects.toBeInstanceOf(GoalValidationError);

    await expect(
      createGoal({ userId: userId1, name: "Meta", currency: "EUR", targetAmount: 0 }, db)
    ).rejects.toBeInstanceOf(GoalValidationError);

    await expect(
      createGoal(
        { userId: userId1, name: "Meta", currency: "EUR", targetAmount: Number.NaN },
        db
      )
    ).rejects.toBeInstanceOf(GoalValidationError);
  });

  it("lista solo las metas del usuario, más recientes primero", async () => {
    await createGoal({ userId: userId1, name: "C1", currency: "COP", targetAmount: 1000 }, db);
    await createGoal({ userId: userId1, name: "C2", currency: "USD", targetAmount: 500 }, db);

    const goals = await listGoalsByUserId(userId1, db);

    expect(goals.length).toBeGreaterThanOrEqual(3);
    expect(goals[0].name).toBe("C2");
    expect(goals.every((g) => g.userId === userId1)).toBe(true);

    const other = await listGoalsByUserId(userId2, db);
    expect(other.some((g) => g.userId === userId1)).toBe(false);
  });

  it("acumula aportes y recalcula el progreso", async () => {
    const goal = await createGoal(
      { userId: userId1, name: "Meta Aportes", currency: "USD", targetAmount: 1000 },
      db
    );

    await addContribution({ userId: userId1, goalId: goal.id, amount: 250 }, db);
    const at500 = await addContribution({ userId: userId1, goalId: goal.id, amount: 250 }, db);

    expect(at500.currentAmount).toBe(500);
    expect(at500.progress).toBe(50);
    expect(at500.completed).toBe(false);
  });

  it("marca la meta como completada y topa el progreso en 100", async () => {
    const goal = await createGoal(
      { userId: userId1, name: "Meta Completa", currency: "EUR", targetAmount: 100 },
      db
    );

    const done = await addContribution({ userId: userId1, goalId: goal.id, amount: 100 }, db);
    const over = await addContribution({ userId: userId1, goalId: goal.id, amount: 50 }, db);

    expect(done.completed).toBe(true);
    expect(done.progress).toBe(100);
    expect(over.currentAmount).toBe(150);
    expect(over.progress).toBe(100);
  });

  it("rechaza aportes no positivos", async () => {
    const goal = await createGoal(
      { userId: userId1, name: "Meta Sin Aportes", currency: "USD", targetAmount: 100 },
      db
    );

    await expect(
      addContribution({ userId: userId1, goalId: goal.id, amount: 0 }, db)
    ).rejects.toBeInstanceOf(GoalValidationError);

    await expect(
      addContribution({ userId: userId1, goalId: goal.id, amount: -5 }, db)
    ).rejects.toBeInstanceOf(GoalValidationError);
  });

  it("no deja aportar ni eliminar una meta de otro usuario", async () => {
    const goal = await createGoal(
      { userId: userId1, name: "Meta Ajena", currency: "USD", targetAmount: 100 },
      db
    );

    await expect(
      addContribution({ userId: userId2, goalId: goal.id, amount: 10 }, db)
    ).rejects.toBeInstanceOf(GoalNotFoundError);

    await expect(removeGoal(userId2, goal.id, db)).rejects.toBeInstanceOf(
      GoalNotFoundError
    );
  });

  it("elimina la meta del dueño y lanza error si no existe", async () => {
    const goal = await createGoal(
      { userId: userId1, name: "Meta a Borrar", currency: "COP", targetAmount: 100 },
      db
    );

    await expect(removeGoal(userId1, goal.id, db)).resolves.toBeUndefined();

    const remaining = await listGoalsByUserId(userId1, db);
    expect(remaining.some((g) => g.id === goal.id)).toBe(false);

    await expect(removeGoal(userId1, 999999, db)).rejects.toBeInstanceOf(
      GoalNotFoundError
    );
  });

  it("aporta descontando el balance real en la moneda de la meta", async () => {
    const goal = await createGoal(
      { userId: userId1, name: "Meta Balance", currency: "USD", targetAmount: 1000 },
      db
    );
    const wallet1 = await findWalletByUserId(userId1, db);

    expect(wallet1).toBeDefined();

    const before = await findBalancesByWalletId(wallet1!.id, db);
    const usdBefore = before.find((b) => b.currency === "USD")?.amount ?? 0;

    await addContribution({ userId: userId1, goalId: goal.id, amount: 300 }, db);

    const balances = await findBalancesByWalletId(wallet1!.id, db);
    const usd = balances.find((b) => b.currency === "USD");
    expect(usd?.amount).toBe(usdBefore - 300);
  });

  it("rechaza aporte sin saldo suficiente con el máximo disponible", async () => {
    const goal = await createGoal(
      { userId: userId2, name: "Meta Sin Fondos", currency: "USD", targetAmount: 50000 },
      db
    );
    const wallet2 = await findWalletByUserId(userId2, db);
    const balances = await findBalancesByWalletId(wallet2!.id, db);
    const usd = balances.find((b) => b.currency === "USD");

    await expect(
      addContribution({ userId: userId2, goalId: goal.id, amount: 999999 }, db)
    ).rejects.toMatchObject({ name: "GoalInsufficientBalanceError", available: usd?.amount });
  });

  it("retira desde la meta y acredita el balance de vuelta", async () => {
    const goal = await createGoal(
      { userId: userId1, name: "Meta Retiro", currency: "EUR", targetAmount: 1000 },
      db
    );
    await addContribution({ userId: userId1, goalId: goal.id, amount: 200 }, db);

    const wallet1 = await findWalletByUserId(userId1, db);
    const afterContribution = await findBalancesByWalletId(wallet1!.id, db);
    const eurAfterContribution = afterContribution.find((b) => b.currency === "EUR")?.amount ?? 0;

    const afterWithdraw = await withdrawFromGoal(
      { userId: userId1, goalId: goal.id, amount: 120 },
      db
    );

    expect(afterWithdraw.currentAmount).toBe(80);
    expect(afterWithdraw.progress).toBe(8);

    const balances = await findBalancesByWalletId(wallet1!.id, db);
    const eur = balances.find((b) => b.currency === "EUR");
    // retirar 120 de la meta suma ese monto de vuelta al balance en EUR
    expect(eur?.amount).toBe(eurAfterContribution + 120);
  });

  it("rechaza retiro mayor a lo ahorrado en la meta", async () => {
    const goal = await createGoal(
      { userId: userId1, name: "Meta Retiro Max", currency: "COP", targetAmount: 10000 },
      db
    );
    await addContribution({ userId: userId1, goalId: goal.id, amount: 50 }, db);

    await expect(
      withdrawFromGoal({ userId: userId1, goalId: goal.id, amount: 500 }, db)
    ).rejects.toBeInstanceOf(GoalValidationError);
  });

  it("no retira de una meta ajena", async () => {
    const goal = await createGoal(
      { userId: userId1, name: "Meta Ajena Retiro", currency: "USD", targetAmount: 100 },
      db
    );
    await addContribution({ userId: userId1, goalId: goal.id, amount: 20 }, db);

    await expect(
      withdrawFromGoal({ userId: userId2, goalId: goal.id, amount: 10 }, db)
    ).rejects.toBeInstanceOf(GoalNotFoundError);
  });

  it("hace rollback si el aporte falla por saldo insuficiente (no descuenta)", async () => {
    const goal = await createGoal(
      { userId: userId1, name: "Meta Rollback", currency: "USD", targetAmount: 100000 },
      db
    );
    const wallet1 = await findWalletByUserId(userId1, db);
    const before = await findBalancesByWalletId(wallet1!.id, db);
    const usdBefore = before.find((b) => b.currency === "USD")?.amount;

    await expect(
      addContribution({ userId: userId1, goalId: goal.id, amount: 999999 }, db)
    ).rejects.toBeInstanceOf(GoalInsufficientBalanceError);

    const after = await findBalancesByWalletId(wallet1!.id, db);
    const usdAfter = after.find((b) => b.currency === "USD")?.amount;
    expect(usdAfter).toBe(usdBefore);
    expect(goal.currentAmount).toBe(0);
  });

  it("devuelve el monto reservado al balance al eliminar la meta", async () => {
    const goal = await createGoal(
      { userId: userId1, name: "Meta Devolucion", currency: "USD", targetAmount: 1000 },
      db
    );
    await addContribution({ userId: userId1, goalId: goal.id, amount: 350 }, db);

    const wallet1 = await findWalletByUserId(userId1, db);
    const before = await findBalancesByWalletId(wallet1!.id, db);
    const usdBefore = before.find((b) => b.currency === "USD")?.amount ?? 0;

    await removeGoal(userId1, goal.id, db);

    const after = await findBalancesByWalletId(wallet1!.id, db);
    const usdAfter = after.find((b) => b.currency === "USD")?.amount ?? 0;
    expect(usdAfter).toBe(usdBefore + 350);

    const remaining = await listGoalsByUserId(userId1, db);
    expect(remaining.some((g) => g.id === goal.id)).toBe(false);
  });

  it("elimina una meta sin ahorro sin tocar el balance", async () => {
    const goal = await createGoal(
      { userId: userId1, name: "Meta Vacia", currency: "EUR", targetAmount: 500 },
      db
    );
    const wallet1 = await findWalletByUserId(userId1, db);
    const before = await findBalancesByWalletId(wallet1!.id, db);
    const eurBefore = before.find((b) => b.currency === "EUR")?.amount ?? 0;

    await removeGoal(userId1, goal.id, db);

    const after = await findBalancesByWalletId(wallet1!.id, db);
    const eurAfter = after.find((b) => b.currency === "EUR")?.amount ?? 0;
    expect(eurAfter).toBe(eurBefore);
  });

  it("no devuelve saldo al eliminar una meta ajena", async () => {
    const goal = await createGoal(
      { userId: userId1, name: "Meta Ajena con Saldo", currency: "USD", targetAmount: 1000 },
      db
    );
    await addContribution({ userId: userId1, goalId: goal.id, amount: 100 }, db);

    const wallet2 = await findWalletByUserId(userId2, db);
    const before = await findBalancesByWalletId(wallet2!.id, db);
    const usdBefore = before.find((b) => b.currency === "USD")?.amount ?? 0;

    await expect(removeGoal(userId2, goal.id, db)).rejects.toBeInstanceOf(
      GoalNotFoundError
    );

    const after = await findBalancesByWalletId(wallet2!.id, db);
    const usdAfter = after.find((b) => b.currency === "USD")?.amount ?? 0;
    expect(usdAfter).toBe(usdBefore);
  });
});