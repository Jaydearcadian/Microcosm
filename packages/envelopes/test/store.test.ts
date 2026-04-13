import test from "node:test";
import assert from "node:assert/strict";

import { createEnvelopeStore } from "../src/index.ts";

test("envelope store creates and retrieves envelopes", () => {
  const store = createEnvelopeStore();
  const envelope = store.create({
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

  assert.equal(envelope.id, "env_payroll");
  assert.equal(store.get("env_payroll")?.asset, "USDC");
  assert.equal(store.list().length, 1);
});

test("envelope store evaluates intents against stored envelopes", () => {
  const store = createEnvelopeStore();
  store.create({
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

  const result = store.evaluate("env_payroll", {
    recipientId: "rcp_alice",
    amount: "500",
    asset: "USDC",
    executedAt: "2026-04-13T12:00:00.000Z",
    spentToday: "1000"
  });

  assert.equal(result.allowed, true);
});
