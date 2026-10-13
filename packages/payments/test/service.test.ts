import test from "node:test";
import assert from "node:assert/strict";

import { createArcSettlementExecutor } from "../../settlement/src/index.ts";
import { createPaymentService } from "../src/index.ts";

test("payment service creates a direct Arc settlement for claimed recipients", () => {
  const payments = createPaymentService({
    settlement: createArcSettlementExecutor()
  });

  const created = payments.create({
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

  assert.equal(created.payment.status, "ready_for_settlement");
  assert.equal(created.settlement.mode, "direct");
  assert.equal(payments.list().length, 1);
});

test("payment service creates a claimable liability for unresolved email recipients", () => {
  const payments = createPaymentService({
    settlement: createArcSettlementExecutor()
  });

  const created = payments.create({
    intentId: "intent_2",
    amount: "75.00",
    asset: "USDC",
    recipient: {
      id: "pending:new-user@gmail.com",
      ownerType: "external",
      claimStatus: "pending-claim",
      lookupKey: "new-user@gmail.com"
    }
  });

  assert.equal(created.payment.status, "pending_claim");
  assert.equal(created.settlement.mode, "claimable");
});
