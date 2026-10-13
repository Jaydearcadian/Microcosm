import test from "node:test";
import assert from "node:assert/strict";
import {
  ApiErrorSchema,
  MeResponseSchema,
  SpaceResponseSchema,
  WalletBindingResponseSchema,
  BalanceResponseSchema,
  CreateIntentRequestSchema,
  CreateIntentResponseSchema,
  PreparePaymentRequestSchema,
  PreparePaymentResponseSchema,
  RecordSubmissionRequestSchema,
  PaymentResponseSchema,
  ActivityResponseSchema,
  EvmAddressSchema,
  MoneyDecimalStringSchema,
  MoneyBaseUnitsStringSchema,
  ChainIdSchema
} from "../src/index.ts";

test("EvmAddressSchema validates valid checksum and lowercase hex addresses", () => {
  const valid = "0x0000000000000000000000000000000000000001";
  assert.equal(EvmAddressSchema.parse(valid), valid);

  assert.throws(() => EvmAddressSchema.parse("0xinvalid"), /Invalid EVM address/);
  assert.throws(() => EvmAddressSchema.parse("12345"), /Invalid EVM address/);
  assert.throws(() => EvmAddressSchema.parse(""), /Invalid EVM address/);
});

test("Money string schemas strictly reject numbers, negative values, and invalid decimals", () => {
  assert.equal(MoneyDecimalStringSchema.parse("10.50"), "10.50");
  assert.equal(MoneyDecimalStringSchema.parse("0.000001"), "0.000001");
  assert.equal(MoneyDecimalStringSchema.parse("100"), "100");

  // Must reject numbers (floats/integers)
  assert.throws(() => MoneyDecimalStringSchema.parse(10.5 as unknown as string));
  assert.throws(() => MoneyDecimalStringSchema.parse(-5 as unknown as string));
  // Must reject negative strings
  assert.throws(() => MoneyDecimalStringSchema.parse("-10.5"));
  // Must reject more than 6 decimal places (USDC is 6 decimals)
  assert.throws(() => MoneyDecimalStringSchema.parse("10.1234567"));

  // Base units integer string
  assert.equal(MoneyBaseUnitsStringSchema.parse("10500000"), "10500000");
  assert.throws(() => MoneyBaseUnitsStringSchema.parse("10.5"));
  assert.throws(() => MoneyBaseUnitsStringSchema.parse(-100 as unknown as string));
});

test("ChainIdSchema enforces positive integer chain ID", () => {
  assert.equal(ChainIdSchema.parse(5042), 5042);
  assert.throws(() => ChainIdSchema.parse(0));
  assert.throws(() => ChainIdSchema.parse(-1));
  assert.throws(() => ChainIdSchema.parse("5042" as unknown as number));
});

test("ApiErrorSchema parses standard error envelope", () => {
  const errorObj = {
    error: {
      code: "recipient_not_found",
      message: "The selected recipient could not be resolved.",
      requestId: "req_12345",
      details: { recipientId: "rec_999" }
    }
  };
  const parsed = ApiErrorSchema.parse(errorObj);
  assert.equal(parsed.error.code, "recipient_not_found");
  assert.equal(parsed.error.requestId, "req_12345");
});

test("MeResponseSchema validates stable internal principal, identities, and active space", () => {
  const me = {
    user: {
      id: "usr_microcosm_001",
      status: "active",
      createdAt: "2026-10-13T00:00:00.000Z",
      updatedAt: "2026-10-13T00:00:00.000Z"
    },
    identities: [
      {
        provider: "privy",
        providerSubject: "did:privy:sub_123",
        identityType: "email",
        verifiedAt: "2026-10-13T00:00:00.000Z",
        linkedAt: "2026-10-13T00:00:00.000Z"
      }
    ],
    wallets: [
      {
        id: "wb_001",
        userId: "usr_microcosm_001",
        spaceId: "spc_001",
        address: "0x0000000000000000000000000000000000000001",
        chainType: "evm",
        chainId: 5042,
        role: "primary",
        provider: "privy",
        verification: "provider_attested",
        status: "active",
        createdAt: "2026-10-13T00:00:00.000Z"
      }
    ],
    activeSpace: {
      id: "spc_001",
      type: "personal",
      name: "Personal Space",
      ownerUserId: "usr_microcosm_001",
      status: "active",
      createdAt: "2026-10-13T00:00:00.000Z",
      updatedAt: "2026-10-13T00:00:00.000Z"
    }
  };

  const parsed = MeResponseSchema.parse(me);
  assert.equal(parsed.user.id, "usr_microcosm_001");
  assert.equal(parsed.activeSpace.ownerUserId, "usr_microcosm_001");
  assert.equal(parsed.wallets[0].chainId, 5042);
});

test("BalanceResponseSchema requires explicit asset, chainId, and amount strings", () => {
  const balance = {
    spaceId: "spc_001",
    address: "0x0000000000000000000000000000000000000001",
    chainId: 5042,
    asset: "USDC",
    tokenAddress: "0x0000000000000000000000000000000000000002",
    amountDecimal: "150.000000",
    amountBaseUnits: "150000000",
    observedAt: "2026-10-13T12:00:00.000Z",
    source: "arc_rpc"
  };

  const parsed = BalanceResponseSchema.parse(balance);
  assert.equal(parsed.asset, "USDC");
  assert.equal(parsed.amountBaseUnits, "150000000");

  // Rejects wrong asset
  assert.throws(() => BalanceResponseSchema.parse({ ...balance, asset: "ETH" }));
  // Rejects floating point amounts
  assert.throws(() => BalanceResponseSchema.parse({ ...balance, amountDecimal: 150.0 }));
});

test("CreateIntentRequestSchema enforces integer/decimal string amount and rejects malformed fields", () => {
  const req = {
    spaceId: "spc_001",
    recipientId: "rec_123",
    recipientAddress: "0x0000000000000000000000000000000000000001",
    asset: "USDC",
    tokenAddress: "0x0000000000000000000000000000000000000002",
    chainId: 5042,
    amountDecimal: "25.000000",
    amountBaseUnits: "25000000",
    idempotencyKey: "idem_abc123"
  };

  const parsed = CreateIntentRequestSchema.parse(req);
  assert.equal(parsed.amountBaseUnits, "25000000");

  // Rejects float
  assert.throws(() => CreateIntentRequestSchema.parse({ ...req, amountBaseUnits: 25000000 }));
  // Rejects invalid address
  assert.throws(() => CreateIntentRequestSchema.parse({ ...req, recipientAddress: "not-an-address" }));
});

test("PreparePaymentResponseSchema requires zero native value and explicit calldata", () => {
  const prep = {
    intentId: "int_123",
    senderAddress: "0x0000000000000000000000000000000000000001",
    to: "0x0000000000000000000000000000000000000002",
    calldata: "0xa9059cbb0000000000000000000000000000000000000000000000000000000000000001",
    value: "0",
    chainId: 5042,
    tokenAddress: "0x0000000000000000000000000000000000000002",
    amountBaseUnits: "25000000",
    expiresAt: "2026-10-13T12:05:00.000Z"
  };

  const parsed = PreparePaymentResponseSchema.parse(prep);
  assert.equal(parsed.value, "0");
  assert.equal(parsed.chainId, 5042);

  // Must reject non-zero native value
  assert.throws(() => PreparePaymentResponseSchema.parse({ ...prep, value: "100" }));
});

test("RecordSubmissionRequestSchema requires valid txHash, chainId, and sender", () => {
  const sub = {
    spaceId: "spc_001",
    intentId: "int_123",
    txHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    senderAddress: "0x0000000000000000000000000000000000000001",
    chainId: 5042
  };

  const parsed = RecordSubmissionRequestSchema.parse(sub);
  assert.equal(parsed.txHash, sub.txHash);

  // Rejects invalid txHash
  assert.throws(() => RecordSubmissionRequestSchema.parse({ ...sub, txHash: "0x123" }));
});

test("PaymentResponseSchema requires valid state-machine status", () => {
  const payment = {
    payment: {
      id: "pay_001",
      spaceId: "spc_001",
      ownerUserId: "usr_001",
      intentId: "int_123",
      senderAddress: "0x0000000000000000000000000000000000000001",
      recipientAddress: "0x0000000000000000000000000000000000000002",
      chainId: 5042,
      tokenAddress: "0x0000000000000000000000000000000000000003",
      amountDecimal: "25.000000",
      amountBaseUnits: "25000000",
      status: "SUBMITTED",
      txHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      createdAt: "2026-10-13T12:00:00.000Z",
      updatedAt: "2026-10-13T12:01:00.000Z"
    }
  };

  const parsed = PaymentResponseSchema.parse(payment);
  assert.equal(parsed.payment.status, "SUBMITTED");

  // Rejects invalid status
  assert.throws(() => PaymentResponseSchema.parse({
    payment: { ...payment.payment, status: "RANDOM_STATUS" }
  }));
});

test("ActivityResponseSchema validates list of events with ISO timestamps", () => {
  const activity = {
    items: [
      {
        id: "act_001",
        spaceId: "spc_001",
        type: "payment_submitted",
        title: "Sent 25.00 USDC",
        subtitle: "To 0x0000...0002",
        timestamp: "2026-10-13T12:01:00.000Z",
        status: "SUBMITTED"
      }
    ],
    nextCursor: null
  };

  const parsed = ActivityResponseSchema.parse(activity);
  assert.equal(parsed.items.length, 1);
  assert.equal(parsed.nextCursor, null);
});
