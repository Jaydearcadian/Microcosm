import test from "node:test";
import assert from "node:assert/strict";

import {
  ARC_USDC_ADDRESS,
  createArcContractClient
} from "../src/index.ts";

test("createArcContractClient writes direct settlements through SettlementRouter", async () => {
  const writes: Array<Record<string, unknown>> = [];
  const client = createArcContractClient({
    privateKey: "0xabc",
    contracts: {
      settlementRouter: "0x7777777777777777777777777777777777777777"
    },
    walletClient: {
      async writeContract(input: Record<string, unknown>) {
        writes.push(input as Record<string, unknown>);
        return "0xrouter_tx";
      }
    } as never,
    publicClient: {
      async getTransactionReceipt() {
        return { status: "success", blockHash: "0xblock" };
      },
      async getLogs() {
        return [];
      }
    } as never
  });

  const txHash = await client.settleDirect({
    paymentId: "pay_1",
    amount: "25.00",
    recipient: "0x1111111111111111111111111111111111111111"
  });

  assert.equal(txHash, "0xrouter_tx");
  assert.equal(writes.length, 1);
  assert.equal(
    writes[0]?.address,
    "0x7777777777777777777777777777777777777777"
  );
  assert.equal(writes[0]?.functionName, "settleDirect");
  assert.equal(
    (writes[0]?.args as unknown[] | undefined)?.[1],
    ARC_USDC_ADDRESS
  );
});

test("createArcContractClient writes escrow creation and claims through ClaimEscrow", async () => {
  const writes: Array<Record<string, unknown>> = [];
  const client = createArcContractClient({
    privateKey: "0xabc",
    contracts: {
      claimEscrow: "0x8888888888888888888888888888888888888888"
    },
    walletClient: {
      async writeContract(input: Record<string, unknown>) {
        writes.push(input as Record<string, unknown>);
        return "0xescrow_tx";
      }
    } as never,
    publicClient: {
      async getTransactionReceipt() {
        return { status: "success", blockHash: "0xblock" };
      },
      async getLogs() {
        return [];
      }
    } as never
  });

  const createHash = await client.createClaimEscrow({
    paymentId: "pay_2",
    amount: "40.00",
    lookupKey: "alice@gmail.com"
  });
  const claimHash = await client.claimEscrow({
    paymentId: "pay_2",
    recipient: "0x2222222222222222222222222222222222222222"
  });

  assert.equal(createHash, "0xescrow_tx");
  assert.equal(claimHash, "0xescrow_tx");
  assert.equal(writes.length, 2);
  assert.equal(writes[0]?.functionName, "createEscrow");
  assert.equal(writes[1]?.functionName, "claim");
});

test("createArcContractClient exposes receipt confirmation and event reads", async () => {
  const client = createArcContractClient({
    privateKey: "0xabc",
    contracts: {
      settlementRouter: "0x7777777777777777777777777777777777777777"
    },
    walletClient: {
      async writeContract() {
        return "0xunused";
      }
    } as never,
    publicClient: {
      async getTransactionReceipt() {
        return { status: "success", blockHash: "0xblock" };
      },
      async getLogs() {
        return [{ transactionHash: "0xlog_tx" }];
      }
    } as never
  });

  const receipt = await client.confirmTransaction("0xabc");
  const logs = await client.getDirectSettlementEvents();

  assert.equal(receipt.confirmed, true);
  assert.equal(logs.length, 1);
});
