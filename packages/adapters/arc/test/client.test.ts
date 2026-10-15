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
    recipient: "0x2222222222222222222222222222222222222222",
    expiresAt: 1_700_000_100n
  });
  const claimHash = await client.claimEscrow({
    paymentId: "pay_2"
  });
  const refundHash = await client.refundEscrow({
    paymentId: "pay_2"
  });

  assert.equal(createHash, "0xescrow_tx");
  assert.equal(claimHash, "0xescrow_tx");
  assert.equal(refundHash, "0xescrow_tx");
  assert.equal(writes.length, 3);
  assert.equal(writes[0]?.functionName, "createEscrow");
  assert.deepEqual(writes[0]?.args, [
    "0x7061795f32000000000000000000000000000000000000000000000000000000",
    ARC_USDC_ADDRESS,
    "0x2222222222222222222222222222222222222222",
    40_000_000n,
    1_700_000_100n
  ]);
  assert.equal(writes[1]?.functionName, "claim");
  assert.deepEqual(writes[1]?.args, [
    "0x7061795f32000000000000000000000000000000000000000000000000000000"
  ]);
  assert.equal(writes[2]?.functionName, "refund");
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

test("verifyUsdcTransfer validates exact token, recipient, sender, and base units", async () => {
  const { verifyUsdcTransfer, ERC20_TRANSFER_EVENT_TOPIC } = await import("../src/index.ts");

  const validLog = {
    address: ARC_USDC_ADDRESS,
    topics: [
      ERC20_TRANSFER_EVENT_TOPIC,
      "0x0000000000000000000000001111111111111111111111111111111111111111",
      "0x0000000000000000000000002222222222222222222222222222222222222222"
    ],
    data: "0x0000000000000000000000000000000000000000000000000000000000989680" // 10_000_000n (10 USDC)
  };

  const mockClient = {
    async getTransactionReceipt() {
      return {
        status: "success",
        blockNumber: 12345n,
        blockHash: "0xblock123",
        logs: [validLog]
      };
    }
  } as never;

  // 1. Exact match returns confirmed
  const confirmed = await verifyUsdcTransfer(mockClient, {
    txHash: "0xvalid",
    from: "0x1111111111111111111111111111111111111111",
    to: "0x2222222222222222222222222222222222222222",
    amountBaseUnits: 10_000_000n
  });
  assert.equal(confirmed.status, "confirmed");
  assert.equal(confirmed.observedTransfer?.amountBaseUnits, "10000000");

  // 2. Amount mismatch returns mismatch
  const amtMismatch = await verifyUsdcTransfer(mockClient, {
    txHash: "0xvalid",
    to: "0x2222222222222222222222222222222222222222",
    amountBaseUnits: 50_000_000n // expecting 50 USDC
  });
  assert.equal(amtMismatch.status, "mismatch");
  assert.ok(amtMismatch.reason?.includes("amount_mismatch"));

  // 3. Recipient mismatch returns mismatch
  const rcpMismatch = await verifyUsdcTransfer(mockClient, {
    txHash: "0xvalid",
    to: "0x3333333333333333333333333333333333333333", // wrong recipient
    amountBaseUnits: 10_000_000n
  });
  assert.equal(rcpMismatch.status, "mismatch");

  // 4. Reverted transaction returns failed
  const revertedClient = {
    async getTransactionReceipt() {
      return { status: "reverted" };
    }
  } as never;
  const failed = await verifyUsdcTransfer(revertedClient, {
    txHash: "0xrev",
    to: "0x2222222222222222222222222222222222222222",
    amountBaseUnits: 10_000_000n
  });
  assert.equal(failed.status, "failed");

  // 5. Unmined/pending receipt returns pending
  const pendingClient = {
    async getTransactionReceipt() {
      return null;
    }
  } as never;
  const pending = await verifyUsdcTransfer(pendingClient, {
    txHash: "0xpending",
    to: "0x2222222222222222222222222222222222222222",
    amountBaseUnits: 10_000_000n
  });
  assert.equal(pending.status, "pending");
});

test("encodeEnvelopeExecutePayment matches viem's ABI encoder exactly", async () => {
  const { encodeFunctionData } = await import("viem");
  const {
    encodeEnvelopeExecutePayment,
    ENVELOPE_EXECUTE_SELECTOR,
    envelopeAbi,
    paymentIdHash
  } = await import("../src/index.ts");

  const paymentHash = paymentIdHash("intent_7");
  const recipient = "0x2222222222222222222222222222222222222222";

  // Independent oracle: viem derives selector + encoding from the ABI itself.
  const expected = encodeFunctionData({
    abi: envelopeAbi,
    functionName: "executePayment",
    args: [paymentHash as `0x${string}`, recipient as `0x${string}`, 40_000_000n]
  });

  const actual = encodeEnvelopeExecutePayment({
    paymentIdHash: paymentHash,
    recipient,
    amountBaseUnits: 40_000_000n
  });

  assert.equal(ENVELOPE_EXECUTE_SELECTOR, expected.slice(0, 10));
  assert.equal(actual, expected);
  // selector (4B) + 3 padded words = 2 + 8 + 192 chars
  assert.equal(actual.length, 2 + 8 + 64 * 3);
  // six-decimal base units: 40 USDC -> 0x2625a00 trailing word
  assert.ok(actual.endsWith("0000000000000000000000000000000000000000000000000000000002625a00"));
});

test("createEnvelope writes the factory policy call with six-decimal units", async () => {
  const writes: Array<Record<string, unknown>> = [];
  const client = createArcContractClient({
    privateKey: "0xabc",
    contracts: {
      envelopeFactory: "0x9999999999999999999999999999999999999999"
    },
    walletClient: {
      async writeContract(input: Record<string, unknown>) {
        writes.push(input);
        return "0xfactory_tx";
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

  const tx = await client.createEnvelope({
    maxPerTransaction: "100.00",
    maxPerDay: "250.00",
    automaticApprovalLimit: "20.00",
    allowedDaysMask: 127,
    startHourUtc: 0,
    endHourUtc: 24,
    recipientAllowlistEnabled: true,
    initialRecipients: ["0x2222222222222222222222222222222222222222"],
    initialOperators: ["0x3333333333333333333333333333333333333333"]
  });

  assert.equal(tx, "0xfactory_tx");
  assert.equal(writes.length, 1);
  assert.equal(writes[0]?.address, "0x9999999999999999999999999999999999999999");
  assert.equal(writes[0]?.functionName, "createEnvelope");
  assert.deepEqual(writes[0]?.args, [
    100_000_000n,
    250_000_000n,
    20_000_000n,
    127,
    0,
    24,
    true,
    ["0x2222222222222222222222222222222222222222"],
    ["0x3333333333333333333333333333333333333333"]
  ]);
});

