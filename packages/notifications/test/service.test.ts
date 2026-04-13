import test from "node:test";
import assert from "node:assert/strict";

import { createNotificationService } from "../src/index.ts";

test("notification service records dispatched events", async () => {
  const notifications = createNotificationService();

  await notifications.emit({
    type: "payment.created",
    channel: "email",
    recipient: "alice@gmail.com",
    payload: { paymentId: "pay_1" }
  });

  assert.equal(notifications.list().length, 1);
  assert.equal(notifications.list()[0]?.type, "payment.created");
});
