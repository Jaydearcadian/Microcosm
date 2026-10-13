import test from "node:test";
import assert from "node:assert/strict";

import {
  createArcSettlementConfirmer,
  createArcSettlementExecutor,
  createSettlementConfirmationLoop,
  createSettlementStore
} from "../src/index.ts";

test("arc settlement executor returns a direct settlement plan for claimed recipients", () => {
  const executor = createArcSettlementExecutor();

  const settlement = executor.plan({
    paymentId: "pay_1",
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

  assert.equal(settlement.mode, "direct");
  assert.equal(settlement.chain, "arc");
  assert.equal(settlement.destination, "0x1111111111111111111111111111111111111111");
});

test("arc settlement executor returns a claimable settlement plan for unresolved email recipients", () => {
  const executor = createArcSettlementExecutor();

  const settlement = executor.plan({
    paymentId: "pay_2",
    amount: "75.00",
    asset: "USDC",
    recipient: {
      id: "pending:new-user@gmail.com",
      ownerType: "external",
      claimStatus: "pending-claim",
      lookupKey: "new-user@gmail.com"
    }
  });

  assert.equal(settlement.mode, "claimable");
  assert.match(settlement.escrowId, /^escrow:/);
});

test("settlement store tracks pending confirmation for real async transactions", () => {
  const store = createSettlementStore();
  store.create({
    chain: "arc",
    mode: "direct",
    paymentId: "pay_3",
    amount: "100.00",
    asset: "USDC",
    destination: "0x3333333333333333333333333333333333333333"
  });

  const settled = store.markSettled("pay_3", {
    status: "settled",
    simulated: false,
    txHash: "0xpay_3"
  });

  assert.equal(settled.confirmationStatus, "pending");
  assert.equal(store.listPendingConfirmations().length, 1);

  const confirmed = store.markConfirmed("pay_3", {
    confirmedAt: "2026-04-13T19:00:00.000Z"
  });

  assert.equal(confirmed.confirmationStatus, "confirmed");
  assert.equal(store.listPendingConfirmations().length, 0);
});

test("settlement confirmation loop confirms pending tx hashes and records attempts", async () => {
  const store = createSettlementStore();
  store.create({
    chain: "arc",
    mode: "direct",
    paymentId: "pay_4",
    amount: "150.00",
    asset: "USDC",
    destination: "0x4444444444444444444444444444444444444444"
  });
  store.markSettled("pay_4", {
    status: "settled",
    simulated: false,
    txHash: "0xpay_4"
  });

  const loop = createSettlementConfirmationLoop({
    settlements: store,
    async confirmTx(txHash) {
      assert.equal(txHash, "0xpay_4");
      return {
        confirmed: true,
        checkedAt: "2026-04-13T19:05:00.000Z"
      };
    }
  });

  const results = await loop.runPendingConfirmations();
  const record = store.get("pay_4");

  assert.equal(results.length, 1);
  assert.equal(results[0]?.confirmed, true);
  assert.equal(record?.confirmationStatus, "confirmed");
  assert.equal(record?.confirmationAttempts, 1);
});

test("arc settlement confirmer checks transaction receipts over JSON-RPC", async () => {
  const confirmer = createArcSettlementConfirmer({
    rpcUrl: "https://rpc.testnet.arc.network",
    fetchImpl: (async () =>
      new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          result: {
            blockHash: "0xblock",
            status: "0x1"
          }
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      )) as typeof fetch
  });

  const result = await confirmer("0xpay_5");

  assert.equal(result.confirmed, true);
});

test("arc settlement executor can route direct settlements through a contract-aware submitter", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const executor = createArcSettlementExecutor({
    privateKey: "0xabc",
    contracts: {
      settlementRouter: "0x7777777777777777777777777777777777777777"
    },
    submitDirectContractSettlement: async (input) => {
      calls.push(input as unknown as Record<string, unknown>);
      return {
        txHash: "0xcontract_direct"
      };
    }
  });

  const result = await executor.executeAsync({
    chain: "arc",
    mode: "direct",
    paymentId: "pay_contract_1",
    amount: "25.00",
    asset: "USDC",
    destination: "0x1111111111111111111111111111111111111111"
  });

  assert.equal(result.txHash, "0xcontract_direct");
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.contractAddress, "0x7777777777777777777777777777777777777777");
});

test("arc settlement executor can route direct settlements through a first-party Arc client", async () => {
  const calls: string[] = [];
  const executor = createArcSettlementExecutor({
    privateKey: "0xabc",
    contracts: {
      settlementRouter: "0x7777777777777777777777777777777777777777"
    },
    arcClient: {
      async settleDirect() {
        calls.push("settleDirect");
        return "0xarc_client";
      }
    } as never
  });

  const result = await executor.executeAsync({
    chain: "arc",
    mode: "direct",
    paymentId: "pay_contract_client",
    amount: "20.00",
    asset: "USDC",
    destination: "0x1111111111111111111111111111111111111111"
  });

  assert.equal(result.txHash, "0xarc_client");
  assert.equal(calls.length, 1);
});

test("arc settlement executor can build claimable settlements from deployed escrow contracts", () => {
  const executor = createArcSettlementExecutor({
    contracts: {
      claimEscrow: "0x8888888888888888888888888888888888888888"
    }
  });

  const plan = executor.plan({
    paymentId: "pay_contract_2",
    amount: "50.00",
    asset: "USDC",
    recipient: {
      id: "pending:alice@gmail.com",
      ownerType: "external",
      claimStatus: "pending-claim",
      lookupKey: "alice@gmail.com"
    }
  });

  assert.equal(plan.mode, "claimable");
  assert.equal(plan.escrowId, "0x8888888888888888888888888888888888888888:pay_contract_2");
});
