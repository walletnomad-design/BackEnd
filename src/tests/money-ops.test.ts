import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import {
  createUser,
  createWalletForUser,
  createInitialBalances,
  findBalancesByWalletId,
  findTransactionsByUserId,
} from "../repositories";
import {
  deposit,
  transfer,
  moneyOpsService,
  InvalidMoneyOpError,
  MoneyOpRecipientNotFoundError,
  MoneyOpInsufficientBalanceError,
} from "../services/money-ops.service";
import { WalletNotFoundError } from "../services/wallet.service";
import type { Queryable } from "../repositories/queryable";

let pg: PGlite;
let db: Queryable;
let senderId: number;
let receiverId: number;
let walletSenderId: number;
let walletReceiverId: number;

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(fs.readFileSync(path.join(process.cwd(), "src", "db", "schema.sql"), "utf8"));
  db = pg as unknown as Queryable;

  const sender = await createUser({ email: "sender@x.com", password: "hash1" }, db);
  const receiver = await createUser({ email: "receiver@x.com", password: "hash2" }, db);
  senderId = sender.id;
  receiverId = receiver.id;

  const walletSender = await createWalletForUser(sender.id, db);
  const walletReceiver = await createWalletForUser(receiver.id, db);
  walletSenderId = walletSender.id;
  walletReceiverId = walletReceiver.id;
  await createInitialBalances(walletSender.id, db);
  await createInitialBalances(walletReceiver.id, db);
});

afterAll(async () => {
  await pg.close();
});

describe("money-ops.service.deposit", () => {
  it("moneyOpsService expone el contrato del servicio", async () => {
    await expect(
      moneyOpsService.deposit({ userId: senderId, currency: "USD", amount: 50 }, db)
    ).resolves.toBeDefined();
  });

  it("acredita el monto en la moneda y registra una transacción deposit", async () => {
    const before = await findBalancesByWalletId(walletSenderId, db);
    const usdBefore = before.find((b) => b.currency === "USD")?.amount ?? 0;

    const tx = await deposit({ userId: senderId, currency: "USD", amount: 100 }, db);

    expect(tx.type).toBe("deposit");
    expect(tx.fromCurrency).toBe("USD");
    expect(tx.toCurrency).toBe("USD");
    expect(tx.fromAmount).toBe(100);
    expect(tx.toAmount).toBe(100);
    expect(tx.rate).toBe(1);
    expect(tx.status).toBe("completed");
    expect(tx.toUserId).toBeUndefined();

    const after = await findBalancesByWalletId(walletSenderId, db);
    const usdAfter = after.find((b) => b.currency === "USD")?.amount ?? 0;
    expect(usdAfter).toBeCloseTo(usdBefore + 100);
  });

  it("rechaza moneda no soportada y monto no positivo", async () => {
    await expect(
      deposit({ userId: senderId, currency: "ARS" as never, amount: 10 }, db)
    ).rejects.toBeInstanceOf(InvalidMoneyOpError);

    await expect(
      deposit({ userId: senderId, currency: "USD", amount: 0 }, db)
    ).rejects.toBeInstanceOf(InvalidMoneyOpError);

    await expect(
      deposit({ userId: senderId, currency: "USD", amount: -5 }, db)
    ).rejects.toBeInstanceOf(InvalidMoneyOpError);
  });

  it("lanza WalletNotFoundError si el usuario no tiene billetera", async () => {
    await expect(
      deposit({ userId: 999999, currency: "USD", amount: 10 }, db)
    ).rejects.toBeInstanceOf(WalletNotFoundError);
  });
});

describe("money-ops.service.transfer", () => {
  it("transfiere entre usuarios: debita al remitente, acredita al destinatario", async () => {
    await deposit({ userId: senderId, currency: "USD", amount: 200 }, db);

    const senderBefore = await findBalancesByWalletId(walletSenderId, db);
    const usdSenderBefore = senderBefore.find((b) => b.currency === "USD")?.amount ?? 0;

    const tx = await transfer(
      { userId: senderId, toEmail: "receiver@x.com", currency: "USD", amount: 80 },
      db
    );

    expect(tx.type).toBe("transfer");
    expect(tx.fromCurrency).toBe("USD");
    expect(tx.toCurrency).toBe("USD");
    expect(tx.fromAmount).toBe(80);
    expect(tx.toAmount).toBe(80);
    expect(tx.rate).toBe(1);
    expect(tx.status).toBe("completed");
    expect(tx.toUserId).toBe(receiverId);

    const senderAfter = await findBalancesByWalletId(walletSenderId, db);
    const usdSenderAfter = senderAfter.find((b) => b.currency === "USD")?.amount ?? 0;
    expect(usdSenderAfter).toBeCloseTo(usdSenderBefore - 80);

    const receiverBalances = await findBalancesByWalletId(walletReceiverId, db);
    const usdReceiver = receiverBalances.find((b) => b.currency === "USD")?.amount ?? 0;
    expect(usdReceiver).toBeCloseTo(80);
  });

  it("la transferencia aparece en el historial del destinatario", async () => {
    const history = await findTransactionsByUserId(receiverId, db);
    const incoming = history.find((t) => t.type === "transfer" && t.userId === senderId);
    expect(incoming).toBeDefined();
    expect(incoming?.toUserId).toBe(receiverId);
    expect(incoming?.fromAmount).toBe(80);
  });

  it("rechaza destinatario inexistente (404) y no toca saldos", async () => {
    const before = await findBalancesByWalletId(walletSenderId, db);

    await expect(
      transfer(
        { userId: senderId, toEmail: "nadie@x.com", currency: "USD", amount: 10 },
        db
      )
    ).rejects.toBeInstanceOf(MoneyOpRecipientNotFoundError);

    const after = await findBalancesByWalletId(walletSenderId, db);
    expect(after).toEqual(before);
  });

  it("rechaza transferencia a la propia cuenta (400)", async () => {
    await expect(
      transfer(
        { userId: senderId, toEmail: "sender@x.com", currency: "USD", amount: 10 },
        db
      )
    ).rejects.toBeInstanceOf(InvalidMoneyOpError);
  });

  it("rechaza monto no positivo y moneda inválida (400)", async () => {
    await expect(
      transfer(
        { userId: senderId, toEmail: "receiver@x.com", currency: "USD", amount: 0 },
        db
      )
    ).rejects.toBeInstanceOf(InvalidMoneyOpError);

    await expect(
      transfer(
        { userId: senderId, toEmail: "receiver@x.com", currency: "BRL" as never, amount: 10 },
        db
      )
    ).rejects.toBeInstanceOf(InvalidMoneyOpError);

    await expect(
      transfer({ userId: senderId, toEmail: "   ", currency: "USD", amount: 10 }, db)
    ).rejects.toBeInstanceOf(InvalidMoneyOpError);
  });

  it("rechaza saldo insuficiente (409) y hace rollback", async () => {
    const beforeSender = await findBalancesByWalletId(walletSenderId, db);
    const beforeReceiver = await findBalancesByWalletId(walletReceiverId, db);

    await expect(
      transfer(
        { userId: senderId, toEmail: "receiver@x.com", currency: "EUR", amount: 999999 },
        db
      )
    ).rejects.toBeInstanceOf(MoneyOpInsufficientBalanceError);

    const afterSender = await findBalancesByWalletId(walletSenderId, db);
    const afterReceiver = await findBalancesByWalletId(walletReceiverId, db);
    expect(afterSender).toEqual(beforeSender);
    expect(afterReceiver).toEqual(beforeReceiver);
  });
});