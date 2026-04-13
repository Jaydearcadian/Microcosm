import test from "node:test";
import assert from "node:assert/strict";

import { createWorkerRuntime } from "./main.ts";

test("worker runtime runs a single queued pass with the configured worker id", async () => {
  const seen: string[] = [];
  const runtime = createWorkerRuntime({
    workerId: "runtime-worker",
    async runQueued(workerId) {
      seen.push(workerId);
      return [{ id: "job_1" }];
    }
  });

  const processed = await runtime.runOnce();

  assert.equal(seen.length, 1);
  assert.equal(seen[0], "runtime-worker");
  assert.equal(processed.length, 1);
});

test("worker runtime can run a confirmation pass", async () => {
  const seen: string[] = [];
  const runtime = createWorkerRuntime({
    workerId: "runtime-worker",
    async runQueued() {
      return [];
    },
    async runConfirmations() {
      seen.push("confirm");
      return [{ paymentId: "pay_1", txHash: "0xpay_1", confirmed: true }];
    }
  });

  const confirmed = await runtime.runConfirmationPass();

  assert.equal(seen.length, 1);
  assert.equal(confirmed.length, 1);
});

test("worker runtime starts and stops interval polling", async () => {
  let runs = 0;
  const runtime = createWorkerRuntime({
    workerId: "loop-worker",
    intervalMs: 5,
    async runQueued() {
      runs += 1;
      return [];
    }
  });

  runtime.start();
  await new Promise((resolve) => setTimeout(resolve, 20));
  runtime.stop();
  const snapshot = runs;
  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.equal(snapshot > 0, true);
  assert.equal(runs, snapshot);
});
