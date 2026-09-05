import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { createUser } from "../repositories";
import {
  createGoal,
  listGoalsByUserId,
  addContribution,
  removeGoal,
  goalsService,
  GoalValidationError,
  GoalNotFoundError,
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
});