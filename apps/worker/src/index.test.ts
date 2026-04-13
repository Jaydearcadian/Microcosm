import test from "node:test";
import assert from "node:assert/strict";

import { createWorkerApp } from "./index.ts";

test("worker app queues jobs for planned settlements and marks them completed", () => {
  const worker = createWorkerApp({
    settlements: [
      {
        id: "stl_pay_1",
        paymentId: "pay_1",
        chain: "arc",
        mode: "direct",
        status: "planned",
        amount: "10.00",
        asset: "USDC",
        destination: "0x1111111111111111111111111111111111111111"
      },
      {
        id: "stl_pay_2",
        paymentId: "pay_2",
        chain: "arc",
        mode: "claimable",
        status: "claimed",
        amount: "20.00",
        asset: "USDC",
        escrowId: "escrow:pay_2",
        destination: "0x2222222222222222222222222222222222222222"
      }
    ]
  });

  const queued = worker.queuePendingSettlementJobs();

  assert.equal(queued.length, 1);
  assert.equal(queued[0]?.paymentId, "pay_1");
  assert.equal(worker.listJobs().length, 1);

  const processed = worker.runJob(queued[0]!.id);

  assert.equal(processed.status, "completed");
  assert.equal(worker.listJobs()[0]?.status, "completed");
});

test("worker app processes queued settlement jobs with an executor callback", async () => {
  const executed: string[] = [];
  const worker = createWorkerApp({
    settlements: [
      {
        id: "stl_pay_3",
        paymentId: "pay_3",
        chain: "arc",
        mode: "direct",
        status: "planned",
        amount: "15.00",
        asset: "USDC",
        destination: "0x3333333333333333333333333333333333333333"
      }
    ]
  });

  const [job] = worker.queuePendingSettlementJobs();
  const processed = await worker.processJob(job!.id, async (queuedJob) => {
    executed.push(queuedJob.paymentId);
    return {
      txHash: "0xworker_pay_3"
    };
  });

  assert.equal(executed.length, 1);
  assert.equal(executed[0], "pay_3");
  assert.equal(processed.status, "completed");
  assert.equal(processed.result?.txHash, "0xworker_pay_3");
});

test("worker app leases queued jobs so only one in-flight worker can claim them", () => {
  const worker = createWorkerApp({
    settlements: [
      {
        id: "stl_pay_4",
        paymentId: "pay_4",
        chain: "arc",
        mode: "direct",
        status: "planned",
        amount: "25.00",
        asset: "USDC",
        destination: "0x4444444444444444444444444444444444444444"
      }
    ]
  });

  worker.queuePendingSettlementJobs();

  const leased = worker.claimNextJob("worker-a");
  const secondLease = worker.claimNextJob("worker-b");

  assert.equal(leased?.status, "processing");
  assert.equal(leased?.leaseOwner, "worker-a");
  assert.equal(secondLease, undefined);
});

test("worker app drains queued jobs through a runtime processing loop", async () => {
  const processedPayments: string[] = [];
  const worker = createWorkerApp({
    settlements: [
      {
        id: "stl_pay_5",
        paymentId: "pay_5",
        chain: "arc",
        mode: "direct",
        status: "planned",
        amount: "35.00",
        asset: "USDC",
        destination: "0x5555555555555555555555555555555555555555"
      },
      {
        id: "stl_pay_6",
        paymentId: "pay_6",
        chain: "arc",
        mode: "direct",
        status: "planned",
        amount: "45.00",
        asset: "USDC",
        destination: "0x6666666666666666666666666666666666666666"
      }
    ]
  });

  worker.queuePendingSettlementJobs();

  const drained = await worker.drainQueuedJobs("runtime-worker", async (job) => {
    processedPayments.push(job.paymentId);
    return {
      txHash: `0x${job.paymentId}`
    };
  });

  assert.equal(drained.length, 2);
  assert.deepEqual(processedPayments, ["pay_5", "pay_6"]);
  assert.equal(worker.listJobs().every((job) => job.status === "completed"), true);
});

test("worker app can reclaim a stale processing lease for another worker", () => {
  const worker = createWorkerApp({
    settlements: [
      {
        id: "stl_pay_7",
        paymentId: "pay_7",
        chain: "arc",
        mode: "direct",
        status: "planned",
        amount: "55.00",
        asset: "USDC",
        destination: "0x7777777777777777777777777777777777777777"
      }
    ],
    jobs: [
      {
        id: "job_pay_7",
        type: "settlement.execute",
        paymentId: "pay_7",
        settlementId: "stl_pay_7",
        status: "processing",
        leaseOwner: "worker-a",
        leasedAt: "2026-04-13T18:00:00.000Z"
      }
    ]
  });

  const reclaimed = worker.claimNextJob("worker-b", {
    leaseTimeoutMs: 60_000,
    now: "2026-04-13T18:02:00.000Z"
  });

  assert.equal(reclaimed?.status, "processing");
  assert.equal(reclaimed?.leaseOwner, "worker-b");
});
