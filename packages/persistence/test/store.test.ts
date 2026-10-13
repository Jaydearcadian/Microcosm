import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { rmSync } from "node:fs";

import { createJsonStateStore } from "../src/index.ts";

test("json state store persists and reloads api state", () => {
  const filePath = path.join(os.tmpdir(), `mcosm-state-${Date.now()}.json`);
  rmSync(filePath, { force: true });

  const store = createJsonStateStore(filePath);
  store.write({
    users: [{ id: "usr_1" }],
    recipients: [{ id: "rcp_1" }],
    envelopes: [{ id: "env_1" }],
    intents: [{ id: "intent_1" }],
    payments: [{ id: "pay_1" }],
    notifications: [{ id: "ntf_1" }],
    settlements: [{ id: "stl_pay_1" }],
    ledgerEntries: [{ id: "led_1" }],
    auditEvents: [{ id: "aud_1" }],
    workerJobs: [{ id: "job_pay_1" }]
  });

  const reloaded = createJsonStateStore(filePath).read();

  assert.equal(reloaded.users.length, 1);
  assert.equal(reloaded.recipients.length, 1);
  assert.equal(reloaded.envelopes.length, 1);
  assert.equal(reloaded.intents.length, 1);
  assert.equal(reloaded.payments.length, 1);
  assert.equal(reloaded.notifications.length, 1);
  assert.equal(reloaded.settlements.length, 1);
  assert.equal(reloaded.ledgerEntries.length, 1);
  assert.equal(reloaded.auditEvents.length, 1);
  assert.equal(reloaded.workerJobs.length, 1);

  rmSync(filePath, { force: true });
});
