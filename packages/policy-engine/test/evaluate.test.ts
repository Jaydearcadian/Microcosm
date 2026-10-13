import test from "node:test";
import assert from "node:assert/strict";

import { evaluateEnvelope } from "../src/index.ts";

const envelope = {
  id: "env_payroll",
  asset: "USDC",
  maxAmountPerTx: "2000",
  maxAmountPerDay: "10000",
  allowedRecipientIds: ["rcp_alice", "rcp_agent_payroll"],
  schedule: {
    days: ["mon", "fri"],
    startHourUtc: 9,
    endHourUtc: 18
  }
} as const;

test("evaluateEnvelope approves an allowed payment intent within limits", () => {
  const result = evaluateEnvelope(envelope, {
    recipientId: "rcp_alice",
    amount: "1500",
    asset: "USDC",
    executedAt: "2026-04-13T12:00:00.000Z",
    spentToday: "3000"
  });

  assert.equal(result.allowed, true);
  assert.deepEqual(result.reasons, []);
});

test("evaluateEnvelope rejects disallowed recipients", () => {
  const result = evaluateEnvelope(envelope, {
    recipientId: "rcp_unknown",
    amount: "1500",
    asset: "USDC",
    executedAt: "2026-04-13T12:00:00.000Z",
    spentToday: "3000"
  });

  assert.equal(result.allowed, false);
  assert.match(result.reasons[0], /Recipient is not allowed/);
});

test("evaluateEnvelope rejects transactions outside amount and schedule constraints", () => {
  const result = evaluateEnvelope(envelope, {
    recipientId: "rcp_alice",
    amount: "2500",
    asset: "USDC",
    executedAt: "2026-04-14T04:00:00.000Z",
    spentToday: "9000"
  });

  assert.equal(result.allowed, false);
  assert.ok(result.reasons.some((reason) => /per-transaction/.test(reason)));
  assert.ok(result.reasons.some((reason) => /allowed schedule/.test(reason)));
  assert.ok(result.reasons.some((reason) => /daily limit/.test(reason)));
});
