import test from "node:test";
import assert from "node:assert/strict";

import { createApiApp } from "./index.ts";

test("api app creates and executes a direct payment for a claimed recipient", () => {
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

  const recipient = api.resolveRecipient({ email: "alice@gmail.com" });
  const created = api.payments.create({
    intentId: "intent_1",
    amount: "50.00",
    asset: "USDC",
    recipient
  });
  const executed = api.payments.execute(created.payment.id);
  const settlement = api.settlements.get(created.payment.id);

  assert.equal(created.payment.status, "ready_for_settlement");
  assert.equal(executed.status, "settled");
  assert.match(executed.txHash ?? "", /^0xsettled_/);
  assert.equal(settlement?.status, "settled");
});

test("api app creates a claimable payment and allows claim settlement", () => {
  const api = createApiApp();

  const recipient = api.resolveRecipient({ email: "new-user@gmail.com" });
  const created = api.payments.create({
    intentId: "intent_2",
    amount: "75.00",
    asset: "USDC",
    recipient
  });
  const claimed = api.payments.claim(created.payment.id, {
    walletAddress: "0x3333333333333333333333333333333333333333"
  });
  const settlement = api.settlements.get(created.payment.id);

  assert.equal(created.payment.status, "pending_claim");
  assert.equal(claimed.status, "claimed");
  assert.equal(claimed.destination, "0x3333333333333333333333333333333333333333");
  assert.equal(settlement?.status, "claimed");
});

test("api app worker path can execute direct settlements through configured contracts", async () => {
  const calls: Array<Record<string, unknown>> = [];
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
    },
    settlement: {
      privateKey: "0xabc",
      contracts: {
        settlementRouter: "0x7777777777777777777777777777777777777777"
      },
      submitDirectContractSettlement: async (input) => {
        calls.push(input as unknown as Record<string, unknown>);
        return { txHash: "0xcontracted" };
      }
    }
  });

  const recipient = api.resolveRecipient({ email: "alice@gmail.com" });
  const created = api.payments.create({
    intentId: "intent_3",
    amount: "10.00",
    asset: "USDC",
    recipient
  });

  await api.payments.executeAsync(created.payment.id);
  const processed = await api.jobs.runQueued("worker-contract");
  const settlement = api.settlements.get(created.payment.id);

  assert.equal(processed.length, 1);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.contractAddress, "0x7777777777777777777777777777777777777777");
  assert.equal(settlement?.txHash, "0xcontracted");
});
