import test from "node:test";
import assert from "node:assert/strict";

import { createApiApp } from "./index.ts";

test("api app exposes payment creation on top of settlement planning", () => {
  const api = createApiApp();

  const created = api.payments.create({
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

  assert.equal(created.settlement.chain, "arc");
  assert.equal(api.payments.list().length, 1);
});
