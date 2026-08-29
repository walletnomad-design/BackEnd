import type { Pool } from "pg";
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import {
  createUser,
  findUserByEmail,
  createWalletForUser,
  createInitialBalances,
  findWalletByUserId,
  findBalancesByWalletId,
  findTransactionsByUserId,
} from "../repositories";

let pg: PGlite;
let db: Pool;

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(fs.readFileSync(path.join(process.cwd(), "src", "db", "schema.sql"), "utf8"));
  db = pg as unknown as Pool;

  const user1 = await createUser({ email: "a@x.com", password: "hash1" }, db);
  const user2 = await createUser({ email: "b@y.com", password: "hash2" }, db);
  const wallet1 = await createWalletForUser(user1.id, db);
  await createWalletForUser(user2.id, db);
  await createInitialBalances(wallet1.id, db);
});

afterAll(async () => {
  await pg.close();
});

describe("user.repository", () => {
  it("findUserByEmail encuentra el usuario creado", async () => {
    const found = await findUserByEmail("a@x.com", db);
    expect(found?.email).toBe("a@x.com");
    expect(typeof found?.id).toBe("number");
  });

  it("findUserByEmail inexistente devuelve null", async () => {
    expect(await findUserByEmail("nope@x.com", db)).toBeNull();
  });

  it("createUser crea un usuario nuevo", async () => {
    const user = await createUser({ email: "c@z.com", password: "hash3" }, db);
    expect(user.email).toBe("c@z.com");
    expect(user.password).toBe("hash3");
    expect(typeof user.createdAt).toBe("string");
  });

  it("createUser con email duplicado lanza error (UNIQUE)", async () => {
    await expect(
      createUser({ email: "a@x.com", password: "hashX" }, db)
    ).rejects.toThrow();
  });
});

describe("wallet.repository", () => {
  it("findWalletByUserId devuelve la wallet del usuario", async () => {
    const found = await findWalletByUserId(1, db);
    expect(found?.userId).toBe(1);
    expect(typeof found?.id).toBe("number");
  });

  it("findWalletByUserId inexistente devuelve null", async () => {
    expect(await findWalletByUserId(999, db)).toBeNull();
  });

  it("createWalletForUser para un usuario sin wallet funciona", async () => {
    const user = await createUser({ email: "d@w.com", password: "hash4" }, db);
    const wallet = await createWalletForUser(user.id, db);
    expect(wallet.userId).toBe(user.id);
  });

  it("createWalletForUser duplicado falla (user_id UNIQUE)", async () => {
    await expect(createWalletForUser(1, db)).rejects.toThrow();
  });
});

describe("balance.repository", () => {
  it("findBalancesByWalletId devuelve los 3 saldos iniciales", async () => {
    const balances = await findBalancesByWalletId(1, db);
    expect(balances).toHaveLength(3);
    expect(balances.map((b) => b.currency)).toEqual(["COP", "EUR", "USD"]);
    expect(balances.map((b) => `${b.currency}:${b.amount}`)).toEqual([
      "COP:2000000",
      "EUR:500",
      "USD:1000",
    ]);
  });

  it("los montos llegan como number (no string)", async () => {
    const balances = await findBalancesByWalletId(1, db);
    expect(balances.every((b) => typeof b.amount === "number")).toBe(true);
  });

  it("findBalancesByWalletId de wallet inexistente devuelve []", async () => {
    expect(await findBalancesByWalletId(999, db)).toEqual([]);
  });

  it("createInitialBalances duplicado falla (wallet+currency UNIQUE)", async () => {
    await expect(createInitialBalances(1, db)).rejects.toThrow();
  });

  it("createInitialBalances crea saldos en otra wallet", async () => {
    const balances = await createInitialBalances(2, db);
    expect(balances).toHaveLength(3);
    expect(balances.every((b) => b.walletId === 2)).toBe(true);
  });
});

describe("transaction.repository", () => {
  it("findTransactionsByUserId sin movimientos devuelve []", async () => {
    expect(await findTransactionsByUserId(1, db)).toEqual([]);
  });

  it("findTransactionsByUserId devuelve las transacciones del usuario", async () => {
    await db.query(
      `INSERT INTO transactions (user_id, wallet_id, currency, amount, type)
       VALUES ($1, $2, $3, $4, $5)`,
      [2, 2, "USD", 150.5, "exchange"]
    );
    const tx = await findTransactionsByUserId(2, db);
    expect(tx).toHaveLength(1);
    expect(tx[0]?.type).toBe("exchange");
    expect(tx[0]?.userId).toBe(2);
    expect(tx[0]?.walletId).toBe(2);
    expect(typeof tx[0]?.amount).toBe("number");
  });
});