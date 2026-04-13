import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";

import { createApiApp } from "./index.ts";

test("api app exposes envelope creation and intent evaluation helpers", () => {
  const api = createApiApp();

  api.envelopes.create({
    id: "env_payroll",
    asset: "USDC",
    maxAmountPerTx: "2000",
    maxAmountPerDay: "10000",
    allowedRecipientIds: ["rcp_alice"],
    schedule: {
      days: ["mon", "fri"],
      startHourUtc: 9,
      endHourUtc: 18
    }
  });

  const created = api.intents.create({
    type: "send_money",
    envelopeId: "env_payroll",
    recipientId: "rcp_alice",
    amount: "800",
    asset: "USDC",
    executedAt: "2026-04-13T12:00:00.000Z",
    spentToday: "0"
  });

  assert.equal(created.intent.status, "approved");
  assert.equal(api.envelopes.list().length, 1);
  assert.equal(api.intents.list().length, 1);
});

test("api app resolves a known email recipient from the directory", () => {
  const api = createApiApp({
    directory: {
      emails: {
        "alice@gmail.com": {
          id: "rcp_alice",
          ownerType: "user",
          ownerId: "usr_alice",
          walletAddress: "0x1111111111111111111111111111111111111111",
          claimStatus: "claimed"
        }
      }
    }
  });

  const recipient = api.resolveRecipient({
    email: "alice@gmail.com"
  });

  assert.equal(recipient.id, "rcp_alice");
  assert.equal(recipient.claimStatus, "claimed");
});

test("api app rehydrates envelopes, intents, payments, and notifications from persistence", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "mcosm-api-"));
  const persistenceFile = path.join(directory, "state.json");

  try {
    const writer = createApiApp({ persistenceFile });

    writer.envelopes.create({
      id: "env_payroll",
      asset: "USDC",
      maxAmountPerTx: "2000",
      maxAmountPerDay: "10000",
      allowedRecipientIds: ["rcp_alice"],
      schedule: {
        days: ["mon", "fri"],
        startHourUtc: 9,
        endHourUtc: 18
      }
    });

    writer.intents.create({
      type: "send_money",
      envelopeId: "env_payroll",
      recipientId: "rcp_alice",
      amount: "800",
      asset: "USDC",
      executedAt: "2026-04-13T12:00:00.000Z",
      spentToday: "0"
    });

    writer.payments.create({
      intentId: "intent_1",
      amount: "50.00",
      asset: "USDC",
      recipient: {
        id: "rcp_alice",
        ownerType: "user",
        ownerId: "usr_alice",
        walletAddress: "0x1111111111111111111111111111111111111111",
        claimStatus: "claimed",
        lookupKey: "alice@gmail.com"
      }
    });

    const reader = createApiApp({ persistenceFile });

    assert.equal(reader.envelopes.list().length, 1);
    assert.equal(reader.intents.list().length, 1);
    assert.equal(reader.payments.list().length, 1);
    assert.equal(reader.notifications.list().length, 1);
    assert.equal(reader.payments.get("pay_1")?.status, "ready_for_settlement");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
