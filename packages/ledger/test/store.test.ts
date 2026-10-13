import test from "node:test";
import assert from "node:assert/strict";

import { createLedgerStore } from "../src/index.ts";

test("ledger store records payment lifecycle entries", () => {
  const ledger = createLedgerStore();

  ledger.record({
    id: "led_1",
    accountId: "recipient:rcp_1",
    entryType: "liability_hold",
    asset: "USDC",
    amount: "10.00",
    referenceType: "payment",
    referenceId: "pay_1"
  });

  ledger.record({
    id: "led_2",
    accountId: "recipient:rcp_1",
    entryType: "settlement_complete",
    asset: "USDC",
    amount: "10.00",
    referenceType: "settlement",
    referenceId: "stl_pay_1"
  });

  assert.equal(ledger.list().length, 2);
  assert.equal(ledger.list()[0]?.referenceId, "pay_1");
  assert.equal(ledger.list()[1]?.referenceType, "settlement");
});

