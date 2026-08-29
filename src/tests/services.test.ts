import type { Pool } from "pg";
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { createUser, createWalletForUser, createInitialBalances } from "../repositories";
import { getWalletByUserId, walletService, WalletNotFoundError } from "../services/wallet.service";
import {
  getBalancesByWalletId,
  balanceService,
} from "../services/balance.service";

let pg: PGlite;
let db: Pool;

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(fs.readFileSync(path.join(process.cwd(), "src", "db", "schema.sql"), "utf8"));
  db = pg as unknown as Pool;

  const user = await createUser({ email: "svc@x.com", password: "hash1" }, db);
  const wallet = await createWalletForUser(user.id, db);
  await createInitialBalances(wallet.id, db);
});

afterAll(async () => {
  await pg.close();
});

describe("wallet.service", () => {
  it("getWalletByUserId devuelve la wallet del usuario", async () => {
    const wallet = await getWalletByUserId(1, db);
    expect(wallet.userId).toBe(1);
    expect(typeof wallet.id).toBe("number");
  });

  it("walletService.getWalletByUserId funciona como objeto de contrato", async () => {
    const wallet = await walletService.getWalletByUserId(1, db);
    expect(wallet.id).toBe(1);
  });

  it("getWalletByUserId de usuario sin wallet lanza WalletNotFoundError", async () => {
    await expect(getWalletByUserId(999, db)).rejects.toBeInstanceOf(
      WalletNotFoundError
    );
  });

  it("el error trae message (formato { error, message })", async () => {
    await expect(getWalletByUserId(999, db)).rejects.toThrow(
      /No existe la billetera para el usuario/
    );
  });
});

describe("balance.service", () => {
  it("getBalancesByWalletId devuelve solo { currency, amount }", async () => {
    const balances = await getBalancesByWalletId(1, db);
    expect(balances).toHaveLength(3);
    expect(balances[0]).toEqual({ currency: "COP", amount: 2000000 });
    expect(balances[1]).toEqual({ currency: "EUR", amount: 500 });
    expect(balances[2]).toEqual({ currency: "USD", amount: 1000 });
  });

  it("balanceService.getBalancesByWalletId funciona como objeto de contrato", async () => {
    const balances = await balanceService.getBalancesByWalletId(1, db);
    expect(balances).toHaveLength(3);
  });

  it("getBalancesByWalletId de wallet inexistente devuelve []", async () => {
    expect(await getBalancesByWalletId(999, db)).toEqual([]);
  });
});