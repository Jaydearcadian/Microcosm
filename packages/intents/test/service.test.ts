import test from "node:test";
import assert from "node:assert/strict";

import { createEnvelopeStore } from "../../envelopes/src/index.ts";
import { createIntentService } from "../src/index.ts";

test("intent service creates an intent and evaluates it against an envelope", () => {
  const envelopes = createEnvelopeStore();
  envelopes.create({
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

  const intents = createIntentService({ envelopes });
  const created = intents.create({
    type: "send_money",
    envelopeId: "env_payroll",
    recipientId: "rcp_alice",
    amount: "700",
    asset: "USDC",
    executedAt: "2026-04-13T12:00:00.000Z",
    spentToday: "500"
  });

  assert.equal(created.intent.status, "approved");
  assert.equal(created.evaluation.allowed, true);
  assert.equal(intents.list().length, 1);
});

test("intent service rejects an intent that violates the envelope", () => {
  const envelopes = createEnvelopeStore();
  envelopes.create({
    id: "env_payroll",
    asset: "USDC",
    maxAmountPerTx: "1000",
    maxAmountPerDay: "10000",
    allowedRecipientIds: ["rcp_alice"],
    schedule: {
      days: ["mon", "fri"],
      startHourUtc: 9,
      endHourUtc: 18
    }
  });

  const intents = createIntentService({ envelopes });
  const created = intents.create({
    type: "send_money",
    envelopeId: "env_payroll",
    recipientId: "rcp_bob",
    amount: "2000",
    asset: "USDC",
    executedAt: "2026-04-13T04:00:00.000Z",
    spentToday: "9500"
  });

  assert.equal(created.intent.status, "rejected");
  assert.equal(created.evaluation.allowed, false);
  assert.ok(created.evaluation.reasons.length >= 2);
});
