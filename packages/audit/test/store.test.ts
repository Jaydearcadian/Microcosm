import test from "node:test";
import assert from "node:assert/strict";

import { createAuditStore } from "../src/index.ts";

test("audit store records append-only events", () => {
  const audit = createAuditStore();

  audit.record({
    id: "aud_1",
    actorType: "system",
    actorId: "api",
    eventType: "payment.created",
    objectType: "payment",
    objectId: "pay_1",
    payload: { amount: "10.00" }
  });

  audit.record({
    id: "aud_2",
    actorType: "system",
    actorId: "worker",
    eventType: "settlement.completed",
    objectType: "settlement",
    objectId: "stl_pay_1",
    payload: { txHash: "0xabc" }
  });

  assert.equal(audit.list().length, 2);
  assert.equal(audit.list()[1]?.eventType, "settlement.completed");
});
